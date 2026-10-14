import { CORE_FIELDS, CORE_FIELD_LABELS } from '../lib/fields'
import { fmtFieldValue } from '../lib/format'
import type { Employee } from '../lib/types'

export function ActiveGrid({ employee }: { employee: Employee }) {
  return (
    <div className="active-grid">
      {CORE_FIELDS.map((f) => (
        <div className="active-cell" key={f}>
          <div className="label">{CORE_FIELD_LABELS[f]}</div>
          <div className="value">{fmtFieldValue(f, employee[f]) ?? 'Not set'}</div>
        </div>
      ))}
    </div>
  )
}
