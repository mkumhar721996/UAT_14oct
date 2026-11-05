import { afterEach, describe, expect, it } from 'vitest'
import {
  categoryOptions, currentMonth, filterExpenses, fmtAmount, fmtExpenseDate, fmtMonth, loadCurrency,
  monthOf, monthOptions, saveCurrency, spendByCategory, toCents, totalCents, type Expense,
} from './expenses'

const e = (id: string, amount: string, expenseDate: string, category: string, merchant = 'Shop', note: string | null = null): Expense => ({
  id, amount, expenseDate, category, merchant, note,
})
const all = [
  e('food-3-may', '12.50', '2026-05-03', 'Food', 'Cafe'),
  e('travel-5-may', '5.00', '2026-05-05', 'Travel', 'Train', 'to work'),
  e('food-28-apr', '8.00', '2026-04-28', 'Food', 'Deli'),
]

afterEach(() => localStorage.clear())

describe('expenses helpers', () => {
  it('AC4: totals in cents and formats as USD', () => {
    expect(toCents('12.50')).toBe(1250)
    expect(fmtAmount(totalCents([e('a', '12.50', '2026-05-01', 'Food'), e('b', '7.50', '2026-05-02', 'Food')]))).toBe('$20.00')
  })
  it('AC5: spend by category, largest first', () => {
    expect(spendByCategory([e('a', '5', '2026-05-01', 'Travel'), e('b', '20', '2026-05-02', 'Food')])).toEqual([
      { category: 'Food', cents: 2000 },
      { category: 'Travel', cents: 500 },
    ])
  })
  it('AC6-8: filters by category and month', () => {
    expect(filterExpenses(all, { category: 'Food', month: 'all', search: '' }).map((x) => x.id)).toEqual(['food-3-may', 'food-28-apr'])
    expect(filterExpenses(all, { category: 'all', month: '2026-05', search: '' }).map((x) => x.id)).toEqual(['food-3-may', 'travel-5-may'])
    expect(filterExpenses(all, { category: 'Food', month: '2026-05', search: '' }).map((x) => x.id)).toEqual(['food-3-may'])
  })
  it('searches merchant and note', () => {
    expect(filterExpenses(all, { category: 'all', month: 'all', search: 'WORK' }).map((x) => x.id)).toEqual(['travel-5-may'])
  })
  it('adds decimals without floating-point drift', () => {
    expect(totalCents([e('a', '0.10', '2026-05-01', 'Food'), e('b', '0.20', '2026-05-01', 'Food')])).toBe(30)
    expect(totalCents([])).toBe(0)
  })

  it('filter preserves order and does not shift days across month ends', () => {
    const rows = [e('a', '1', '2026-05-01', 'Food'), e('b', '1', '2026-04-30', 'Food')]
    expect(filterExpenses(rows, { category: 'all', month: 'all', search: '' }).map((x) => x.id)).toEqual(['a', 'b'])
    expect(filterExpenses(rows, { category: 'all', month: '2026-04', search: '' }).map((x) => x.id)).toEqual(['b'])
  })

  it('returns nothing when no row matches', () => {
    expect(filterExpenses(all, { category: 'Rent', month: 'all', search: '' })).toEqual([])
  })

  it('formats dates without zero padding and months across a year end', () => {
    expect(fmtExpenseDate('2026-01-05')).toBe('5 Jan 2026')
    expect(fmtMonth('2025-12')).toBe('December 2025')
    expect(monthOptions([e('a', '1', '2025-12-31', 'Food')], '2026-01')).toEqual(['2026-01', '2025-12'])
  })

  it('AC23-26: all clears the filters', () => {
    expect(filterExpenses(all, { category: 'all', month: 'all', search: '' })).toHaveLength(all.length)
  })
  it('AC19: current month and labels', () => {
    expect(currentMonth(new Date('2026-11-05T12:00:00'))).toBe('2026-11')
    expect(fmtMonth('2026-11')).toBe('November 2026')
    expect(fmtExpenseDate('2026-09-20')).toBe('20 Sep 2026')
    expect(monthOf('2026-05-03')).toBe('2026-05')
  })
  it('lists month and category options', () => {
    expect(monthOptions(all, '2026-11')).toEqual(['2026-11', '2026-05', '2026-04'])
    expect(categoryOptions(all)).toEqual(['Food', 'Travel'])
  })
  it('formats other currencies', () => {
    expect(fmtAmount(2000, 'EUR')).toBe('€20.00')
    expect(fmtAmount(2000, 'INR')).toBe('₹20.00')
  })
  it('remembers the currency per user, defaulting to USD', () => {
    expect(loadCurrency('u1')).toBe('USD')
    saveCurrency('u1', 'INR')
    expect(loadCurrency('u1')).toBe('INR')
    expect(loadCurrency('u2')).toBe('USD')
    localStorage.setItem('arc.expenses.currency.u3', 'GBP')
    expect(loadCurrency('u3')).toBe('USD')
  })
})
