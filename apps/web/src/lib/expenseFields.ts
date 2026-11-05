import { fmtExpenseDate } from './format'

export const EXPENSE_CATEGORIES = ['Food', 'Travel', 'Other'] as const

export interface ExpenseDraft {
  amount: string
  date: string
  merchant: string
  category: string
  note: string
}

export type ExpenseErrors = { amount?: string; date?: string; category?: string }

const localIso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

/** Parses an amount typed with a point or comma decimal separator; null when it is not a plain number with at most 2 decimals. */
export const parseAmount = (raw: string): number | null => {
  const s = raw.trim().replace(',', '.')
  return /^\d+(\.\d{1,2})?$/.test(s) ? Number(s) : null
}

export function validateExpense(d: ExpenseDraft, today: Date): ExpenseErrors {
  const errors: ExpenseErrors = {}
  if (!d.amount.trim()) errors.amount = 'Enter an amount.'
  else {
    const amount = parseAmount(d.amount)
    if (amount === null) errors.amount = 'Enter an amount as a number, like 12.50.'
    else if (amount <= 0) errors.amount = 'Amount must be more than 0.00.'
  }
  if (!d.date) errors.date = 'Enter a date.'
  else if (d.date > localIso(today)) errors.date = `Date can’t be after today (${fmtExpenseDate(localIso(today))}).`
  if (!d.category) errors.category = 'Choose a category.'
  return errors
}
