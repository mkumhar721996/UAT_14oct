import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mockApi, renderAt, signIn } from '../test/helpers'
import ExpensesPage from './ExpensesPage'

const existing = { id: 'e0', amount: '4.00', currency: 'EUR', spentOn: '2026-10-20', merchant: 'Old Cafe', category: 'Food', note: null }
const created = { id: 'e1', amount: '12.50', currency: 'EUR', spentOn: '2026-11-01', merchant: 'Corner Shop', category: 'Food', note: 'Lunch' }

describe('ExpensesPage add panel', () => {
  let api: ReturnType<typeof mockApi>
  let posted = false
  beforeEach(() => {
    signIn('employee')
    posted = false
    api = mockApi({
      'GET /expenses': () => ({ currency: 'EUR', expenses: posted ? [created, existing] : [existing] }),
      'POST /expenses': () => {
        posted = true
        return created
      },
    })
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    localStorage.clear()
  })
  const posts = () => api.mock.calls.filter(([, init]) => init?.method === 'POST')
  const gets = () => api.mock.calls.filter(([, init]) => (init?.method ?? 'GET') === 'GET')
  const open = async () => {
    renderAt(<ExpensesPage />, '/expenses', '/expenses')
    fireEvent.click(await screen.findByRole('button', { name: 'Add expense' }))
  }
  const fill = (v: Partial<Record<'amount' | 'date' | 'merchant' | 'category' | 'note', string>> = {}) => {
    const values = { amount: '12.50', date: '2026-11-01', merchant: 'Corner Shop', category: 'Food', note: 'Lunch', ...v }
    fireEvent.change(screen.getByLabelText(/^amount/i), { target: { value: values.amount } })
    fireEvent.change(screen.getByLabelText(/^date/i), { target: { value: values.date } })
    fireEvent.change(screen.getByLabelText(/^merchant/i), { target: { value: values.merchant } })
    fireEvent.change(screen.getByLabelText(/^category/i), { target: { value: values.category } })
    fireEvent.change(screen.getByLabelText(/^note/i), { target: { value: values.note } })
  }
  const save = () => fireEvent.click(screen.getByRole('button', { name: 'Save expense' }))
  const closed = () => waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  const inField = (label: RegExp) => within(screen.getByLabelText(label).closest('.field') as HTMLElement)

  it('AC1: Add expense opens the panel over the list', async () => {
    renderAt(<ExpensesPage />, '/expenses', '/expenses')
    const btn = await screen.findByRole('button', { name: 'Add expense' })
    expect(screen.queryByRole('dialog')).toBeNull()
    fireEvent.click(btn)
    expect(screen.getByRole('dialog', { name: 'Add expense' })).toBeInTheDocument()
    expect(screen.getByRole('table')).toBeInTheDocument()
  })

  it('AC2: shows Amount, Date, Merchant, Category and Note, with the profile currency', async () => {
    await open()
    for (const l of [/^amount/i, /^date/i, /^merchant/i, /^category/i, /^note/i]) expect(screen.getByLabelText(l)).toBeInTheDocument()
    expect(screen.getByText('In your profile currency, EUR.')).toBeInTheDocument()
  })

  it('AC3: category offers Food, Travel and Other', async () => {
    await open()
    const opts = screen.getAllByRole('option', { name: /^(Food|Travel|Other)$/ }).map((o) => o.textContent)
    expect(opts).toEqual(['Food', 'Travel', 'Other'])
  })

  it('AC4: the list shows amounts in the profile currency', async () => {
    renderAt(<ExpensesPage />, '/expenses', '/expenses')
    expect(await screen.findByText('€4.00')).toBeInTheDocument()
  })

  it('AC5/AC6: saving closes the panel, posts the body, reloads the list and toasts', async () => {
    await open()
    fill()
    save()
    await closed()
    expect(JSON.parse(posts()[0][1]!.body as string)).toEqual({ amount: 12.5, date: '2026-11-01', merchant: 'Corner Shop', category: 'Food', note: 'Lunch' })
    expect(await screen.findByText('1 Nov 2026')).toBeInTheDocument()
    expect(screen.getAllByText('Corner Shop').length).toBeGreaterThan(0)
    expect(gets()).toHaveLength(2)
    expect(screen.getByText('Expense added: €12.50 at Corner Shop')).toBeInTheDocument()
  })

  it.each([
    ['Cancel', () => fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))],
    ['close icon', () => fireEvent.click(screen.getByRole('button', { name: 'Close add expense panel' }))],
    ['Escape', () => fireEvent.keyDown(document, { key: 'Escape' })],
    ['backdrop', () => fireEvent.click(document.querySelector('.expense-backdrop')!)],
  ])('AC7/AC8: %s closes the panel and saves nothing, and a reopened panel is blank', async (_n, close) => {
    await open()
    fill()
    close()
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.queryByText('Corner Shop')).toBeNull()
    expect(posts()).toHaveLength(0)
    fireEvent.click(screen.getByRole('button', { name: 'Add expense' }))
    expect(screen.getByLabelText(/^amount/i)).toHaveValue('')
  })

  it('AC9/AC10: a date after today is refused next to Date; today is accepted', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-11-05T12:00:00'))
    await open()
    fill({ date: '2026-11-06' })
    save()
    const msg = await screen.findByText('Date can’t be after today (5 Nov 2026).')
    expect(inField(/^date/i).getByText(/can’t be after today/)).toBe(msg)
    expect(posts()).toHaveLength(0)
    fill({ date: '2026-11-05' })
    save()
    await closed()
  })

  it('AC11: no merchant is fine and the body omits it', async () => {
    await open()
    fill({ merchant: '', note: '' })
    save()
    await closed()
    const body = JSON.parse(posts()[0][1]!.body as string)
    expect(body).not.toHaveProperty('merchant')
    expect(body).not.toHaveProperty('note')
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it.each([
    ['AC12', { amount: '' }, /^amount/i, 'Enter an amount.'],
    ['AC13', { amount: '0' }, /^amount/i, 'Amount must be more than 0.00.'],
    ['AC15', { date: '' }, /^date/i, 'Enter a date.'],
    ['AC16', { category: '' }, /^category/i, 'Choose a category.'],
  ])('%s: shows a message next to the field and sends nothing', async (_ac, values, label, message) => {
    await open()
    fill(values)
    save()
    const msg = await screen.findByText(message)
    expect(inField(label).getByText(message)).toBe(msg)
    expect(posts()).toHaveLength(0)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('AC14: 0.01 is accepted', async () => {
    await open()
    fill({ amount: '0.01' })
    save()
    await closed()
    expect(JSON.parse(posts()[0][1]!.body as string).amount).toBe(0.01)
  })

  it('keeps the panel open and shows the server error when saving fails', async () => {
    vi.unstubAllGlobals()
    api = mockApi({ 'GET /expenses': { currency: 'EUR', expenses: [] }, 'POST /expenses': { __mockStatus: 500, message: 'Boom' } })
    await open()
    fill()
    save()
    expect(await screen.findByText('Boom')).toBeInTheDocument()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })
})
