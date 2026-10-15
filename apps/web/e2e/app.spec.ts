import { expect, test } from '@playwright/test'

test('home page sends the default dev actor to their requisitions', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: /my requisitions/i })).toBeVisible()
})
