import { screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { errorResponse, mockApi, renderAt } from '../test/helpers'
import ClientWorkPage from './ClientWorkPage'

afterEach(() => vi.unstubAllGlobals())
const render = (id: string) => renderAt(<ClientWorkPage />, `/client-work/${id}`, '/client-work/:pageId')

describe('ClientWorkPage', () => {
  it('AC1: renders the content returned by the API', async () => {
    mockApi({
      'GET /pages/client-work/p1': {
        title: 'Acme Redesign', body: '<p>Real</p>', heroImage: { url: '/h.jpg', alt: 'Acme hero' },
        paragraphs: [{ status: 'html-fragment', html: '<blockquote>Legacy</blockquote>' }],
      },
    })
    render('p1')
    expect(await screen.findByRole('heading', { name: 'Acme Redesign' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Acme hero' })).toHaveAttribute('src', '/h.jpg')
    expect(screen.getByText('Legacy')).toBeInTheDocument()
  })

  it('AC7: a 404 shows a distinct not-found state', async () => {
    mockApi({ 'GET /pages/client-work/missing': errorResponse(404, 'Not found') })
    render('missing')
    expect(await screen.findByText(/page.*not.*found/i)).toBeInTheDocument()
    expect(screen.queryByTestId('client-work-template')).not.toBeInTheDocument()
  })

  it('shows a retryable error for other failures', async () => {
    mockApi({ 'GET /pages/client-work/p1': errorResponse(500, 'boom') })
    render('p1')
    expect(await screen.findByText(/couldn't load this page/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument()
  })
})
