import type { ReactNode } from 'react'

const STATUS_CHIP: Record<string, string> = {
  New: 'chip-neutral',
  Triaged: 'chip-warning',
  'In Progress': 'chip-warning',
  Resolved: 'chip-success',
  Closed: 'chip-neutral',
}

export function StatusChip({ status }: { status: string }) {
  return <span className={`chip ${STATUS_CHIP[status] ?? 'chip-neutral'}`}>{status}</span>
}

export function ReadonlyField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="field-readonly">
      <span className="field-readonly-label">{label}</span>
      <span className="field-readonly-value">{children}</span>
    </div>
  )
}
