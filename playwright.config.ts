import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30000,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: 'https://4dinno.ru',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command:
      'cd backend && uv run uvicorn src.main:app --host 0.0.0.0 --port 8000',
    port: 8000,
    reuseExistingServer: !process.env.CI,
    timeout: 15000,
  },
});
