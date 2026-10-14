import { expect, test } from '@playwright/test'

test('home page asks for sign-in without a session', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: /sign in required/i })).toBeVisible()
})
