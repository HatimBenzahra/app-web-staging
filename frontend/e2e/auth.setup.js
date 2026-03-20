import { test as setup, expect } from '@playwright/test'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ADMIN_AUTH_FILE = path.join(__dirname, '.auth/admin.json')
const DIRECTEUR_AUTH_FILE = path.join(__dirname, '.auth/directeur.json')

async function loginAs(page, username, password, authFile) {
  await page.goto('/login')

  await page.locator('#username').fill(username)
  await page.locator('#password').fill(password)
  await page.getByRole('button', { name: 'Se connecter' }).click()

  await page.waitForURL('/', { timeout: 15_000 })
  await expect(page.locator('h1, h2, [data-slot]').first()).toBeVisible({ timeout: 10_000 })

  await page.context().storageState({ path: authFile })
}

setup('authenticate as admin', async ({ page }) => {
  await loginAs(
    page,
    process.env.TEST_ADMIN_USERNAME ?? 'admin',
    process.env.TEST_ADMIN_PASSWORD ?? 'admin',
    ADMIN_AUTH_FILE
  )
})

setup('authenticate as directeur', async ({ page }) => {
  await loginAs(
    page,
    process.env.TEST_DIRECTEUR_USERNAME ?? 'directeur',
    process.env.TEST_DIRECTEUR_PASSWORD ?? 'directeur',
    DIRECTEUR_AUTH_FILE
  )
})
