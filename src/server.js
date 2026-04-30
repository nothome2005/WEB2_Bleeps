const fs = require("fs");
const path = require("path");
const express = require("express");
const { initDb } = require("./db");
const { createHealthRouter } = require("./routes/health");
const { createAuthRouter } = require("./routes/auth");
const { createJobsRouter } = require("./routes/jobs");
const { authMiddleware } = require("./middleware/auth");
const { connectBroker, closeBroker } = require("./broker");

const PORT = process.env.PORT || 3000;

async function main() {
  const dataDir = path.join(__dirname, "..", "data");
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const db = await initDb();

  // Initialize message broker
  let broker = null;
  try {
    broker = await connectBroker();
    console.log("[Server] Message broker initialized");
  } catch (error) {
    console.warn("[Server] Failed to initialize broker:", error.message);
    console.warn("[Server] Continuing without message broker");
  }

  const app = express();
  app.use(express.json());

  app.use(createHealthRouter());
  app.use(createAuthRouter());
  app.use(authMiddleware);
  app.use(createJobsRouter(db, broker));

  const server = app.listen(PORT, () => {
    console.log(`Backend Lab 3 running on http://localhost:${PORT}`);
  });

  // Graceful shutdown
  process.on("SIGINT", async () => {
    console.log("[Server] Shutting down...");
    server.close(() => {
      console.log("[Server] HTTP server closed");
    });
    if (broker) {
      await closeBroker();
    }
    process.exit(0);
  });
}

main().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});
