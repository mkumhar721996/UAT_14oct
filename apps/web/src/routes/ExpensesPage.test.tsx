import { fireEvent, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Expense } from '../lib/types'
import { errorResponse, mockApi, renderAt, signIn } from '../test/helpers'
import ExpensesPage from './ExpensesPage'

const ex = (id: string, amount: string, expenseDate: string, category: string, merchant: string, note: string | null = null): Expense => ({
  id, amount, expenseDate, category, merchant, note,
})
const may = [
  ex('1', '12.50', '2026-05-03', 'Food', 'Cafe'),
  ex('2', '7.50', '2026-05-05', 'Food', 'Deli'),
]
const mayFoodTravel = [ex('f', '20.00', '2026-05-03', 'Food', 'Cafe'), ex('t', '5.00', '2026-05-05', 'Travel', 'Cafe-travel')]
const mayAndApril = [...mayFoodTravel, ex('a', '8.00', '2026-04-28', 'Food', 'Deli-april')]

const render = () => renderAt(<ExpensesPage />, '/expenses', '/expenses')
const pick = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } })

describe('ExpensesPage', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-05-15T12:00:00'))
    signIn('employee')
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    localStorage.clear()
  })

  it('AC1/AC2: shows the sidebar and top bar', async () => {
    mockApi({ 'GET /expenses': may })
    const { container } = render()
    expect(await screen.findByRole('navigation', { name: 'Main' })).toBeInTheDocument()
    expect(container.querySelector('.topbar')).not.toBeNull()
    expect(screen.getByRole('button', { name: 'Add expense' })).toBeInTheDocument()
  })

  it('AC3: rows are listed in the API order, newest first', async () => {
    mockApi({ 'GET /expenses': [ex('a', '1', '2026-11-01', 'Food', 'm1'), ex('b', '1', '2026-10-10', 'Food', 'm2'), ex('c', '1', '2026-09-20', 'Food', 'm3')] })
    render()
    await screen.findByTestId('month-total')
    pick('Month', 'all')
    const rows = (await screen.findAllByRole('row')).slice(1)
    expect(rows.map((r) => within(r).getAllByRole('cell')[0].textContent)).toEqual(['1 Nov 2026', '10 Oct 2026', '20 Sep 2026'])
  })

  it('AC14-AC17: a row shows date, merchant, category and amount', async () => {
    mockApi({ 'GET /expenses': [ex('1', '12.50', '2026-05-03', 'Food', 'Cafe')] })
    render()
    const cells = within((await screen.findAllByRole('row'))[1]).getAllByRole('cell')
    expect(cells.map((c) => c.textContent)).toEqual(['3 May 2026', 'Cafe', 'Food', '', '$12.50'])
  })

  it('AC4: month total sums the month', async () => {
    mockApi({ 'GET /expenses': may })
    render()
    expect(await screen.findByTestId('month-total')).toHaveTextContent('$20.00')
  })

  it('AC5/AC18: chart follows the selected month', async () => {
    mockApi({ 'GET /expenses': mayAndApril })
    render()
    expect(await screen.findByRole('img', { name: /Food \$20\.00, Travel \$5\.00/ })).toBeInTheDocument()
    pick('Month', '2026-04')
    expect(screen.getByRole('img', { name: /Food \$8\.00/ })).toBeInTheDocument()
    expect(screen.getByRole('img').getAttribute('aria-label')).not.toContain('$20.00')
  })

  it('AC6: category filter', async () => {
    mockApi({ 'GET /expenses': mayFoodTravel })
    render()
    await screen.findByText('Cafe-travel')
    pick('Category', 'Food')
    expect(screen.queryByText('Cafe-travel')).not.toBeInTheDocument()
    expect(screen.getByText('Cafe')).toBeInTheDocument()
  })

  it('AC7: month filter', async () => {
    mockApi({ 'GET /expenses': mayAndApril })
    render()
    await screen.findByText('Cafe')
    expect(screen.queryByText('Deli-april')).not.toBeInTheDocument()
  })

  it('AC8: category and month together', async () => {
    mockApi({ 'GET /expenses': mayAndApril })
    render()
    await screen.findByText('Cafe')
    pick('Category', 'Food')
    expect(screen.getByText('Cafe')).toBeInTheDocument()
    expect(screen.queryByText('Cafe-travel')).not.toBeInTheDocument()
    expect(screen.queryByText('Deli-april')).not.toBeInTheDocument()
  })

  it('AC22: no match shows the message; Clear filters resets category, month and search', async () => {
    mockApi({ 'GET /expenses': mayAndApril })
    render()
    await screen.findByText('Cafe')
    pick('Month', '2026-04')
    pick('Category', 'Travel')
    expect(screen.getByText('No expenses match these filters')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }))
    expect(screen.getByLabelText('Category')).toHaveValue('all')
    expect(screen.getByLabelText('Month')).toHaveValue('all')
    expect(screen.getByText('Deli-april')).toBeInTheDocument()
  })

  it('searches merchant and note', async () => {
    mockApi({ 'GET /expenses': mayFoodTravel })
    render()
    await screen.findByText('Cafe')
    fireEvent.change(screen.getByLabelText('Search merchant or note'), { target: { value: 'travel' } })
    expect(screen.queryByRole('cell', { name: 'Cafe' })).not.toBeInTheDocument()
    expect(screen.getByText('Cafe-travel')).toBeInTheDocument()
  })

  it('AC23/AC24: All categories re-lists both', async () => {
    mockApi({ 'GET /expenses': mayFoodTravel })
    render()
    await screen.findByText('Cafe')
    pick('Category', 'Food')
    pick('Category', 'all')
    expect(screen.getByText('Cafe')).toBeInTheDocument()
    expect(screen.getByText('Cafe-travel')).toBeInTheDocument()
  })

  it('AC25/AC26: All months lists May and April', async () => {
    mockApi({ 'GET /expenses': mayAndApril })
    render()
    await screen.findByText('Cafe')
    pick('Month', 'all')
    expect(screen.getByText('Cafe')).toBeInTheDocument()
    expect(screen.getByText('Deli-april')).toBeInTheDocument()
  })

  it('AC19: month defaults to the current month even with no expenses in it', async () => {
    vi.setSystemTime(new Date('2026-11-05T12:00:00'))
    mockApi({ 'GET /expenses': may })
    render()
    await screen.findByTestId('month-total')
    expect(screen.getByLabelText('Month')).toHaveValue('2026-11')
    expect(screen.getByRole('option', { name: 'November 2026' })).toHaveProperty('selected', true)
  })

  it('AC9/AC20/AC21: empty state with Add expense opening the panel', async () => {
    mockApi({ 'GET /expenses': [] })
    render()
    expect(await screen.findByText('No expenses recorded yet.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Add expense' }))
    expect(screen.getByRole('dialog', { name: 'Add expense' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('Escape closes the add panel', async () => {
    mockApi({ 'GET /expenses': may })
    render()
    fireEvent.click(await screen.findByRole('button', { name: 'Add expense' }))
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('AC10: shows a loading message while fetching', () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})))
    render()
    expect(screen.getByText('Loading expenses…')).toBeInTheDocument()
  })

  it('AC11/AC12: error banner with Try again, which recovers', async () => {
    let fail = true
    mockApi({ 'GET /expenses': () => (fail ? errorResponse(500, 'boom') : may) })
    render()
    expect(await screen.findByRole('alert')).toBeInTheDocument()
    fail = false
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByRole('cell', { name: 'Cafe' })).toBeInTheDocument()
  })

  it('currency: relabels amounts, is remembered, and is not cleared by Clear filters', async () => {
    mockApi({ 'GET /expenses': mayFoodTravel })
    render()
    await screen.findByTestId('month-total')
    expect(screen.queryByRole('option', { name: /GBP/ })).not.toBeInTheDocument()
    pick('Currency', 'EUR')
    expect(screen.getByTestId('month-total')).toHaveTextContent('€25.00')
    expect(screen.getByRole('img', { name: /Food €20\.00/ })).toBeInTheDocument()
    expect(localStorage.getItem('arc.expenses.currency.test-sub')).toBe('EUR')
    pick('Category', 'Travel')
    pick('Month', '2026-04')
    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }))
    expect(screen.getByLabelText('Currency')).toHaveValue('EUR')
  })

  it('currency: INR shows rupees and a saved INR is preselected', async () => {
    localStorage.setItem('arc.expenses.currency.test-sub', 'INR')
    mockApi({ 'GET /expenses': mayFoodTravel })
    render()
    expect(await screen.findByTestId('month-total')).toHaveTextContent('₹25.00')
    expect(screen.getByLabelText('Currency')).toHaveValue('INR')
  })
})
