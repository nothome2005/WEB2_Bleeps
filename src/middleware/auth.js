const { verifyAccessToken } = require("../auth");

function authMiddleware(req, res, next) {
  const authorization = req.headers.authorization;
  if (!authorization || !authorization.startsWith("Bearer ")) {
    return res.status(401).json({ error: "missing or invalid authorization header" });
  }

  const token = authorization.slice(7);

  try {
    const payload = verifyAccessToken(token);
    const userId = typeof payload?.userId === "string" ? payload.userId.trim() : "";

    if (!userId) {
      return res.status(401).json({ error: "invalid token payload" });
    }

    req.auth = { userId };
    return next();
  } catch (_error) {
    return res.status(401).json({ error: "invalid or expired token" });
  }
}

module.exports = {
  authMiddleware,
};
