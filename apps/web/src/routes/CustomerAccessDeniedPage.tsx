import { Link } from 'react-router-dom'
import { CustomerHeader, Icon } from '../components/CustomerHeader'

export default function CustomerAccessDeniedPage() {
  return (
    <>
      <CustomerHeader />
      <main className="denied-page">
        <div className="card denied-card">
          <div className="denied-icon">
            <Icon name="alert" />
          </div>
          <h1 className="card-title">Access denied</h1>
          <p className="card-body">This page is for admin and technician accounts only. Your customer account doesn't have access to it.</p>
          <Link className="btn btn-primary" to="/account" style={{ marginTop: 'var(--space-3)', display: 'inline-flex' }}>
            Back to my account
          </Link>
        </div>
      </main>
    </>
  )
}
