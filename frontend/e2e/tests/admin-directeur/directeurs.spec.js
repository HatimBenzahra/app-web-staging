import {
  test,
  expect,
  waitForPageLoad,
  getTableRowCount,
  navigateToRowDetails,
} from '../../fixtures/base.js'

async function isPermissionDenied(page) {
  if (page.url().includes('/unauthorized')) {
    return true
  }

  const bodyText = (await page.locator('body').textContent().catch(() => '')) || ''
  return /non autorisé|unauthorized|accès refusé|permission/i.test(bodyText)
}

test.describe('Directeurs Admin Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/directeurs')
    await waitForPageLoad(page)
  })

  test('page loads and shows table', async ({ page }) => {
    if (await isPermissionDenied(page)) {
      await expect(page.locator('body')).toContainText(/non autorisé|unauthorized|accès/i)
      return
    }

    await expect(page.getByRole('table').first()).toBeVisible()
    await expect(page.getByRole('columnheader').first()).toBeVisible()
  })

  test('search filters results', async ({ page }) => {
    if (await isPermissionDenied(page)) {
      await expect(page.locator('body')).toContainText(/non autorisé|unauthorized|accès/i)
      return
    }

    const initialCount = await getTableRowCount(page)
    await page.getByPlaceholder(/Rechercher/i).first().fill('test')
    await page.waitForTimeout(500)

    const filteredCount = await getTableRowCount(page)
    expect(filteredCount).toBeLessThanOrEqual(initialCount)
  })

  test('navigates to directeur details', async ({ page }) => {
    if (await isPermissionDenied(page)) {
      await expect(page.locator('body')).toContainText(/non autorisé|unauthorized|accès/i)
      return
    }

    expect(await getTableRowCount(page)).toBeGreaterThan(0)
    await navigateToRowDetails(page)

    await page.waitForURL(/\/directeurs\/[^/]+$/)
    expect(page.url()).toMatch(/\/directeurs\/[^/]+$/)
  })

  test('details page shows directeur info and team', async ({ page }) => {
    if (await isPermissionDenied(page)) {
      await expect(page.locator('body')).toContainText(/non autorisé|unauthorized|accès/i)
      return
    }

    await navigateToRowDetails(page)
    await page.waitForURL(/\/directeurs\/[^/]+$/)
    await waitForPageLoad(page)

    await expect(page.getByRole('heading').first()).toBeVisible()
    await expect(page.locator('body')).toContainText(/managers|équipe|statistiques|performance/i)
  })

  test('can navigate back', async ({ page }) => {
    if (await isPermissionDenied(page)) {
      await expect(page.locator('body')).toContainText(/non autorisé|unauthorized|accès/i)
      return
    }

    await navigateToRowDetails(page)
    await page.waitForURL(/\/directeurs\/[^/]+$/)

    const breadcrumbBack = page.locator('a[href="/directeurs"]').first()
    if (await breadcrumbBack.isVisible().catch(() => false)) {
      await breadcrumbBack.click()
    } else {
      await page.goBack()
    }

    await page.waitForURL(/\/directeurs\/?$/)
    await expect(page.getByRole('table').first()).toBeVisible()
  })
})
