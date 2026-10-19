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

export function StatusChip({ status }: { status: string }) {
  return <span className="chip chip-neutral">{status}</span>
}
