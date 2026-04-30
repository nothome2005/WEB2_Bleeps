const request = require("supertest");
const { createTestDb, closeTestDb } = require("../helpers/testDb");
const { createTestApp } = require("../helpers/testApp");
const { authHeader } = require("../helpers/auth");

describe("security integration", () => {
  let db;
  let app;

  beforeAll(async () => {
    db = await createTestDb();
    app = createTestApp(db);
  });

  afterAll(async () => {
    await closeTestDb(db);
  });

  test("returns 401 when Authorization header is missing", async () => {
    const response = await request(app).get("/jobs");
    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      error: "missing or invalid authorization header",
    });
  });

  test("enforces strict user data isolation", async () => {
    const created = await request(app)
      .post("/jobs")
      .set(authHeader("alice"))
      .send({ title: "Alice private job" });

    expect(created.status).toBe(201);
    const aliceJobId = created.body.id;

    const bobList = await request(app).get("/jobs").set(authHeader("bob"));
    expect(bobList.status).toBe(200);
    expect(bobList.body).toEqual([]);

    const bobGet = await request(app).get(`/jobs/${aliceJobId}`).set(authHeader("bob"));
    expect(bobGet.status).toBe(404);
    expect(bobGet.body).toEqual({ error: "job not found" });

    const bobDelete = await request(app).delete(`/jobs/${aliceJobId}`).set(authHeader("bob"));
    expect(bobDelete.status).toBe(404);
    expect(bobDelete.body).toEqual({ error: "job not found" });
  });
});
