import type { CoreField } from './types'

type DatePartOrder = 'month-day-year' | 'day-month-year'

export function formatDate(
  value?: string | null,
  opts: { order?: DatePartOrder } = {},
): string {
  if (!value) return '—'
  const date = new Date(value.length === 10 ? `${value}T00:00:00` : value)
  const parts =
    opts.order === 'day-month-year'
      ? ({ day: 'numeric', month: 'short', year: 'numeric' } as const)
      : ({ month: 'short', day: 'numeric', year: 'numeric' } as const)
  return date.toLocaleDateString('en-US', parts)
}

/** Same day/month/year formatting as `formatDate`, used by the employee-profile feature. */
export const fmtDate = (iso: string) => formatDate(iso, { order: 'day-month-year' })

export function money(
  value?: number | string | null,
  opts: { placeholder?: string | null } = {},
): string | null {
  if (value === null || value === undefined || value === '') return opts.placeholder ?? '—'
  return `$${Number(value).toLocaleString('en-US')}`
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
  v === null || v === undefined || v === '' ? null : field === 'salary' ? money(v, { placeholder: null }) : String(v)
