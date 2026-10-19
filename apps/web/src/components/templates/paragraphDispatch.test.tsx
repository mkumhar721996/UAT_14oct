import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { createParagraphDispatchTable } from '../../lib/paragraphs/paragraphDispatchTable'
import type { ParagraphInstance } from '../../lib/paragraphs/types'
import { HomePageTemplate } from './HomePageTemplate'
import { LandingPageTemplate } from './LandingPageTemplate'
import { PartnerTemplate } from './PartnerTemplate'
import { ServicesTemplate } from './ServicesTemplate'

// ClientWorkTemplate is excluded: it renders server-composed ClientWorkPageData (fetched by
// ClientWorkPage from /pages/client-work/:id) rather than a generic DrupalNode, so it does not
// take the shared paragraphDispatchTable prop exercised here.
const templates = [
  ['HomePage', HomePageTemplate],
  ['LandingPage', LandingPageTemplate],
  ['Partner', PartnerTemplate],
  ['Services', ServicesTemplate],
] as const

const node = { contentType: 'x', paragraphs: [{ type: 'example--quote', id: '1' }] }

describe('paragraph dispatch across templates', () => {
  it.each(templates)('%s renders a listed paragraph via its mapped component path', (_, Template) => {
    const table = createParagraphDispatchTable()
    const Fixture = ({ paragraph }: { paragraph: ParagraphInstance }) => <div data-testid="fixture">{paragraph.id}</div>
    table.register({ paragraphType: 'example--quote', renderPath: { kind: 'component', Component: Fixture } })
    render(<Template node={node} paragraphDispatchTable={table} />)
    expect(screen.getByTestId('fixture')).toBeInTheDocument()
  })

  it.each(templates)('%s uses the html-fragment path once the table maps that type to it', async (_, Template) => {
    const fetchHtml = vi.fn().mockResolvedValue('<p>fragment</p>')
    const table = createParagraphDispatchTable()
    table.register({ paragraphType: 'example--quote', renderPath: { kind: 'html-fragment', fetchHtml } })
    render(<Template node={node} paragraphDispatchTable={table} />)
    expect(await screen.findByTestId('paragraph-html-fragment')).toHaveTextContent('fragment')
  })
})
