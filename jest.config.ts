import type { Config } from 'jest';

const config: Config = {
  preset: 'jest-preset-angular',
  setupFilesAfterEnv: ['<rootDir>/setup-jest.ts'],
  roots: ['<rootDir>/src'],
  modulePathIgnorePatterns: ['<rootDir>/.claude/', '<rootDir>/dist/'],
  // dashboard-schedule: dead code, unrouted anywhere in the app, kept out of
  // the suite rather than deleted — see the session notes for why it should
  // probably be removed outright.
  testPathIgnorePatterns: ['<rootDir>/src/app/shared/components/dashboard-schedule/'],
  transformIgnorePatterns: ['node_modules/(?!.*\\.mjs$)'],
};

export default config;
