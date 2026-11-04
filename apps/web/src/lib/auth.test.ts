import { afterEach, describe, expect, it } from 'vitest'
import { readSession } from './auth'
import { signIn } from '../test/helpers'

afterEach(() => localStorage.clear())

const now = () => Math.floor(Date.now() / 1000)

describe('readSession expiry', () => {
  it('returns null for an expired token', () => {
    signIn('employee', 'u2', 'test-sub', { exp: now() - 60 })
    expect(readSession()).toBeNull()
  })
  it('returns the session for an unexpired token', () => {
    signIn('employee', 'u2', 'test-sub', { exp: now() + 3600 })
    expect(readSession()?.role).toBe('employee')
  })
  it('returns the session when the token has no exp claim', () => {
    signIn('employee', 'u2')
    expect(readSession()?.role).toBe('employee')
  })
})
