import { render } from '@testing-library/react'
import type { ReactElement } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { vi } from 'vitest'
import { ToastProvider } from '../components/Toast'
import { TOKEN_KEY, type Role } from '../lib/auth'

export function signIn(role: Role, employeeId?: string, sub = 'test-sub') {
  const payload = btoa(JSON.stringify({ sub, role, tenant_id: 'tenant-1', employee_id: employeeId }))
  localStorage.setItem(TOKEN_KEY, `header.${payload}.signature`)
}

type Handler = unknown | ((init?: RequestInit) => unknown)

/** Stubs fetch with `"METHOD /path"` -> JSON body handlers; records calls. */
export function mockApi(routes: Record<string, Handler>) {
  const fn = vi.fn(async (url: string, init?: RequestInit) => {
    const key = `${init?.method ?? 'GET'} ${url}`
    if (!(key in routes)) return new Response(JSON.stringify({ message: `unmocked ${key}` }), { status: 404 })
    const h = routes[key]
    const body = typeof h === 'function' ? (h as (i?: RequestInit) => unknown)(init) : h
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
