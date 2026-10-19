import { fireEvent, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { InventoryEntry, TemplateType } from '../lib/types'
import { mockApi, renderAt, signIn } from '../test/helpers'
import PageInventoryPage from './PageInventoryPage'

const templates: TemplateType[] = ['HomePage', 'LandingPage', 'ClientWork', 'Partner', 'Services']
const entries: InventoryEntry[] = templates.map((t, i) => ({
  pageId: `p-${i}`, templateType: t, title: `Page ${i}`, path: null, reviewerName: null, reviewDate: null, status: null,
}))

describe('PageInventoryPage', () => {
  let api: ReturnType<typeof mockApi>
  beforeEach(() => {
    signIn('employee')
    api = mockApi({
      'GET /inventory': entries,
      'POST /inventory/p-0/results': (init?: RequestInit) => ({ ...JSON.parse(init!.body as string), id: 'r1', pageId: 'p-0', result: JSON.parse(init!.body as string).result }),
    })
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    localStorage.clear()
  })
  const posts = () => api.mock.calls.filter(([, init]) => init?.method === 'POST')
  const render = () => renderAt(<PageInventoryPage />, '/page-inventory', '/page-inventory')

  it('AC3: shows the template of each page', async () => {
    render()
    expect(await screen.findAllByText(/^(HomePage|LandingPage|ClientWork|Partner|Services)$/)).toHaveLength(5)
  })

  it('AC10: a page without a result shows no pass/fail chip', async () => {
    render()
    expect((await screen.findAllByText(/no result yet/i)).length).toBe(5)
    expect(screen.queryByText('Pass')).not.toBeInTheDocument()
    expect(screen.queryByText('Fail')).not.toBeInTheDocument()
  })

  it('AC4/AC6/AC7: recording a pass shows reviewer, date and Pass chip', async () => {
    render()
    fireEvent.change(await screen.findByLabelText('Reviewer name for Page 0'), { target: { value: 'Pat' } })
    fireEvent.change(screen.getByLabelText('Review date for Page 0'), { target: { value: '2026-10-19' } })
    fireEvent.click(screen.getAllByRole('button', { name: 'Mark pass' })[0])
    expect(await screen.findByText('Pass')).toBeInTheDocument()
    expect(screen.getByText('Pat')).toBeInTheDocument()
    expect(screen.getByText('2026-10-19')).toBeInTheDocument()
    expect(JSON.parse(posts()[0][1]!.body as string)).toEqual({ reviewerName: 'Pat', reviewDate: '2026-10-19', result: 'pass' })
  })

  it('AC9: blank reviewer name or date is not submitted', async () => {
    render()
    await screen.findByLabelText('Reviewer name for Page 0')
    fireEvent.click(screen.getAllByRole('button', { name: 'Mark pass' })[0])
    expect(await screen.findByText(/enter the reviewer name/i)).toBeInTheDocument()
    expect(screen.getByText(/enter the review date/i)).toBeInTheDocument()
    expect(posts()).toHaveLength(0)
  })
})
