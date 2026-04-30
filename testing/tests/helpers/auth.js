const { signAccessToken } = require("../../../src/auth");

function authHeader(userId) {
  return {
    Authorization: `Bearer ${signAccessToken(userId)}`,
  };
}

module.exports = {
  authHeader,
};
