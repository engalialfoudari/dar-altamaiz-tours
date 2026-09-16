module.exports = { moduleNameMapper: { "^@/(.*)$": "<rootDir>/$1", "\\.(jpg|jpeg|png|gif|eot|otf|webp|svg|ttf|woff|woff2|mp4|webm|wav|mp3|m4a|aac|oga)$": "<rootDir>/test/__mocks__/fileMock.js" },
  preset: "jest-expo",
  setupFilesAfterEnv: ["<rootDir>/test/setup.ts"],
  testMatch: ["<rootDir>/components/**/*.test.tsx", "<rootDir>/lib/**/*.test.ts", "<rootDir>/lib/**/*.test.tsx"],
};