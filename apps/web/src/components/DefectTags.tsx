import { SEVERITY_META } from '../lib/defectFields'
import type { DefectSeverity } from '../lib/types'

export function SeverityTag({ severity }: { severity: DefectSeverity }) {
  const meta = SEVERITY_META[severity]
  return (
    <span className={`severity-tag ${meta.className}`}>
      <span aria-hidden="true">{meta.icon}</span>
      {severity}
    </span>
  )
}

const STATUS_CHIP_CLASS: Record<string, string> = {
  New: 'chip-neutral',
  Triaged: 'chip-warning',
  Assigned: 'chip-warning',
  'In Progress': 'chip-warning',
  Resolved: 'chip-success',
  Verified: 'chip-success',
  Closed: 'chip-neutral',
  Reopened: 'chip-danger',
}

export function StatusChip({ status }: { status: string }) {
  return <span className={`chip ${STATUS_CHIP_CLASS[status] ?? 'chip-neutral'}`}>{status}</span>
}
