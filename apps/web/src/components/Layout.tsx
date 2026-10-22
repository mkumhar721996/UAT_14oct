import type { ReactNode } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { apiClient } from '../lib/apiClient'
import { useAsync } from '../lib/useAsync'
import type { ChangeRequest } from '../lib/types'

function PendingBadge() {
  const { data } = useAsync(() => apiClient.get<ChangeRequest[]>('/pending-change-requests'))
  return data && data.length > 0 ? <span className="sidebar-badge">{data.length}</span> : null
}

const linkClass = ({ isActive }: { isActive: boolean }) => 'sidebar-link' + (isActive ? ' is-active' : '')

export interface Crumb {
  label: string
  to?: string
}

export function Layout({
  title,
  crumbs,
  actions,
  children,
}: {
  title: string
  crumbs?: Crumb[]
  actions?: ReactNode
  children: ReactNode
}) {
  const auth = useAuth()
  const isHr = auth?.role === 'hr_admin'
  return (
    <div className="app-shell">
      <nav className="sidebar" aria-label="Main">
        <div className="sidebar-section-label">HR Console</div>
        <NavLink to="/employees" end={false} className={linkClass}>
          Employees
        </NavLink>
        {isHr && (
          <NavLink to="/pending-changes" className={linkClass}>
            Pending changes
            <PendingBadge />
          </NavLink>
        )}
        <div className="sidebar-section-label" style={{ marginTop: 'var(--space-3)' }}>
          QA Tracker
        </div>
        <NavLink to="/defects/new" className={linkClass}>
          Defects
        </NavLink>
        <NavLink to="/page-inventory" className={linkClass}>
          Page inventory
        </NavLink>
        <div className="sidebar-section-label" style={{ marginTop: 'var(--space-3)' }}>
          Service Catalog
        </div>
        <NavLink to="/service-types" className={linkClass}>
          Service types
        </NavLink>
        <div className="sidebar-section-label" style={{ marginTop: 'var(--space-3)' }}>
          Self-service
        </div>
        <NavLink to="/me" className={linkClass}>
          My profile
        </NavLink>
      </nav>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <div className="topbar">
          <div className="topbar-title">
            <h1>{title}</h1>
            {crumbs && (
              <span className="crumb">
                {crumbs.map((c, i) => (
                  <span key={i}>
                    {i > 0 && <span className="sep">/</span>}
                    {c.to ? <Link to={c.to}>{c.label}</Link> : c.label}
                  </span>
                ))}
              </span>
            )}
          </div>
          {actions && <div className="topbar-actions">{actions}</div>}
        </div>
        <main className="content">{children}</main>
      </div>
    </div>
  )
}

export function AccessRestricted({ message }: { message: string }) {
  return (
    <div className="access-restricted">
      <div className="glyph" aria-hidden="true">
        &#10006;
      </div>
      <h2 className="heading-lg">Access restricted</h2>
      <p className="text-muted">{message}</p>
      <Link className="btn btn-secondary" to="/employees">
        Back to employees
      </Link>
    </div>
  )
}
