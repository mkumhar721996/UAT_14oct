import { useCallback, useState } from 'react'
import { AddExpensePanel } from '../components/AddExpensePanel'
import { Banner } from '../components/Banner'
import { Layout } from '../components/Layout'
import { SpendChart } from '../components/SpendChart'
import { apiClient } from '../lib/apiClient'
import { useAuth } from '../lib/auth'
import {
  CURRENCIES, categoryOptions, currentMonth, filterExpenses, fmtAmount, fmtExpenseDate, fmtMonth, loadCurrency,
  monthOptions, saveCurrency, spendByCategory, totalCents, type Currency,
} from '../lib/expenses'
import type { Expense } from '../lib/types'
import { useAsync } from '../lib/useAsync'

const CURRENCY_LABELS: Record<Currency, string> = { USD: 'USD ($)', EUR: 'EUR (€)', INR: 'INR (₹)' }

export default function ExpensesPage() {
  const auth = useAuth()
  const sub = auth?.sub ?? ''
  const { data, error, loading, reload } = useAsync(() => apiClient.get<Expense[]>('/expenses'))
  const [category, setCategory] = useState('all')
  const [month, setMonth] = useState(currentMonth)
  const [search, setSearch] = useState('')
  const [currency, setCurrency] = useState<Currency>(() => loadCurrency(sub))
  const [adding, setAdding] = useState(false)
  const closePanel = useCallback(() => setAdding(false), [])

  const changeCurrency = (c: Currency) => {
    setCurrency(c)
    saveCurrency(sub, c)
  }
  const money = (cents: number) => fmtAmount(cents, currency)

  const addButton = (
    <button type="button" className="btn btn-primary" onClick={() => setAdding(true)}>
      Add expense
    </button>
  )
  const hasExpenses = !!data && data.length > 0

  let body
  if (error) {
    body = (
      <div className="stack">
        <Banner kind="danger" title="The expenses could not be loaded.">
          <span>Check your connection and try again.</span>
        </Banner>
        <div>
          <button type="button" className="btn btn-secondary" onClick={reload}>
            Try again
          </button>
        </div>
      </div>
    )
  } else if (loading || !data) {
    body = (
      <div className="state-box" aria-busy="true">
        <p>Loading expenses…</p>
        <div className="skeleton skeleton-line" style={{ width: '100%' }} />
        <div className="skeleton skeleton-line" style={{ width: '100%' }} />
        <div className="skeleton skeleton-line" style={{ width: '100%' }} />
      </div>
    )
  } else if (data.length === 0) {
    body = (
      <div className="state-box">
        <strong>No expenses recorded yet.</strong>
        <p className="text-muted">Add your first expense to start tracking what you spend.</p>
        {addButton}
      </div>
    )
  } else {
    const inMonth = filterExpenses(data, { category: 'all', month, search: '' })
    const rows = filterExpenses(data, { category, month, search })
    const spend = spendByCategory(inMonth)
    const periodLabel = month === 'all' ? 'all months' : fmtMonth(month)
    const total = money(totalCents(inMonth))
    const clearFilters = () => {
      setCategory('all')
      setMonth('all')
      setSearch('')
    }
    body = (
      <div className="stack">
        <p className="text-muted" aria-live="polite">
          {periodLabel === 'all months' ? 'All months' : periodLabel} total spent <strong data-testid="month-total">{total}</strong>
        </p>
        <div className="top-cards">
          <div className="card grow">
            <h2 className="heading-md">Spend by category</h2>
            <SpendChart data={spend} periodLabel={periodLabel} format={money} />
          </div>
          <div className="card total-card">
            <h2 className="heading-md">Total spent</h2>
            <span className="amount">{total}</span>
            <span className="text-muted">
              {inMonth.length} {inMonth.length === 1 ? 'expense' : 'expenses'} in {spend.length}{' '}
              {spend.length === 1 ? 'category' : 'categories'}
            </span>
          </div>
        </div>
        <div className="filters">
          <input
            type="search"
            className="input"
            aria-label="Search merchant or note"
            placeholder="Search merchant or note"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select className="select" aria-label="Category" value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="all">All categories</option>
            {categoryOptions(data).map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <select className="select" aria-label="Month" value={month} onChange={(e) => setMonth(e.target.value)}>
            <option value="all">All months</option>
            {monthOptions(data, currentMonth()).map((m) => (
              <option key={m} value={m}>
                {fmtMonth(m)}
              </option>
            ))}
          </select>
          <select
            className="select"
            aria-label="Currency"
            title="Changes how amounts are shown; amounts are not converted"
            value={currency}
            onChange={(e) => changeCurrency(e.target.value as Currency)}
          >
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {CURRENCY_LABELS[c]}
              </option>
            ))}
          </select>
        </div>
        <p className="sr-only" role="status">
          {rows.length} {rows.length === 1 ? 'expense' : 'expenses'} shown
        </p>
        {rows.length === 0 ? (
          <div className="state-box">
            <strong>No expenses match these filters</strong>
            <p className="text-muted">Choose All categories or All months to widen the list.</p>
            <button type="button" className="btn btn-secondary" onClick={clearFilters}>
              Clear filters
            </button>
          </div>
        ) : (
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Merchant</th>
                  <th>Category</th>
                  <th>Note</th>
                  <th className="num">Amount</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((x) => (
                  <tr key={x.id}>
                    <td className="when">{fmtExpenseDate(x.expenseDate)}</td>
                    <td>{x.merchant}</td>
                    <td>
                      <span className="chip chip-neutral">{x.category}</span>
                    </td>
                    <td>{x.note}</td>
                    <td className="num">{money(totalCents([x]))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    )
  }

  return (
    <Layout title="Expenses" actions={hasExpenses && !error ? addButton : undefined}>
      {body}
      {adding && <AddExpensePanel onClose={closePanel} />}
    </Layout>
  )
}
