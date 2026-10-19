import { expect, test } from '@playwright/test'

const PAGE = {
  pageId: 'page-1',
  title: 'Acme Redesign',
  body: '<p>We helped Acme ship. <a href="/contact">Contact us</a></p>',
  heroImage: { url: '/h.jpg', alt: 'Acme hero' },
  paragraphs: [{ status: 'html-fragment', html: '<blockquote>Legacy quote</blockquote>' }],
}

test('client-work page renders the real Drupal content without sign-in', async ({ page }) => {
  await page.route('**/pages/client-work/page-1', (route) => route.fulfill({ json: PAGE }))
  await page.goto('/client-work/page-1')
  await expect(page.getByRole('heading', { name: 'Acme Redesign' })).toBeVisible()
  await expect(page.getByRole('img', { name: 'Acme hero' })).toHaveAttribute('src', '/h.jpg')
  await expect(page.getByRole('link', { name: 'Contact us' })).toBeVisible()
  await expect(page.getByText('Legacy quote')).toBeVisible()
  await expect(page.getByText('client_work')).toHaveCount(0)
})
