const express = require("express");
const { signAccessToken } = require("../auth");

function createAuthRouter() {
  const router = express.Router();

  router.post("/auth/token", (req, res) => {
    const rawUserId = req.body?.userId;
    const userId = typeof rawUserId === "string" ? rawUserId.trim() : "";

    if (!userId) {
      return res.status(400).json({ error: "userId is required and must be a non-empty string" });
    }

    const accessToken = signAccessToken(userId);
    return res.json({
      accessToken,
      tokenType: "Bearer",
      userId,
    });
  });

  return router;
}

module.exports = {
  createAuthRouter,
};
