const { WebSocketServer } = require("ws");
const { verifyAccessToken } = require("./auth");

// Mapping of userId -> Set of WebSocket connections
const userConnections = new Map();

function initWebSocket(server) {
  const wss = new WebSocketServer({ server, path: "/ws" });

  wss.on("connection", (ws, req) => {
    try {
      // Expect token in query parameter (e.g. ?token=...)
      const url = new URL(req.url, `http://${req.headers.host}`);
      const token = url.searchParams.get("token");

      if (!token) {
        ws.close(4001, "Token required");
        return;
      }

      const decoded = verifyAccessToken(token);
      const userId = decoded.userId;

      ws.userId = userId;

      if (!userConnections.has(userId)) {
        userConnections.set(userId, new Set());
      }
      userConnections.get(userId).add(ws);

      console.log(`[WS] Client connected for User ID: ${userId}`);

      ws.on("close", () => {
        const connections = userConnections.get(userId);
        if (connections) {
          connections.delete(ws);
          if (connections.size === 0) {
            userConnections.delete(userId);
          }
        }
        console.log(`[WS] Client disconnected for User ID: ${userId}`);
      });
    } catch (err) {
        console.log(`[WS] Connection rejected: ${err.message}`);
        ws.close(4001, "Unauthorized");
    }
  });

  return wss;
}

function broadcastToUser(userId, event) {
  const connections = userConnections.get(userId);
  if (connections) {
    const payload = JSON.stringify(event);
    for (const ws of connections) {
      if (ws.readyState === 1 /* OPEN */) {
        ws.send(payload);
      }
    }
  }
}

module.exports = {
  initWebSocket,
  broadcastToUser,
};
