const fs = require("fs");
const path = require("path");
const express = require("express");
const { initDb } = require("./db");
const { createHealthRouter } = require("./routes/health");
const { createAuthRouter } = require("./routes/auth");
const { createJobsRouter } = require("./routes/jobs");
const { authMiddleware } = require("./middleware/auth");
const broker = require("./broker");
const { startWorkerEventConsumer } = require("./consumers/workerEvents");
const { initWebSocket } = require("./ws");
const http = require("http");

const PORT = process.env.PORT || 3000;

async function main() {
  const dataDir = path.join(__dirname, "..", "data");
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  } else {
    // Clear old uploads on startup
    console.log("[Server] Clearing old uploads from data directory...");
    const files = fs.readdirSync(dataDir);
    for (const file of files) {
      if (file !== "bleep.db") {
        try {
          fs.unlinkSync(path.join(dataDir, file));
        } catch (err) {
          console.error(`[Server] Failed to delete ${file}:`, err.message);
        }
      }
    }
  }

  const db = await initDb();

  // Initialize message broker
  let brokerConnected = false;
  try {
    await broker.connectBroker();
    console.log("[Server] Message broker initialized");
    brokerConnected = true;
    await startWorkerEventConsumer(db, broker);
  } catch (error) {
    console.warn("[Server] Failed to initialize broker:", error.message);
    console.warn("[Server] Continuing without message broker");
  }

  const app = express();
  const cors = require("cors");
  app.use(cors());
  app.use(express.json());
  app.use("/data", express.static(dataDir));

  app.use(createHealthRouter());
  app.use(createAuthRouter());
  app.use(authMiddleware);
  app.use(createJobsRouter(db, brokerConnected ? broker : null));

  const server = http.createServer(app);
  initWebSocket(server);

  server.listen(PORT, () => {
    console.log(`Backend Lab 4&5&6 running on http://localhost:${PORT}`);
  });

  // Graceful shutdown
  process.on("SIGINT", async () => {
    console.log("[Server] Shutting down...");
    server.close(() => {
      console.log("[Server] HTTP server closed");
    });
    if (brokerConnected) {
      await broker.closeBroker();
    }
    process.exit(0);
  });
}

main().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});
