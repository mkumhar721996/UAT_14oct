import type { CoreField } from './types'

export function formatDate(value?: string | null): string {
  if (!value) return '—'
  const date = new Date(value.length === 10 ? `${value}T00:00:00` : value)
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function money(value?: number | null): string {
  return value ? `$${Number(value).toLocaleString('en-US')}` : '—'
}

export function requisitionCode(id: number): string {
  return `REQ-${id}`
}

export function roleLabel(role: string): string {
  const known: Record<string, string> = { hr_admin: 'HR Admin' }
  return (
    known[role] ??
    role
      .split('_')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ')
  )
}

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
