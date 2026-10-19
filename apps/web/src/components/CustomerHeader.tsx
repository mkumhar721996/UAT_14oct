import { Link, useNavigate } from 'react-router-dom'
import { clearToken, getCustomerEmail, useAuth } from '../lib/auth'
import { useToast } from './Toast'

const ICON_PATHS = {
  home: ['m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z', 'M9 22V12h6v10'],
  check: ['M20 6 9 17l-5-5'],
  alert: ['M12 8v4', 'M12 16h.01'],
  eye: ['M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z'],
  calendar: ['M16 2v4', 'M8 2v4', 'M3 10h18'],
} as const

export type IconName = keyof typeof ICON_PATHS

/** Inline versions of the prototype's sprite icons (the production page has no shared sprite). */
export function Icon({ name }: { name: IconName }) {
  return (
    <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
      {name === 'alert' && <circle cx="12" cy="12" r="10" />}
      {name === 'eye' && <circle cx="12" cy="12" r="3" />}
      {name === 'calendar' && <rect width="18" height="18" x="3" y="4" rx="2" />}
      {ICON_PATHS[name].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  )
}

/** Minimal top header for the customer-facing surface: brand plus auth state only. */
export function CustomerHeader() {
  const auth = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const email = getCustomerEmail()

  const logOut = () => {
    clearToken()
    navigate('/login')
    toast('Logged out')
  }

  return (
    <header className="site-header">
      <Link className="brand" to="/">
        <Icon name="home" />
        HomeServe
      </Link>
      <div className="header-auth">
        {auth?.role === 'customer' ? (
          <>
            <span className="text-muted">Signed in{email ? ` as ${email}` : ''}</span>
            <button type="button" className="btn btn-secondary" onClick={logOut}>
              Log out
            </button>
          </>
        ) : (
          <>
            <Link className="btn btn-secondary" to="/login">
              Log in
            </Link>
            <Link className="btn btn-primary" to="/signup">
              Sign up
            </Link>
          </>
        )}
      </div>
    </header>
  )
}
