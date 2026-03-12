const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "lab2-dev-secret-change-me";
const TOKEN_EXPIRATION = "7d";

function signAccessToken(userId) {
  return jwt.sign({ userId }, JWT_SECRET, {
    expiresIn: TOKEN_EXPIRATION,
  });
}

function verifyAccessToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

module.exports = {
  signAccessToken,
  verifyAccessToken,
};
