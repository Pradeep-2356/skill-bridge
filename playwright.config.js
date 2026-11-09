/**
 * End-to-end tests: the real React client + the real API + a dedicated MongoDB
 * database (skillbridge_e2e) that is wiped and reseeded before every run.
 *
 *   npm run test:e2e                          all browsers
 *   npm run test:e2e -- --project=chromium    one browser
 *
 * Needs MongoDB running locally (brew services start mongodb-community) and
 * the browsers installed once: npx playwright install
 */
import { defineConfig, devices } from '@playwright/test';

const API_PORT = 5055;
const WEB_PORT = 5174;
const E2E_DB = process.env.E2E_MONGODB_URI ?? 'mongodb://127.0.0.1:27017/skillbridge_e2e';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 45_000,
  expect: { timeout: 8_000 },
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  globalSetup: './e2e/global-setup.js',
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    // SB1/US40 – the main journey also runs in Firefox and Safari's engine.
    { name: 'firefox', use: { ...devices['Desktop Firefox'] }, testMatch: /sprint1-journey/ },
    { name: 'webkit', use: { ...devices['Desktop Safari'] }, testMatch: /sprint1-journey/ },
  ],
  webServer: [
    {
      command: 'node apps/server/src/server.js',
      url: `http://localhost:${API_PORT}/api/v1/health`,
      reuseExistingServer: false,
      timeout: 60_000,
      env: {
        NODE_ENV: 'development',
        PORT: String(API_PORT),
        MONGODB_URI: E2E_DB,
        CLIENT_ORIGIN: `http://localhost:${WEB_PORT}`,
        JWT_ACCESS_SECRET: 'e2e-only-secret-not-used-anywhere-else-123456',
        MAIL_TRANSPORT: 'memory',
        ENABLE_TEST_ROUTES: 'true',
        BCRYPT_COST: '8',
        LOG_REQUESTS: 'false',
        UPLOAD_DIR: 'test-results/e2e-uploads',
      },
    },
    {
      command: `npm run dev -w @skillbridge/client -- --port ${WEB_PORT}`,
      url: `http://localhost:${WEB_PORT}`,
      reuseExistingServer: false,
      timeout: 60_000,
      env: { API_PORT: String(API_PORT) },
    },
  ],
});
