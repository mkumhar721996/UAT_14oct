import type { CoreField } from './types'

export const fmtMoney = (n: number | string | null | undefined) =>
  n === null || n === undefined || n === '' ? null : '$' + Number(n).toLocaleString('en-US')

export const fmtDate = (iso: string) =>
  new Date(iso.slice(0, 10) + 'T00:00:00').toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })

export const fmtDateTime = (iso: string) => {
  const d = new Date(iso)
  return (
    d.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }) +
    ', ' +
    d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  )
}

/** Display text for a stored core-field value; salary is stored as a plain number string. */
export const fmtFieldValue = (field: CoreField, v: string | number | null | undefined) =>
  v === null || v === undefined || v === '' ? null : field === 'salary' ? fmtMoney(v) : String(v)
