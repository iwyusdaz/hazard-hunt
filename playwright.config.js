import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  testMatch: 'tests/**/*.spec.js', // unit tests (*.test.js) belong to Vitest
  // CI runners (2 vCPU) are far slower than the local M1; local runs stay well under.
  timeout: 180_000,
  retries: 0,
  workers: 1,
  use: { baseURL: 'http://127.0.0.1:4274', trace: 'retain-on-failure' },
  webServer: {
    command: 'npm run preview -- --host 127.0.0.1 --port 4274 --strictPort',
    url: 'http://127.0.0.1:4274',
    reuseExistingServer: false,
    timeout: 120_000,
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
  outputDir: 'tmp/test-results',
});
