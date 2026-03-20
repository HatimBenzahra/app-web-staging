import { test as base, expect } from '@playwright/test'

export const test = base.extend({
  page: async ({ page }, use) => {
    page.on('console', msg => {
      if (msg.type() === 'error' && !msg.text().includes('favicon')) {
        console.log(`[BROWSER ERROR] ${msg.text()}`)
      }
    })
    await use(page)
  },
})

export { expect }

export async function waitForPageLoad(page) {
  await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {})
  const skeleton = page.locator('[class*="animate-shimmer"], [class*="skeleton"]').first()
  await skeleton.waitFor({ state: 'hidden', timeout: 10_000 }).catch(() => {})
}

export async function expectToastSuccess(page) {
  await expect(
    page.locator('[data-slot="toast"]').filter({ hasText: /succès|ajouté|modifié|supprimé/i })
  ).toBeVisible({ timeout: 5_000 })
}

export async function expectToastError(page) {
  await expect(
    page.locator('[data-slot="toast"][data-variant="error"], [class*="destructive"]').first()
  ).toBeVisible({ timeout: 5_000 })
}

export async function searchInTable(page, query) {
  const searchInput = page.locator('input[placeholder*="echerch"], input[placeholder*="earch"]').first()
  await searchInput.fill(query)
  await page.waitForTimeout(500)
}

export async function getTableRowCount(page) {
  return page.locator('tbody tr, [data-slot="table-row"]').count()
}

export async function clickTableRow(page, text) {
  const row = page
    .locator('tbody tr, [data-slot="table-row"]')
    .filter({ hasText: text })
    .first()

  await expect(row).toBeVisible({ timeout: 10_000 })
  await row.click()
}

export async function hasTableData(page) {
  const emptyRow = page.locator('tbody tr').first()
  const text = await emptyRow.textContent().catch(() => '')
  return !text.includes('Aucun résultat')
}

export async function navigateToRowDetails(page, rowIndex = 0) {
  const rows = page.locator('tbody tr')
  await expect(rows.nth(rowIndex)).toBeVisible({ timeout: 10_000 })

  const actionCell = rows.nth(rowIndex).locator('td').last()
  const menuButton = actionCell.locator('button').first()
  await menuButton.click()

  await page.getByRole('menuitem', { name: /voir détails/i }).click()
}

export async function navigateToFirstRowDetails(page) {
  await navigateToRowDetails(page, 0)
}

export async function openStatusFilter(page) {
  await page.getByRole('button', { name: /^Status$/i }).first().click()
}
