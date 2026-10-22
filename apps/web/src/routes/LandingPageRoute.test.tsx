import { screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { errorResponse, mockApi, renderAt } from '../test/helpers'
import LandingPageRoute from './LandingPageRoute'

afterEach(() => vi.unstubAllGlobals())
const render = () => renderAt(<LandingPageRoute />, '/pages/landing-page/lp-1', '/pages/landing-page/:pageId')

describe('LandingPageRoute', () => {
  it('fetches the page by id and renders it through the template router', async () => {
    mockApi({ 'GET /pages/landing-page/lp-1': { contentType: 'landing_page', title: 'Autumn Sale', bodyHtml: '<p>Save big</p>' } })
    render()
    expect(await screen.findByText('Autumn Sale')).toBeInTheDocument()
    expect(screen.getByText('Save big')).toBeInTheDocument()
  })

  it('shows a message when the page cannot be loaded', async () => {
    mockApi({ 'GET /pages/landing-page/lp-1': errorResponse(500, 'boom') })
    render()
    expect(await screen.findByText(/couldn't be loaded/i)).toBeInTheDocument()
  })
})
