import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ParagraphList } from './ParagraphList'

const Quote = ({ data }: { data: { text: string } }) => <div data-testid="quote">{data.text}</div>
const quote = { status: 'component', componentKey: 'Quote', data: { text: 'hi' } } as const

describe('ParagraphList', () => {
  it('AC2: renders a component paragraph with its native component, not the fragment path', () => {
    render(<ParagraphList paragraphs={[quote]} componentMap={{ Quote }} />)
    expect(screen.getByTestId('quote')).toHaveTextContent('hi')
    expect(screen.queryByTestId('html-fragment')).toBeNull()
  })

  it('AC2: skips an unmapped componentKey without hiding siblings', () => {
    const paragraphs = [{ status: 'component', componentKey: 'NotYetBuilt', data: {} } as const, quote]
    expect(() => render(<ParagraphList paragraphs={paragraphs} componentMap={{ Quote }} />)).not.toThrow()
    expect(screen.getByTestId('quote')).toBeInTheDocument()
  })

  it('AC2: does not resolve inherited object keys as components', () => {
    render(<ParagraphList paragraphs={[{ status: 'component', componentKey: 'constructor', data: {} }]} componentMap={{}} />)
    expect(document.body.textContent).toBe('')
  })

  it('AC2: unresolved/failed paragraphs render nothing but later siblings still render', () => {
    render(<ParagraphList paragraphs={[{ status: 'unresolved' }, { status: 'failed' }, quote]} componentMap={{ Quote }} />)
    expect(screen.getAllByTestId(/.+/)).toHaveLength(1)
    expect(screen.getByTestId('quote')).toBeInTheDocument()
  })

  it('AC3: renders an html-fragment paragraph from its markup', () => {
    render(<ParagraphList paragraphs={[{ status: 'html-fragment', html: '<blockquote>Legacy quote</blockquote>' }]} componentMap={{}} />)
    expect(screen.getByTestId('html-fragment').innerHTML).toContain('Legacy quote')
  })
})
