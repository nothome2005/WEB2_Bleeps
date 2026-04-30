const express = require("express");
const { createHealthRouter } = require("../../../src/routes/health");
const { createAuthRouter } = require("../../../src/routes/auth");
const { createJobsRouter } = require("../../../src/routes/jobs");
const { authMiddleware } = require("../../../src/middleware/auth");

function createTestApp(db, broker = null) {
  const app = express();
  app.use(express.json());

  app.use(createHealthRouter());
  app.use(createAuthRouter());
  app.use(authMiddleware);
  app.use(createJobsRouter(db, broker));

  return app;
}

module.exports = {
  createTestApp,
};
