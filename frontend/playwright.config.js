import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e/tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 4 : undefined,
  reporter: [['html', { open: 'never' }], ['list']],

  use: {
    baseURL: 'https://localhost:5173',
    ignoreHTTPSErrors: true,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 10_000,
    navigationTimeout: 15_000,
  },

  projects: [
    {
      name: 'auth-setup',
      testDir: './e2e',
      testMatch: /auth\.setup\.js/,
    },
    {
      name: 'admin',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'e2e/.auth/admin.json',
      },
      dependencies: ['auth-setup'],
      testMatch: '**/admin-directeur/**/*.spec.js',
    },
    {
      name: 'directeur',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'e2e/.auth/directeur.json',
      },
      dependencies: ['auth-setup'],
      testMatch: '**/admin-directeur/**/*.spec.js',
    },
  ],

  webServer: {
    command: 'npm run dev',
    url: 'https://localhost:5173',
    reuseExistingServer: true,
    ignoreHTTPSErrors: true,
    timeout: 30_000,
  },
})
