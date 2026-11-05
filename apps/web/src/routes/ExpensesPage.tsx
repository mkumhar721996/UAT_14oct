import { useRef, useState } from 'react'
import { AddExpensePanel } from '../components/AddExpensePanel'
import { Banner } from '../components/Banner'
import { Layout } from '../components/Layout'
import { useToast } from '../components/Toast'
import { apiClient } from '../lib/apiClient'
import { fmtAmount, fmtExpenseDate } from '../lib/format'
import type { Expense, ExpenseList } from '../lib/types'
import { useAsync } from '../lib/useAsync'

export default function ExpensesPage() {
  const { data, error, reload } = useAsync(() => apiClient.get<ExpenseList>('/expenses'))
  const [adding, setAdding] = useState(false)
  const addButton = useRef<HTMLButtonElement>(null)
  const toast = useToast()

  const close = () => {
    setAdding(false)
    // The panel unmounts on close; hand focus back to the button that opened it.
    setTimeout(() => addButton.current?.focus())
  }
  const onSaved = (e: Expense) => {
    close()
    reload()
    toast(`Expense added: ${fmtAmount(e.amount, e.currency)}${e.merchant ? ` at ${e.merchant}` : ''}`)
  }

  const currency = data?.currency ?? 'USD'
  const expenses = data?.expenses ?? []
  const showTable = !error && (!data || expenses.length > 0)
  return (
    <Layout
      title="Expenses"
      actions={
        <button ref={addButton} type="button" className="btn btn-primary" aria-haspopup="dialog" onClick={() => setAdding(true)}>
          Add expense
        </button>
      }
    >
      {error && (
        <Banner kind="danger" title="Couldn’t load expenses">
          {error.message}
        </Banner>
      )}
      {!error && data && expenses.length === 0 && <div className="empty-state">No expenses yet. Select Add expense to record one.</div>}
      {showTable && (
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
              {!data
                ? [0, 1, 2].map((i) => (
                    <tr key={i} className="skeleton-row">
                      <td colSpan={5}>Loading…</td>
                    </tr>
                  ))
                : expenses.map((e) => (
                    <tr key={e.id}>
                      <td>{fmtExpenseDate(e.spentOn)}</td>
                      <td>{e.merchant ?? <span className="text-muted">—</span>}</td>
                      <td>
                        <span className="chip chip-neutral">{e.category}</span>
                      </td>
                      <td>{e.note}</td>
                      <td className="num">{fmtAmount(e.amount, e.currency)}</td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>
      )}
      {adding && <AddExpensePanel currency={currency} onClose={close} onSaved={onSaved} />}
    </Layout>
  )
}
