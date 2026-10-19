import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ParagraphDispatcher } from './ParagraphDispatcher'

const Fixture = ({ data }: { data: unknown }) => <div data-testid="native">{(data as { text: string }).text}</div>

describe('ParagraphDispatcher', () => {
  it('AC2: dispatches a resolved native paragraph to its registered component', () => {
    render(<ParagraphDispatcher paragraph={{ status: 'resolved', jsonApiType: 'paragraph--rich_text', componentKey: 'RichText', data: { text: 'Hello' } }} registry={{ RichText: Fixture }} />)
    expect(screen.getByTestId('native')).toHaveTextContent('Hello')
  })

  it('AC4: renders a legacy paragraph from its HTML fragment', () => {
    render(<ParagraphDispatcher paragraph={{ status: 'resolved', jsonApiType: 'paragraph--legacy_promo', componentKey: 'LegacyHtmlFragment', data: { html: '<p>50% off</p>' } }} />)
    expect(screen.getByText('50% off')).toBeInTheDocument()
  })

  it.each([
    [{ status: 'unresolved', jsonApiType: 'x' }],
    [{ status: 'failed', jsonApiType: 'x', componentKey: 'RichText', data: { text: 'no' } }],
    [{ status: 'resolved', jsonApiType: 'x', componentKey: 'NotRegistered', data: { text: 'no' } }],
  ] as const)('renders nothing for %o', (paragraph) => {
    const { container } = render(<ParagraphDispatcher paragraph={{ ...paragraph }} registry={{ RichText: Fixture }} />)
    expect(container).toBeEmptyDOMElement()
  })
})
