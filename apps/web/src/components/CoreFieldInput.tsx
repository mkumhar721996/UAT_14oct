import { CONTRACT_TYPES, DEPARTMENTS } from '../lib/fields'
import type { CoreField } from '../lib/types'

const PLACEHOLDERS: Record<'jobTitle' | 'salary', string> = { jobTitle: 'e.g. Product Designer', salary: 'e.g. 95000' }

/** The input control for one of the four core fields: text, select or number depending on the field. */
export function CoreFieldInput({
  field,
  id,
  value,
  onChange,
  allowUnset,
}: {
  field: CoreField
  id: string
  value: string
  onChange: (v: string) => void
  allowUnset: boolean
}) {
  if (field === 'department' || field === 'contractType') {
    const options = field === 'department' ? DEPARTMENTS : CONTRACT_TYPES
    const isKnownValue = value === '' || (options as string[]).includes(value)
    return (
      <select className="select" id={id} value={value} onChange={(e) => onChange(e.target.value)}>
        {allowUnset && <option value="">Not set</option>}
        {!allowUnset && <option value="">Select…</option>}
        {!isKnownValue && <option value={value}>{value}</option>}
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    )
  }
  return (
    <input
      className="input"
      id={id}
      type={field === 'salary' ? 'number' : 'text'}
      min={field === 'salary' ? 0 : undefined}
      step={field === 'salary' ? 1000 : undefined}
      placeholder={PLACEHOLDERS[field]}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  )
}
