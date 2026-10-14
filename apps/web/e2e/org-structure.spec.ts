import { expect, test, type Page } from '@playwright/test'

const token = (role: string) => `h.${Buffer.from(JSON.stringify({ role, tenant_id: 't1' })).toString('base64url')}.s`
const emp = (id: string, fullName: string, managerId: string | null, departmentId: string | null = null) => ({
  id, fullName, managerId, departmentId, employeeNumber: id, startDate: '2024-01-01', jobTitle: 'Engineer', department: null, contractType: null, salary: null,
})
const employees = [emp('dana', 'Dana Whitfield', null), emp('priya', 'Priya Natarajan', 'dana', 'eng'), emp('liam', 'Liam Ortiz', 'dana')]
const departments = [
  { id: 'eng', name: 'Engineering', parentId: null, managerId: 'priya' },
  { id: 'ops', name: 'Ops', parentId: null, managerId: 'dana' },
]

async function setup(page: Page, role = 'hr_admin') {
  await page.addInitScript((t) => localStorage.setItem('arc.accessToken', t), token(role))
  await page.route('**/employees', (r) => r.fulfill({ json: employees }))
  await page.route('**/departments', (r) => (r.request().method() === 'GET' ? r.fulfill({ json: departments }) : r.fulfill({ status: 201, json: {} })))
  await page.route('**/pending-change-requests', (r) => r.fulfill({ json: [] }))
}

test('creating a department: blank name, missing manager and duplicate name show inline errors', async ({ page }) => {
  await setup(page)
  await page.goto('/org/departments')
  await page.getByRole('button', { name: '+ Add department' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Manager').selectOption('dana')
  await dialog.getByRole('button', { name: 'Save department' }).click()
  await expect(dialog.getByText('Enter a department name.')).toBeVisible()
  await dialog.getByLabel('Department name').fill('Sales')
  await dialog.getByLabel('Manager').selectOption('')
  await dialog.getByRole('button', { name: 'Save department' }).click()
  await expect(dialog.getByText('Select a manager for this department.')).toBeVisible()
  await dialog.getByLabel('Department name').fill('engineering')
  await dialog.getByLabel('Manager').selectOption('dana')
  await dialog.getByRole('button', { name: 'Save department' }).click()
  await expect(dialog.getByText(/already exists under the top level/)).toBeVisible()
})

test('delete is blocked for a department with members, allowed for an empty one', async ({ page }) => {
  await setup(page)
  await page.goto('/org/departments')
  await page.locator('li', { hasText: 'Engineering' }).getByRole('button', { name: 'Delete' }).click()
  await expect(page.getByRole('dialog').getByText(/Reassign its 1 employee/)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Delete department' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Close' }).click()
  await page.locator('li', { hasText: 'Ops' }).getByRole('button', { name: 'Delete' }).click()
  await expect(page.getByRole('button', { name: 'Delete department' })).toBeVisible()
})

test('clearing an employee manager is rejected inline', async ({ page }) => {
  await setup(page)
  await page.goto('/org/employees-managers')
  await page.getByRole('row', { name: /Liam Ortiz/ }).getByRole('button', { name: 'Edit manager' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('New manager').selectOption('')
  await dialog.getByRole('button', { name: 'Save manager' }).click()
  await expect(dialog.getByText('Select a manager for this employee.')).toBeVisible()
})

test('org chart shows a direct report beneath their manager', async ({ page }) => {
  await setup(page, 'employee')
  await page.goto('/org/chart')
  await expect(page.locator('li', { hasText: 'Dana Whitfield' }).first().locator('li', { hasText: 'Priya Natarajan' })).toBeVisible()
})
