import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import App from './App'

describe('App', () => {
  it('renders the web app shell heading', () => {
    render(<App />)
    expect(screen.getByRole('heading', { name: /web app/i })).toBeInTheDocument()
  })
})
