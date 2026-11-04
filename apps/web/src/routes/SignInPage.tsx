import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { CustomerHeader, Icon } from '../components/CustomerHeader'
import { PasswordField } from '../components/PasswordField'
import { ApiError, apiClient } from '../lib/apiClient'
import { storeToken } from '../lib/auth'

const CREDENTIALS_MISMATCH = "That email and password don't match. Check your details and try again."

export default function SignInPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [alert, setAlert] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!email.trim() || !password) {
      setAlert('Enter your email and password.')
      return
    }
    setAlert(null)
    setSubmitting(true)
    try {
      const { accessToken } = await apiClient.post<{ accessToken: string }>('/customers/login', { email: email.trim(), password })
      storeToken(accessToken, email.trim().toLowerCase())
      navigate('/expenses')
    } catch (err) {
      setAlert(err instanceof ApiError && err.status === 401 ? CREDENTIALS_MISMATCH : 'Something went wrong. Try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <CustomerHeader />
      <main className="auth-page">
        <div className="card auth-card">
          <h1 className="card-title">Sign in</h1>
          <p className="text-muted auth-sub">Enter your email and password to continue.</p>
          {alert && (
            <div id="signin-alert" className="form-alert" role="alert">
              <Icon name="alert" />
              <div>{alert}</div>
            </div>
          )}
          <form onSubmit={submit} noValidate>
            <div className="field">
              <label className="field-label" htmlFor="signin-email">
                Email
              </label>
              <input
                id="signin-email"
                className="input"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="field">
              <label className="field-label" htmlFor="signin-password">
                Password
              </label>
              <PasswordField
                id="signin-password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <button className="btn btn-primary" type="submit" disabled={submitting}>
              {submitting ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>
      </main>
    </>
  )
}
