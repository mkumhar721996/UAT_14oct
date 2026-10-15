import { fireEvent, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mockApi, renderAt, signIn } from '../test/helpers'
import ReportDefectPage from './ReportDefectPage'

const created = {
  id: 'def-uuid-1', title: 'Broken', description: 'Desc', severity: 'High', stepsToReproduce: '1. go',
  expectedResult: null, actualResult: null, environment: null, status: 'New', createdAt: '2026-10-14T10:00:00Z',
}

describe('ReportDefectPage', () => {
  let api: ReturnType<typeof mockApi>
  beforeEach(() => {
    signIn('reporter')
    api = mockApi({ 'POST /defects': created })
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    localStorage.clear()
  })
  const posts = () => api.mock.calls.filter(([, init]) => init?.method === 'POST')
  const render = () => renderAt(<ReportDefectPage />, '/defects/new', '/defects/new')
  const fill = (title = 'Broken', description = 'Desc', severity = 'High', steps = '1. go') => {
    fireEvent.change(screen.getByLabelText(/^title/i), { target: { value: title } })
    fireEvent.change(screen.getByLabelText(/^description/i), { target: { value: description } })
    fireEvent.change(screen.getByLabelText(/^severity/i), { target: { value: severity } })
    fireEvent.change(screen.getByLabelText(/^steps to reproduce/i), { target: { value: steps } })
  }
  const submit = () => fireEvent.click(screen.getByRole('button', { name: /submit defect report/i }))

  it('AC4: severity offers exactly Critical, High, Medium, Low', () => {
    render()
    const options = screen.getAllByRole('option', { name: /Critical|High|Medium|Low/ }).map((o) => o.textContent)
    expect(options).toEqual(['Critical', 'High', 'Medium', 'Low'])
  })

  it.each([
    ['title', ['', 'Desc', 'High', '1. go'], 'Enter a title for the defect.'],
    ['description', ['Broken', '  ', 'High', '1. go'], 'Describe the defect.'],
    ['severity', ['Broken', 'Desc', '', '1. go'], 'Choose a severity.'],
    ['steps', ['Broken', 'Desc', 'High', ''], 'Describe the steps to reproduce the defect.'],
  ])('AC2: does not submit when %s is missing', async (_n, values, message) => {
    render()
    fill(...(values as [string, string, string, string]))
    submit()
    expect((await screen.findAllByText(message)).length).toBeGreaterThan(0)
    expect(posts()).toHaveLength(0)
  })

  it('AC1/AC3/AC5: submits with only required fields and shows status New', async () => {
    render()
    fill()
    submit()
    expect(await screen.findByText('New')).toBeInTheDocument()
    expect(JSON.parse(posts()[0][1]!.body as string)).toEqual({
      title: 'Broken', description: 'Desc', severity: 'High', stepsToReproduce: '1. go',
    })
    expect(screen.getAllByText('Not set')).toHaveLength(3)
  })

  it('AC6: a non-Reporter is refused and nothing is sent', async () => {
    localStorage.clear()
    signIn('employee')
    render()
    fill()
    submit()
    expect(await screen.findByText(/requires the reporter role/i)).toBeInTheDocument()
    expect(posts()).toHaveLength(0)
  })
})
