import {
  test,
  expect,
  waitForPageLoad,
  getTableRowCount,
  navigateToRowDetails,
  openStatusFilter,
  hasTableData,
} from '../../fixtures/base.js'

test.describe('Commerciaux Admin Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/commerciaux')
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

  test('navigates to commercial details', async ({ page }) => {
    test.skip(!(await hasTableData(page)), 'No data in table for this role')
    await navigateToRowDetails(page)
    await page.waitForURL(/\/commerciaux\/[^/]+$/)
    expect(page.url()).toMatch(/\/commerciaux\/[^/]+$/)
  })

  test('details page shows commercial info', async ({ page }) => {
    test.skip(!(await hasTableData(page)), 'No data in table for this role')
    await navigateToRowDetails(page)
    await page.waitForURL(/\/commerciaux\/[^/]+$/)
    await waitForPageLoad(page)

    await expect(page.getByRole('heading').first()).toBeVisible()
    await expect(page.locator('body')).toContainText(/statistiques|informations|activité/i)
  })

  test('can navigate back from details', async ({ page }) => {
    test.skip(!(await hasTableData(page)), 'No data in table for this role')
    await navigateToRowDetails(page)
    await page.waitForURL(/\/commerciaux\/[^/]+$/)

    const breadcrumbBack = page.locator('a[href="/commerciaux"]').first()
    if (await breadcrumbBack.isVisible().catch(() => false)) {
      await breadcrumbBack.click()
    } else {
      await page.goBack()
    }

    await page.waitForURL(/\/commerciaux\/?$/)
    await expect(page.getByRole('table').first()).toBeVisible()
  })
})
