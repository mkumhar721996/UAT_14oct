import type { Expense } from './types'

export type { Expense }

export const CURRENCIES = ['USD', 'EUR', 'INR'] as const
export type Currency = (typeof CURRENCIES)[number]

const currencyKey = (sub: string) => `arc.expenses.currency.${sub}`

export const loadCurrency = (sub: string): Currency => {
  const saved = localStorage.getItem(currencyKey(sub))
  return CURRENCIES.find((c) => c === saved) ?? 'USD'
}

export const saveCurrency = (sub: string, currency: Currency): void => localStorage.setItem(currencyKey(sub), currency)

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

/** "12.50" -> 1250. Money is kept as integer cents to avoid float drift. */
export const toCents = (amount: string): number => Math.round(Number(amount) * 100)

export const fmtAmount = (cents: number, currency: Currency = 'USD'): string =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(cents / 100)

/** "2026-11-04" -> "4 Nov 2026"; string-based so no timezone can shift the day. */
export const fmtExpenseDate = (iso: string): string => {
  const [y, m, d] = iso.split('-')
  return `${Number(d)} ${MONTHS[Number(m) - 1].slice(0, 3)} ${y}`
}

export const monthOf = (isoDate: string): string => isoDate.slice(0, 7)

export const currentMonth = (now = new Date()): string =>
  `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

export const fmtMonth = (ym: string): string => {
  const [y, m] = ym.split('-')
  return `${MONTHS[Number(m) - 1]} ${y}`
}

/** The current month plus every month with an expense, newest first. */
export const monthOptions = (all: Expense[], current: string): string[] =>
  [...new Set([current, ...all.map((x) => monthOf(x.expenseDate))])].sort().reverse()

export const categoryOptions = (all: Expense[]): string[] => [...new Set(all.map((x) => x.category))].sort()

export const filterExpenses = (all: Expense[], f: { category: string; month: string; search: string }): Expense[] => {
  const q = f.search.trim().toLowerCase()
  return all.filter(
    (x) =>
      (f.month === 'all' || monthOf(x.expenseDate) === f.month) &&
      (f.category === 'all' || x.category === f.category) &&
      (!q || `${x.merchant} ${x.note ?? ''}`.toLowerCase().includes(q)),
  )
}

export const totalCents = (rows: Expense[]): number => rows.reduce((sum, x) => sum + toCents(x.amount), 0)

export const spendByCategory = (rows: Expense[]): { category: string; cents: number }[] => {
  const totals = new Map<string, number>()
  rows.forEach((x) => totals.set(x.category, (totals.get(x.category) ?? 0) + toCents(x.amount)))
  return [...totals].map(([category, cents]) => ({ category, cents })).sort((a, b) => b.cents - a.cents)
}
