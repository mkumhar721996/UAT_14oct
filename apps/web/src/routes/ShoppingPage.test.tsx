import { screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mockApi, renderAt, signIn } from '../test/helpers'
import ShoppingPage from './ShoppingPage'

describe('ShoppingPage', () => {
  beforeEach(() => {
    mockApi({ 'GET /pending-change-requests': [] })
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    localStorage.clear()
  })

  it.each(['hr_admin', 'employee', 'reporter'] as const)(
    'AC1: a control to start registration is visible on the shopping page for %s',
    (role) => {
      signIn(role)
      renderAt(<ShoppingPage />, '/shop', '/shop')
      expect(screen.getByRole('button', { name: /^register$/i })).toBeVisible()
    },
  )

  it('AC1: the sidebar links to the shopping page', () => {
    signIn('employee')
    renderAt(<ShoppingPage />, '/shop', '/shop')
    expect(screen.getByRole('link', { name: 'Shop' })).toHaveClass('is-active')
  })
})
