const request = require("supertest");
const { createTestDb, closeTestDb } = require("../helpers/testDb");
const { createTestApp } = require("../helpers/testApp");

describe("contract: auth token issuance", () => {
  let db;
  let app;

  beforeAll(async () => {
    db = await createTestDb();
    app = createTestApp(db);
  });

  afterAll(async () => {
    await closeTestDb(db);
  });

  test("POST /auth/token response contract", async () => {
    const response = await request(app).post("/auth/token").send({ userId: "student-1" });

    expect(response.status).toBe(200);
    expect(response.body).toEqual(
      expect.objectContaining({
        accessToken: expect.any(String),
        tokenType: "Bearer",
        userId: "student-1",
      })
    );
  });

  test("POST /auth/token validation error contract", async () => {
    const response = await request(app).post("/auth/token").send({ userId: "   " });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: "userId is required and must be a non-empty string",
    });
  });
});
