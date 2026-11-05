import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Banner } from './Banner'
import { apiClient } from '../lib/apiClient'
import { EXPENSE_CATEGORIES, parseAmount, validateExpense, type ExpenseDraft, type ExpenseErrors } from '../lib/expenseFields'
import type { Expense } from '../lib/types'

const EMPTY: ExpenseDraft = { amount: '', date: '', merchant: '', category: '', note: '' }
const REQUIRED_FIELDS = ['amount', 'date', 'category'] as const
const FOCUSABLE = 'button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])'

/** Right-hand panel over the Expenses list. Mounted only while open, so its form is blank each time it opens. */
export function AddExpensePanel({
  currency,
  onClose,
  onSaved,
}: {
  currency: string
  onClose: () => void
  onSaved: (expense: Expense) => void
}) {
  const [draft, setDraft] = useState<ExpenseDraft>(EMPTY)
  const [errors, setErrors] = useState<ExpenseErrors>({})
  const [serverError, setServerError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [failedSaves, setFailedSaves] = useState(0)
  const panelRef = useRef<HTMLElement>(null)
  const summaryRef = useRef<HTMLDivElement>(null)
  const amountRef = useRef<HTMLInputElement>(null)

  useEffect(() => amountRef.current?.focus(), [])
  useEffect(() => {
    if (failedSaves > 0) summaryRef.current?.focus()
  }, [failedSaves])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') return onClose()
      if (e.key !== 'Tab' || !panelRef.current) return
      const items = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE))
      if (!items.length) return
      const first = items[0]
      const last = items[items.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const set = (k: keyof ExpenseDraft) => (v: string) => {
    setDraft((d) => ({ ...d, [k]: v }))
    if (k in errors) setErrors((e) => ({ ...e, [k]: undefined }))
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setServerError(null)
    const found = validateExpense(draft, new Date())
    setErrors(found)
    if (Object.keys(found).length) {
      setFailedSaves((n) => n + 1)
      return
    }
    const body: Record<string, string | number> = { amount: parseAmount(draft.amount)!, date: draft.date }
    if (draft.merchant.trim()) body.merchant = draft.merchant.trim()
    body.category = draft.category
    if (draft.note.trim()) body.note = draft.note.trim()
    setSaving(true)
    try {
      onSaved(await apiClient.post<Expense>('/expenses', body))
    } catch (err) {
      setServerError((err as Error).message)
      setSaving(false)
    }
  }

  const failing = REQUIRED_FIELDS.filter((k) => errors[k])
  const summary = failing.length
    ? `Fix the ${failing.join(', ').replace(/, (?!.*,)/, ' and ')} ${failing.length > 1 ? 'fields' : 'field'} to save this expense.`
    : null
  const describedBy = (k: keyof ExpenseErrors, hint?: string) => [errors[k] && `exp-${k}-error`, hint].filter(Boolean).join(' ') || undefined
  const fieldError = (k: keyof ExpenseErrors) =>
    errors[k] && (
      <div className="field-error" id={`exp-${k}-error`}>
        {errors[k]}
      </div>
    )

  return (
    <>
      <div className="expense-backdrop" onClick={onClose} />
      <aside ref={panelRef} className="expense-drawer" role="dialog" aria-modal="true" aria-labelledby="add-title">
        <div className="expense-drawer-header">
          <h2 className="heading-lg" id="add-title">
            Add expense
          </h2>
          <button type="button" className="btn btn-secondary" aria-label="Close add expense panel" onClick={onClose}>
            ✕
          </button>
        </div>
        <div ref={summaryRef} tabIndex={-1}>
          {summary && (
            <Banner kind="danger" title="Can’t save this expense">
              {summary}
            </Banner>
          )}
          {serverError && (
            <Banner kind="danger" title="Couldn’t save this expense">
              {serverError}
            </Banner>
          )}
        </div>
        <form onSubmit={onSubmit} noValidate style={{ display: 'contents' }}>
          <div className={'field' + (errors.amount ? ' has-error' : '')}>
            <label className="field-label" htmlFor="exp-amount">
              Amount
            </label>
            <div className="expense-amount-row">
              <input
                ref={amountRef}
                className={'input' + (errors.amount ? ' has-error' : '')}
                id="exp-amount"
                type="text"
                inputMode="decimal"
                value={draft.amount}
                aria-invalid={!!errors.amount}
                aria-describedby={describedBy('amount', 'exp-amount-hint')}
                onChange={(e) => set('amount')(e.target.value)}
              />
              <span className="expense-currency">{currency}</span>
            </div>
            <div className="field-hint" id="exp-amount-hint">
              In your profile currency, {currency}.
            </div>
            {fieldError('amount')}
          </div>
          <div className={'field' + (errors.date ? ' has-error' : '')}>
            <label className="field-label" htmlFor="exp-date">
              Date
            </label>
            <input
              className={'input' + (errors.date ? ' has-error' : '')}
              id="exp-date"
              type="date"
              value={draft.date}
              aria-invalid={!!errors.date}
              aria-describedby={describedBy('date')}
              onChange={(e) => set('date')(e.target.value)}
            />
            {fieldError('date')}
          </div>
          <div className="field">
            <label className="field-label" htmlFor="exp-merchant">
              Merchant (optional)
            </label>
            <input className="input" id="exp-merchant" type="text" value={draft.merchant} onChange={(e) => set('merchant')(e.target.value)} />
          </div>
          <div className={'field' + (errors.category ? ' has-error' : '')}>
            <label className="field-label" htmlFor="exp-category">
              Category
            </label>
            <select
              className={'select' + (errors.category ? ' has-error' : '')}
              id="exp-category"
              value={draft.category}
              aria-invalid={!!errors.category}
              aria-describedby={describedBy('category')}
              onChange={(e) => set('category')(e.target.value)}
            >
              <option value="">Select a category</option>
              {EXPENSE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            {fieldError('category')}
          </div>
          <div className="field">
            <label className="field-label" htmlFor="exp-note">
              Note (optional)
            </label>
            <textarea className="textarea" id="exp-note" value={draft.note} onChange={(e) => set('note')(e.target.value)} />
          </div>
          <div className="expense-drawer-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving…' : 'Save expense'}
            </button>
          </div>
        </form>
      </aside>
    </>
  )
}
