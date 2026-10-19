import { render } from '@testing-library/react'
import type { ReactElement } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { vi } from 'vitest'
import { ToastProvider } from '../components/Toast'
import { TOKEN_KEY, type Role } from '../lib/auth'

export function signIn(role: Role, employeeId?: string, sub = 'test-sub') {
  // Mirrors a real Cognito ID token, where custom attributes are namespaced under `custom:`.
  const payload = btoa(
    JSON.stringify({ sub, 'custom:role': role, 'custom:tenant_id': 'tenant-1', 'custom:employee_id': employeeId }),
  )
  localStorage.setItem(TOKEN_KEY, `header.${payload}.signature`)
}

/** Return from a `mockApi` handler to answer with a non-2xx status and `{ message }`. */
export function errorResponse(status: number, message: string) {
  return { __mockStatus: status, message }
}

type Handler = unknown | ((init?: RequestInit) => unknown)

/** Stubs fetch with `"METHOD /path"` -> JSON body handlers; records calls. */
export function mockApi(routes: Record<string, Handler>) {
  const fn = vi.fn(async (url: string, init?: RequestInit) => {
    const key = `${init?.method ?? 'GET'} ${url}`
    if (!(key in routes)) return new Response(JSON.stringify({ message: `unmocked ${key}` }), { status: 404 })
    const h = routes[key]
    const body = typeof h === 'function' ? (h as (i?: RequestInit) => unknown)(init) : h
    if (body && typeof body === 'object' && '__mockStatus' in body) {
      const { __mockStatus, ...rest } = body as { __mockStatus: number }
      return new Response(JSON.stringify(rest), { status: __mockStatus })
    }
    return new Response(JSON.stringify(body), { status: 200 })
  })
  vi.stubGlobal('fetch', fn)
  return fn
}

export function renderAt(ui: ReactElement, path: string, routePattern: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <ToastProvider>
        <Routes>
          <Route path={routePattern} element={ui} />
        </Routes>
      </ToastProvider>
    </MemoryRouter>,
  )
}
