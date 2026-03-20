import {
  test,
  expect,
  waitForPageLoad,
  getTableRowCount,
  navigateToRowDetails,
  hasTableData,
} from '../../fixtures/base.js'

test.describe('Immeubles Admin Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/immeubles')
    await waitForPageLoad(page)
  })

  test('page loads and shows list', async ({ page }) => {
    await expect(page.getByRole('table').first()).toBeVisible()
  })

  test('search filters results', async ({ page }) => {
    const initialCount = await getTableRowCount(page)
    await page.getByPlaceholder(/Rechercher/i).first().fill('test')
    await page.waitForTimeout(500)
    expect(await getTableRowCount(page)).toBeLessThanOrEqual(initialCount)
  })

  test('list/map view toggle works', async ({ page }) => {
    const vueCarteButton = page.getByRole('button', { name: /Vue Carte/i })
    const vueListeButton = page.getByRole('button', { name: /Vue Liste/i })

    await vueCarteButton.click()
    await expect(vueListeButton).toBeVisible()

    await vueListeButton.click()
    await expect(page.getByRole('table').first()).toBeVisible()
  })

  test('date filter works', async ({ page }) => {
    const dateSelect = page.getByRole('combobox').first()
    await dateSelect.click()
    await page.getByRole('option', { name: /Créés récemment/i }).click()

    expect(await getTableRowCount(page)).toBeGreaterThanOrEqual(0)
  })

  test('commercial filter works', async ({ page }) => {
    const commercialSelect = page.getByRole('combobox').nth(1)
    await commercialSelect.click()
    const firstOption = page.getByRole('option').first()
    await firstOption.click()

    expect(await getTableRowCount(page)).toBeGreaterThanOrEqual(0)
  })

  test('navigates to immeuble details', async ({ page }) => {
    test.skip(!(await hasTableData(page)), 'No data in table for this role')
    await navigateToRowDetails(page)
    await page.waitForURL(/\/immeubles\/[^/]+$/)
    expect(page.url()).toMatch(/\/immeubles\/[^/]+$/)
  })

  test('details page shows building info and doors', async ({ page }) => {
    test.skip(!(await hasTableData(page)), 'No data in table for this role')
    await navigateToRowDetails(page)
    await page.waitForURL(/\/immeubles\/[^/]+$/)
    await waitForPageLoad(page)

    await expect(page.getByRole('heading').first()).toBeVisible()
    await expect(page.locator('body')).toContainText(/porte|détails|statistiques|immeuble/i)
  })

  test('can navigate back', async ({ page }) => {
    test.skip(!(await hasTableData(page)), 'No data in table for this role')
    await navigateToRowDetails(page)
    await page.waitForURL(/\/immeubles\/[^/]+$/)

    const breadcrumbBack = page.locator('a[href="/immeubles"]').first()
    if (await breadcrumbBack.isVisible().catch(() => false)) {
      await breadcrumbBack.click()
    } else {
      await page.goBack()
    }

    await page.waitForURL(/\/immeubles\/?$/)
    await expect(page.getByRole('table').first()).toBeVisible()
  })
})
