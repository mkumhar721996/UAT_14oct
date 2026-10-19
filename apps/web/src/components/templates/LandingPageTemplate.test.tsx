import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { createParagraphDispatchTable } from '../../lib/paragraphs/paragraphDispatchTable'
import { LandingPageTemplate } from './LandingPageTemplate'
import { LEGACY_HTML_FRAGMENT_KEY, NATIVE_PARAGRAPH_COMPONENTS, registerLandingPageParagraphTypes } from './landingPageParagraphDispatch'

const freshTable = () => {
  const table = createParagraphDispatchTable()
  registerLandingPageParagraphTypes(table)
  return table
}

describe('LandingPageTemplate', () => {
  afterEach(() => {
    delete NATIVE_PARAGRAPH_COMPONENTS.HeroBanner
  })

  it('AC1: shows the Drupal text and images', () => {
    render(
      <LandingPageTemplate
        node={{ contentType: 'landing_page', title: 'Autumn Sale', bodyHtml: '<p>Save big</p>', images: [{ url: '/s.jpg', alt: 'Sale' }] }}
        paragraphDispatchTable={freshTable()}
      />,
    )
    expect(screen.getByText('Autumn Sale')).toBeInTheDocument()
    expect(screen.getByText('Save big')).toBeInTheDocument()
    expect(screen.getByAltText('Sale')).toHaveAttribute('src', '/s.jpg')
  })

  it('AC4: renders a legacy paragraph from its HTML fragment', () => {
    render(
      <LandingPageTemplate
        node={{
          contentType: 'landing_page',
          title: 'T',
          paragraphs: [
            { status: 'resolved', jsonApiType: 'paragraph--legacy_promo', componentKey: LEGACY_HTML_FRAGMENT_KEY, data: { html: '<p>50% off</p>' } },
          ],
        }}
        paragraphDispatchTable={freshTable()}
      />,
    )
    expect(screen.getByText('50% off')).toBeInTheDocument()
  })

  it('AC2: renders a native paragraph through the real NATIVE_PARAGRAPH_COMPONENTS registry', () => {
    NATIVE_PARAGRAPH_COMPONENTS.HeroBanner = ({ data }) => <div data-testid="hero-banner">{(data as { heading: string }).heading}</div>
    render(
      <LandingPageTemplate
        node={{
          contentType: 'landing_page',
          title: 'T',
          paragraphs: [{ status: 'resolved', jsonApiType: 'paragraph--hero_banner', componentKey: 'HeroBanner', data: { heading: 'Welcome' } }],
        }}
        paragraphDispatchTable={freshTable()}
      />,
    )
    expect(screen.getByTestId('hero-banner')).toHaveTextContent('Welcome')
  })

  it('AC3: every paragraph instance appears, even unresolved ones and ones without a native component yet', () => {
    render(
      <LandingPageTemplate
        node={{
          contentType: 'landing_page',
          title: 'T',
          paragraphs: [
            { status: 'resolved', jsonApiType: 'paragraph--legacy_promo', componentKey: LEGACY_HTML_FRAGMENT_KEY, data: { html: '<p>50% off</p>' } },
            { status: 'unresolved', jsonApiType: 'paragraph--rich_text' },
            { status: 'resolved', jsonApiType: 'paragraph--hero_banner', componentKey: 'HeroBanner', data: { heading: 'Welcome' } },
          ],
        }}
        paragraphDispatchTable={freshTable()}
      />,
    )
    expect(screen.getByText('50% off')).toBeInTheDocument()
    // No real HeroBanner is registered in this test, so it falls back visibly rather than disappearing.
    expect(screen.getAllByTestId('paragraph-fallback')).toHaveLength(2)
  })

  it('a legacy paragraph still renders its HTML fragment after an earlier page hit a transient failure for the same type', () => {
    // Registration is per-type, not per-instance, so whichever instance of a type is rendered
    // first can no longer decide how every later instance of that same type renders.
    const table = freshTable()
    render(
      <LandingPageTemplate
        node={{ contentType: 'landing_page', title: 'First', paragraphs: [{ status: 'failed', jsonApiType: 'paragraph--legacy_promo' }] }}
        paragraphDispatchTable={table}
      />,
    )
    expect(screen.getByTestId('paragraph-fallback')).toBeInTheDocument()

    render(
      <LandingPageTemplate
        node={{
          contentType: 'landing_page',
          title: 'Second',
          paragraphs: [
            { status: 'resolved', jsonApiType: 'paragraph--legacy_promo', componentKey: LEGACY_HTML_FRAGMENT_KEY, data: { html: '<p>50% off</p>' } },
          ],
        }}
        paragraphDispatchTable={table}
      />,
    )
    expect(screen.getByText('50% off')).toBeInTheDocument()
  })
})
