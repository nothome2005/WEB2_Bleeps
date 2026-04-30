const request = require("supertest");
const { createTestDb, closeTestDb } = require("../helpers/testDb");
const { createTestApp } = require("../helpers/testApp");
const { authHeader } = require("../helpers/auth");

function assertJobContract(job) {
  expect(job).toEqual(
    expect.objectContaining({
      id: expect.any(Number),
      userId: expect.any(String),
      title: expect.any(String),
      status: expect.any(String),
      createdAt: expect.any(String),
      updatedAt: expect.any(String),
    })
  );

  expect(["string", "object"]).toContain(typeof job.description);
  expect(["string", "object"]).toContain(typeof job.result);
  expect(["string", "object"]).toContain(typeof job.error);
}

describe("contract: job lifecycle", () => {
  let db;
  let app;

  beforeAll(async () => {
    db = await createTestDb();
    app = createTestApp(db);
  });

  afterAll(async () => {
    await closeTestDb(db);
  });

  test("create -> queued -> processing -> done contract", async () => {
    const headers = authHeader("student-2");

    const created = await request(app)
      .post("/jobs")
      .set(headers)
      .send({ title: "Generate prompt", description: "image to text" });

    expect(created.status).toBe(201);
    assertJobContract(created.body);
    expect(created.body.status).toBe("CREATED");
    expect(created.body.result).toBe(null);

    const queued = await request(app)
      .patch(`/jobs/${created.body.id}/status`)
      .set(headers)
      .send({ status: "QUEUED" });

    expect(queued.status).toBe(200);
    assertJobContract(queued.body);
    expect(queued.body.status).toBe("QUEUED");

    const processing = await request(app)
      .patch(`/jobs/${created.body.id}/status`)
      .set(headers)
      .send({ status: "PROCESSING" });

    expect(processing.status).toBe(200);
    assertJobContract(processing.body);
    expect(processing.body.status).toBe("PROCESSING");

    const done = await request(app)
      .patch(`/jobs/${created.body.id}/status`)
      .set(headers)
      .send({ status: "DONE", result: "a foggy metro tunnel" });

    expect(done.status).toBe(200);
    assertJobContract(done.body);
    expect(done.body.status).toBe("DONE");
    expect(done.body.result).toBe("a foggy metro tunnel");
    expect(done.body.error).toBe(null);

    const byId = await request(app).get(`/jobs/${created.body.id}`).set(headers);
    expect(byId.status).toBe(200);
    assertJobContract(byId.body);
    expect(byId.body.status).toBe("DONE");
  });
});
