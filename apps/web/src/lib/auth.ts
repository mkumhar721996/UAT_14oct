import { useMemo } from 'react'

export type Role = 'hr_admin' | 'employee' | 'reporter' | 'admin'
export interface Session {
  sub: string
  role: Role
  employeeId: string | null
  tenantId: string
}

export const TOKEN_KEY = 'arc.accessToken'

export const getToken = () => localStorage.getItem(TOKEN_KEY)

/** Decodes (does not verify — the API does) the claims of the signed-in user's access token. */
export function readSession(): Session | null {
  const token = getToken()
  if (!token) return null
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
    if (payload.role !== 'hr_admin' && payload.role !== 'employee' && payload.role !== 'reporter' && payload.role !== 'admin') return null
    return { sub: payload.sub, role: payload.role, employeeId: payload.employee_id ?? null, tenantId: payload.tenant_id }
  } catch {
    return null
  }
}

export function useAuth(): Session | null {
  return useMemo(readSession, [])
}
