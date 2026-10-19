import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { createParagraphDispatchTable } from '../../lib/paragraphs/paragraphDispatchTable'
import type { ParagraphInstance } from '../../lib/paragraphs/types'
import { ParagraphRenderer } from './ParagraphRenderer'

describe('ParagraphRenderer', () => {
  it('renders a component-path paragraph with its native component', () => {
    const table = createParagraphDispatchTable()
    const Fixture = ({ paragraph }: { paragraph: ParagraphInstance }) => <div data-testid="fixture">{paragraph.id}</div>
    table.register({ paragraphType: 'example--quote', renderPath: { kind: 'component', Component: Fixture } })
    render(<ParagraphRenderer paragraph={{ type: 'example--quote', id: '7' }} table={table} />)
    expect(screen.getByTestId('fixture')).toHaveTextContent('7')
  })

  it('renders an html-fragment-path paragraph from the fetched HTML', async () => {
    const table = createParagraphDispatchTable()
    const fetchHtml = vi.fn().mockResolvedValue('<p>Legacy content</p>')
    table.register({ paragraphType: 'example--legacy-banner', renderPath: { kind: 'html-fragment', fetchHtml } })
    render(<ParagraphRenderer paragraph={{ type: 'example--legacy-banner', id: '9' }} table={table} />)
    expect(await screen.findByTestId('paragraph-html-fragment')).toHaveTextContent('Legacy content')
    expect(fetchHtml).toHaveBeenCalledWith({ type: 'example--legacy-banner', id: '9' })
  })

  it('renders nothing for an unlisted type', () => {
    const { container } = render(
      <ParagraphRenderer paragraph={{ type: 'example--unlisted', id: '1' }} table={createParagraphDispatchTable()} />,
    )
    expect(container).toBeEmptyDOMElement()
  })
})
