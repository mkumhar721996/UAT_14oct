import { useEffect, useState } from 'react'

export type Role = 'hr_admin' | 'employee' | 'reporter' | 'customer'
export interface Session {
  role: Role
  employeeId: string | null
  tenantId: string
}

const ROLES: Role[] = ['hr_admin', 'employee', 'reporter', 'customer']

export const TOKEN_KEY = 'arc.accessToken'
export const EMAIL_KEY = 'arc.customerEmail'

export const getToken = () => localStorage.getItem(TOKEN_KEY)

/** The access token carries no email claim, so the customer's email is kept next to it for display only. */
export const getCustomerEmail = () => localStorage.getItem(EMAIL_KEY)

const listeners = new Set<() => void>()
const notify = () => listeners.forEach((l) => l())

export function storeToken(token: string, email?: string): void {
  localStorage.setItem(TOKEN_KEY, token)
  if (email) localStorage.setItem(EMAIL_KEY, email)
  notify()
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(EMAIL_KEY)
  notify()
}

/** Decodes (does not verify — the API does) the claims of the signed-in user's access token. */
export function readSession(): Session | null {
  const token = getToken()
  if (!token) return null
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
    if (!ROLES.includes(payload.role)) return null
    return { role: payload.role, employeeId: payload.employee_id ?? null, tenantId: payload.tenant_id }
  } catch {
    return null
  }
}

export function useAuth(): Session | null {
  const [session, setSession] = useState(readSession)
  useEffect(() => {
    const update = () => setSession(readSession())
    listeners.add(update)
    return () => void listeners.delete(update)
  }, [])
  return session
}
