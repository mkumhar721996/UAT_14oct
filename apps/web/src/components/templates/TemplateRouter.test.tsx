import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { TemplateRouter } from './TemplateRouter'

const ALL_IDS = ['home-page-template', 'landing-page-template', 'client-work-template', 'partner-template', 'services-template']

describe('TemplateRouter', () => {
  it.each([
    ['home_page', 'home-page-template'],
    ['landing_page', 'landing-page-template'],
    ['client_work', 'client-work-template'],
    ['partner', 'partner-template'],
    ['services', 'services-template'],
  ])('renders only the matching renderer for %s', (templateField, testId) => {
    render(<TemplateRouter node={{ contentType: templateField, templateField }} />)
    for (const id of ALL_IDS) {
      if (id === testId) expect(screen.getByTestId(id)).toBeInTheDocument()
      else expect(screen.queryByTestId(id)).not.toBeInTheDocument()
    }
  })

  it('renders nothing for an unmapped template value', () => {
    render(<TemplateRouter node={{ contentType: 'blog_post', templateField: 'blog_post' }} />)
    for (const id of ALL_IDS) expect(screen.queryByTestId(id)).not.toBeInTheDocument()
  })

  it('renders nothing when templateField and contentType disagree', () => {
    render(<TemplateRouter node={{ contentType: 'partner', templateField: 'services' }} />)
    for (const id of ALL_IDS) expect(screen.queryByTestId(id)).not.toBeInTheDocument()
  })
})
