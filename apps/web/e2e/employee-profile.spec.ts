import { expect, test } from '@playwright/test'

const token = (role: string) => `h.${Buffer.from(JSON.stringify({ role, tenant_id: 't1' })).toString('base64url')}.s`
const employee = {
  id: 'u1', employeeNumber: 'EMP-1042', fullName: 'Alicia Gomez', startDate: '2022-03-14',
  jobTitle: 'Designer', department: 'Design', contractType: 'Full-time', salary: 100000,
}

test('HR Admin sees the employee ID read-only and history without edit/delete controls', async ({ page }) => {
  await page.addInitScript((t) => localStorage.setItem('arc.accessToken', t), token('hr_admin'))
  await page.route('**/employees/u1', (r) => r.fulfill({ json: employee }))
  await page.route('**/employees/u1/history', (r) =>
    r.fulfill({ json: [{ id: 'h1', field: 'jobTitle', previousValue: null, newValue: 'Designer', effectiveDate: '2022-03-14', recordedAt: '2022-03-10T14:05:00Z' }] }),
  )
  await page.route('**/pending-change-requests', (r) => r.fulfill({ json: [] }))
  await page.goto('/employees/u1')
  await expect(page.getByText('EMP-1042').first()).toBeVisible()
  await expect(page.getByText('No edit or delete')).toBeVisible()
  await expect(page.getByRole('table').getByRole('button')).toHaveCount(0)
})

test('a non-HR-Admin sees access restricted on the new-profile page', async ({ page }) => {
  await page.addInitScript((t) => localStorage.setItem('arc.accessToken', t), token('employee'))
  await page.goto('/employees/new')
  await expect(page.getByText('Access restricted')).toBeVisible()
  await expect(page.getByRole('button', { name: /save profile/i })).toHaveCount(0)
})
