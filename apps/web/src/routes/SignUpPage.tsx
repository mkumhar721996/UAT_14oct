import { useState, type FormEvent, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CustomerHeader, Icon } from '../components/CustomerHeader'
import { PasswordField } from '../components/PasswordField'
import { ApiError, apiClient } from '../lib/apiClient'
import { storeToken } from '../lib/auth'

export default function SignUpPage() {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [alert, setAlert] = useState<ReactNode>(null)
  const [submitting, setSubmitting] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setAlert(null)
    const trimmedName = name.trim()
    const trimmedEmail = email.trim()
    if (!trimmedName || !trimmedEmail || !password) {
      setAlert('Fill in your name, email and password.')
      return
    }

    setSubmitting(true)
    try {
      const res = await apiClient.post<{ accessToken: string }>('/customers/signup', { name: trimmedName, email: trimmedEmail, password })
      storeToken(res.accessToken, trimmedEmail.toLowerCase())
      navigate('/expenses')
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setAlert(
          <>
            An account with {trimmedEmail} already exists.{' '}
            <Link to="/login" state={{ email: trimmedEmail }}>
              Log in
            </Link>
          </>,
        )
      } else {
        setAlert(err instanceof ApiError && [400, 429].includes(err.status) ? err.message : 'Something went wrong. Try again.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <CustomerHeader />
      <main className="auth-page">
        <div className="card auth-card">
          <h1 className="card-title">Create your account</h1>
          <p className="text-muted auth-sub">Sign up to request services and track your bookings.</p>
          {alert && (
            <div className="form-alert" role="alert">
              <Icon name="alert" />
              <div>{alert}</div>
            </div>
          )}
          <form onSubmit={submit} noValidate>
            <div className="field">
              <label className="field-label" htmlFor="signup-name">
                Name
              </label>
              <input id="signup-name" className="input" type="text" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="field">
              <label className="field-label" htmlFor="signup-email">
                Email
              </label>
              <input id="signup-email" className="input" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="field">
              <label className="field-label" htmlFor="signup-password">
                Password
              </label>
              <PasswordField id="signup-password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
              <span className="text-muted">At least 8 characters</span>
            </div>
            <button className="btn btn-primary" type="submit" disabled={submitting}>
              {submitting ? 'Creating account…' : 'Create account'}
            </button>
          </form>
          <p className="auth-switch">
            Already have an account? <Link to="/login">Log in</Link>
          </p>
        </div>
      </main>
    </>
  )
}
