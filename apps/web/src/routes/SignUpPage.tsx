import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CustomerHeader, Icon } from '../components/CustomerHeader'
import { PasswordField } from '../components/PasswordField'
import { useToast } from '../components/Toast'
import { ApiError, apiClient } from '../lib/apiClient'

const MIN_PASSWORD_LENGTH = 8

type Errors = { email?: string; tooShort?: string; confirm?: string }

export default function SignUpPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [errors, setErrors] = useState<Errors>({})
  const [alert, setAlert] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [createdEmail, setCreatedEmail] = useState<string | null>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setAlert(null)
    const trimmed = email.trim()
    const next: Errors = {
      ...(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed) && { email: 'Enter a valid email address.' }),
      ...(password.length < MIN_PASSWORD_LENGTH && { tooShort: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.` }),
      ...((confirm === '' || confirm !== password) && { confirm: "Passwords don't match." }),
    }
    setErrors(next)
    if (Object.keys(next).length) return

    setSubmitting(true)
    try {
      await apiClient.post('/customers/signup', { email: trimmed, password })
      setCreatedEmail(trimmed)
      toast('Account created')
    } catch (err) {
      setAlert(err instanceof ApiError && [400, 409, 429].includes(err.status) ? err.message : 'Something went wrong. Try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const continueToLogin = () => navigate('/login', { state: { email: createdEmail } })

  return (
    <>
      <CustomerHeader />
      <main className="auth-page">
        {createdEmail ? (
          <div className="card auth-card success-card">
            <div className="success-icon">
              <Icon name="check" />
            </div>
            <h1 className="card-title">Account created</h1>
            <p className="text-muted auth-sub">You're all set, {createdEmail}. Log in to start requesting services.</p>
            <button type="button" className="btn btn-primary" onClick={continueToLogin}>
              Continue to log in
            </button>
          </div>
        ) : (
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
                <label className="field-label" htmlFor="signup-email">
                  Email
                </label>
                <input
                  id="signup-email"
                  className={'input' + (errors.email ? ' has-error' : '')}
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                {errors.email && <span className="field-error" role="alert">{errors.email}</span>}
              </div>
              <div className="field">
                <label className="field-label" htmlFor="signup-password">
                  Password
                </label>
                <PasswordField
                  id="signup-password"
                  className={errors.tooShort ? 'has-error' : ''}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <span className="text-muted">At least 8 characters</span>
                {errors.tooShort && <span className="field-error" role="alert">{errors.tooShort}</span>}
              </div>
              <div className="field">
                <label className="field-label" htmlFor="signup-confirm">
                  Confirm password
                </label>
                <PasswordField
                  id="signup-confirm"
                  className={errors.confirm ? 'has-error' : ''}
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                />
                {errors.confirm && <span className="field-error" role="alert">{errors.confirm}</span>}
              </div>
              <button className="btn btn-primary" type="submit" disabled={submitting}>
                {submitting ? 'Creating account…' : 'Create account'}
              </button>
            </form>
            <p className="auth-switch">
              Already have an account? <Link to="/login">Log in</Link>
            </p>
          </div>
        )}
      </main>
    </>
  )
}
