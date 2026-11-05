import { describe, expect, it } from 'vitest'
import { validateExpense } from './expenseFields'
import { fmtAmount, fmtExpenseDate } from './format'

const ok = { amount: '12.50', date: '2026-11-01', merchant: 'Corner Shop', category: 'Food', note: '' }
const today = new Date('2026-11-05T12:00:00')

describe('validateExpense', () => {
  it('accepts a valid draft, with no merchant, and 0.01', () => {
    expect(validateExpense(ok, today)).toEqual({})
    expect(validateExpense({ ...ok, merchant: '' }, today)).toEqual({})
    expect(validateExpense({ ...ok, amount: '0.01' }, today).amount).toBeUndefined()
  })
  it('accepts a comma as the decimal point', () => {
    expect(validateExpense({ ...ok, amount: '12,50' }, today).amount).toBeUndefined()
  })
  it('rejects a missing amount, zero and non-numbers', () => {
    expect(validateExpense({ ...ok, amount: '' }, today).amount).toBe('Enter an amount.')
    expect(validateExpense({ ...ok, amount: '0' }, today).amount).toBe('Amount must be more than 0.00.')
    expect(validateExpense({ ...ok, amount: 'abc' }, today).amount).toBe('Enter an amount as a number, like 12.50.')
    expect(validateExpense({ ...ok, amount: '1.234' }, today).amount).toBe('Enter an amount as a number, like 12.50.')
  })
  it('rejects a missing date and a date after today, accepts today', () => {
    expect(validateExpense({ ...ok, date: '' }, today).date).toBe('Enter a date.')
    expect(validateExpense({ ...ok, date: '2026-11-06' }, today).date).toBe('Date can’t be after today (5 Nov 2026).')
    expect(validateExpense({ ...ok, date: '2026-11-05' }, today).date).toBeUndefined()
  })
  it('rejects a missing category', () => {
    expect(validateExpense({ ...ok, category: '' }, today).category).toBe('Choose a category.')
  })
})

describe('expense formatting', () => {
  it('formats amounts in the given currency and dates as d Mon yyyy', () => {
    expect(fmtAmount('12.50', 'EUR')).toBe('€12.50')
    expect(fmtExpenseDate('2026-11-01')).toBe('1 Nov 2026')
  })
})
