import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { LandingPageTemplate } from './LandingPageTemplate'

describe('LandingPageTemplate', () => {
  it('AC1: shows the Drupal text and images', () => {
    render(<LandingPageTemplate node={{ contentType: 'landing_page', title: 'Autumn Sale', bodyHtml: '<p>Save big</p>', images: [{ url: '/s.jpg', alt: 'Sale' }] }} />)
    expect(screen.getByText('Autumn Sale')).toBeInTheDocument()
    expect(screen.getByText('Save big')).toBeInTheDocument()
    expect(screen.getByAltText('Sale')).toHaveAttribute('src', '/s.jpg')
  })

  it('AC3/AC4: renders legacy paragraphs from their fragments and skips unresolved ones', () => {
    render(
      <LandingPageTemplate
        node={{
          contentType: 'landing_page',
          title: 'T',
          paragraphs: [
            { status: 'resolved', jsonApiType: 'paragraph--legacy_promo', componentKey: 'LegacyHtmlFragment', data: { html: '<p>50% off</p>' } },
            { status: 'unresolved', jsonApiType: 'paragraph--unknown' },
          ],
        }}
      />,
    )
    expect(screen.getByText('50% off')).toBeInTheDocument()
  })
})
