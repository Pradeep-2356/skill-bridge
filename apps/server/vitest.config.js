import { defineConfig } from 'vitest/config';

/** Settings every server test sees. Real secrets never appear in tests. */
const testEnv = {
  NODE_ENV: 'test',
  JWT_ACCESS_SECRET: 'test-only-secret-that-is-long-enough-to-pass-validation',
  BCRYPT_COST: '4',
  MAIL_TRANSPORT: 'memory',
  LOG_REQUESTS: 'false',
  CLIENT_ORIGIN: 'http://localhost:5173',
};

export default defineConfig({
  test: {
    env: testEnv,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.js'],
      exclude: ['src/server.js'],
      reporter: ['text-summary', 'json-summary', 'html'],
      reportsDirectory: 'coverage',
    },
    projects: [
      {
        extends: true,
        test: { name: 'unit', include: ['tests/unit/**/*.test.js'], environment: 'node' },
      },
      {
        extends: true,
        test: {
          name: 'integration',
          include: ['tests/integration/**/*.test.js'],
          environment: 'node',
          globalSetup: ['tests/helpers/globalSetup.js'],
          testTimeout: 20_000,
          hookTimeout: 120_000,
        },
      },
    ],
  },
});
