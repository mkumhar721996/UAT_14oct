import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { CoreFieldInput } from './CoreFieldInput'

describe('CoreFieldInput', () => {
  it('keeps a stored value that is not in the known options list selected, not defaulted', () => {
    render(<CoreFieldInput field="department" id="dept" value="Legal" onChange={() => {}} allowUnset={false} />)
    const select = screen.getByRole('combobox') as HTMLSelectElement
    expect(select.value).toBe('Legal')
    expect(screen.getByRole('option', { name: 'Legal' })).toBeInTheDocument()
  })

  it('does not add a synthetic option for a known value', () => {
    render(<CoreFieldInput field="contractType" id="ct" value="Full-time" onChange={() => {}} allowUnset={false} />)
    expect(screen.getAllByRole('option', { name: 'Full-time' })).toHaveLength(1)
  })
})
