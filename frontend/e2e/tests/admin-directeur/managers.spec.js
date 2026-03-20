import {
  test,
  expect,
  waitForPageLoad,
  getTableRowCount,
  navigateToRowDetails,
  openStatusFilter,
  hasTableData,
} from '../../fixtures/base.js'

test.describe('Managers Admin Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/managers')
    await waitForPageLoad(page)
  })

  test('page loads and shows table', async ({ page }) => {
    await expect(page.getByRole('table').first()).toBeVisible()
  })

  test('search filters results', async ({ page }) => {
    const initialCount = await getTableRowCount(page)

    await page.getByPlaceholder(/Rechercher/i).first().fill('test')
    await page.waitForTimeout(500)

    const filteredCount = await getTableRowCount(page)
    expect(filteredCount).toBeLessThanOrEqual(initialCount)
  })

  test('status filter works', async ({ page }) => {
    await openStatusFilter(page)
    await page.getByRole('menuitem', { name: 'Actif' }).click()
    await page.waitForTimeout(300)

    await expect(page.getByRole('table').first()).toBeVisible()
  })

  test('navigates to manager details', async ({ page }) => {
    test.skip(!(await hasTableData(page)), 'No data in table for this role')
    await navigateToRowDetails(page)
    await page.waitForURL(/\/managers\/[^/]+$/)
    expect(page.url()).toMatch(/\/managers\/[^/]+$/)
  })

  test('details page shows manager info', async ({ page }) => {
    test.skip(!(await hasTableData(page)), 'No data in table for this role')
    await navigateToRowDetails(page)
    await page.waitForURL(/\/managers\/[^/]+$/)
    await waitForPageLoad(page)

    await expect(page.getByRole('heading').first()).toBeVisible()
    await expect(page.locator('body')).toContainText(/statistiques|informations|activité/i)
  })

  test('can navigate back from details', async ({ page }) => {
    test.skip(!(await hasTableData(page)), 'No data in table for this role')
    await navigateToRowDetails(page)
    await page.waitForURL(/\/managers\/[^/]+$/)

    const breadcrumbBack = page.locator('a[href="/managers"]').first()
    if (await breadcrumbBack.isVisible().catch(() => false)) {
      await breadcrumbBack.click()
    } else {
      await page.goBack()
    }

    await page.waitForURL(/\/managers\/?$/)
    await expect(page.getByRole('table').first()).toBeVisible()
  })
})
