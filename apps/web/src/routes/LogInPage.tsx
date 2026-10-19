import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { CustomerHeader, Icon } from '../components/CustomerHeader'
import { PasswordField } from '../components/PasswordField'
import { useToast } from '../components/Toast'
import { ApiError, apiClient } from '../lib/apiClient'
import { storeToken } from '../lib/auth'

const INVALID_CREDENTIALS = "That email and password don't match. Check your details and try again."

export default function LogInPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const location = useLocation()
  const [email, setEmail] = useState((location.state as { email?: string } | null)?.email ?? '')
  const [password, setPassword] = useState('')
  const [alert, setAlert] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setAlert(null)
    setSubmitting(true)
    try {
      const { accessToken } = await apiClient.post<{ accessToken: string }>('/customers/login', { email: email.trim(), password })
      storeToken(accessToken, email.trim().toLowerCase())
      toast('Logged in')
      navigate('/account')
    } catch (err) {
      setAlert(err instanceof ApiError && err.status === 401 ? INVALID_CREDENTIALS : 'Something went wrong. Try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <CustomerHeader />
      <main className="auth-page">
        <div className="card auth-card">
          <h1 className="card-title">Log in</h1>
          <p className="text-muted auth-sub">Welcome back. Enter your details to continue.</p>
          {alert && (
            <div id="login-alert" className="form-alert" role="alert">
              <Icon name="alert" />
              <div>{alert}</div>
            </div>
          )}
          <form onSubmit={submit} noValidate>
            <div className="field">
              <label className="field-label" htmlFor="login-email">
                Email
              </label>
              <input
                id="login-email"
                className="input"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="field">
              <label className="field-label" htmlFor="login-password">
                Password
              </label>
              <PasswordField
                id="login-password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <button className="btn btn-primary" type="submit" disabled={submitting}>
              {submitting ? 'Logging in…' : 'Log in'}
            </button>
          </form>
          <p className="auth-switch">
            New here? <Link to="/signup">Create an account</Link>
          </p>
        </div>
      </main>
    </>
  )
}
