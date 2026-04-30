module.exports = {
  testEnvironment: "node",
  clearMocks: true,
  rootDir: "..",
  testMatch: [
    "<rootDir>/testing/tests/**/*.test.js",
  ],
  collectCoverageFrom: [
    "<rootDir>/src/**/*.js",
    "!<rootDir>/src/server.js",
  ],
  coverageDirectory: "<rootDir>/testing/coverage",
};
