/** @type {import('ts-jest').JestConfigWithTsJest} **/
module.exports = {
  testEnvironment: "node",
  collectCoverage: true,
  coverageReporters: ["html"],
  transform: {
    "^.+.tsx?$": ["ts-jest",{}],
  },
};