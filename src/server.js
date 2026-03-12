const fs = require("fs");
const path = require("path");
const express = require("express");
const { initDb } = require("./db");
const { createHealthRouter } = require("./routes/health");
const { createAuthRouter } = require("./routes/auth");
const { createJobsRouter } = require("./routes/jobs");
const { authMiddleware } = require("./middleware/auth");

const PORT = process.env.PORT || 3000;

async function main() {
  const dataDir = path.join(__dirname, "..", "data");
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const db = await initDb();
  const app = express();
  app.use(express.json());

  app.use(createHealthRouter());
  app.use(createAuthRouter());
  app.use(authMiddleware);
  app.use(createJobsRouter(db));

  app.listen(PORT, () => {
    console.log(`Backend Lab 2 running on http://localhost:${PORT}`);
  });
}

main().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});
