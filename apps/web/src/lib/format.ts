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
