import { NavLink, useLocation } from 'react-router-dom'
import { ROLE_LABELS, isReviewer, useActor } from '../auth/ActorContext'

interface NavItem {
  id: string
  label: string
  to: string
}

const HIRING_MANAGER_NAV: NavItem[] = [{ id: 'my-requisitions', label: 'My requisitions', to: '/requisitions' }]
const REVIEWER_NAV: NavItem[] = [
  { id: 'approvals', label: 'Approvals', to: '/approvals' },
  { id: 'open-requisitions', label: 'Open requisitions', to: '/open-requisitions' },
]
const CANDIDATE_NAV: NavItem[] = [{ id: 'browse-jobs', label: 'Browse jobs', to: '/jobs' }]

export function Sidebar() {
  const actor = useActor()
  const isCandidateArea = useLocation().pathname.startsWith('/jobs')
  const items = isCandidateArea ? CANDIDATE_NAV : isReviewer(actor) ? REVIEWER_NAV : HIRING_MANAGER_NAV

  return (
    <nav className="sidebar" aria-label="Primary">
      <div className="flex flex-col gap-1">
        {items.map((item) => (
          <NavLink
            key={item.id}
            to={item.to}
            className={({ isActive }) => `sidebar-link${isActive ? ' is-active' : ''}`}
          >
            {item.label}
          </NavLink>
        ))}
      </div>
      <div className="mt-3 border-t border-line pt-3 text-sm text-fg-muted">
        {isCandidateArea ? (
          <>
            Browsing as a candidate
            <br />
            (not signed in)
          </>
        ) : (
          <>
            <strong className="block font-medium text-fg">{actor.name}</strong>
            {ROLE_LABELS[actor.role]}
          </>
        )}
      </div>
    </nav>
  )
}
