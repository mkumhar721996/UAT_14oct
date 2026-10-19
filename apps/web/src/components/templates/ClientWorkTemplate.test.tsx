import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ClientWorkTemplate } from './ClientWorkTemplate'

describe('ClientWorkTemplate', () => {
  it('AC1: renders the title, hero image and body, with no stub text', () => {
    render(
      <ClientWorkTemplate
        node={{ title: 'Acme Redesign', body: '<p>We helped Acme ship.</p>', heroImage: { url: '/h.jpg', alt: 'Acme hero' }, paragraphs: [] }}
      />,
    )
    expect(screen.getByText('Acme Redesign')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Acme hero' })).toHaveAttribute('src', '/h.jpg')
    expect(screen.getByTestId('client-work-body').innerHTML).toContain('We helped Acme ship.')
    expect(screen.queryByText('client_work')).not.toBeInTheDocument()
  })

  it('AC1: empty fields render empty, never a placeholder', () => {
    render(<ClientWorkTemplate node={{ title: '', body: '', heroImage: null, paragraphs: [] }} />)
    expect(screen.queryByRole('img')).toBeNull()
    expect(screen.getByTestId('client-work-body').innerHTML).toBe('')
  })
})
