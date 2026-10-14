import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ApiError, requisitionsApi, type PublicPosting } from '../../api/requisitionsApi'
import { AppShell } from '../../components/AppShell'
import { Banner } from '../../components/Banner'
import { formatDate, money } from '../../lib/format'
import { useLoad } from '../../lib/useLoad'

export function JobPostingPage() {
  const id = Number(useParams().id)
  const navigate = useNavigate()
  const { state } = useLoad(() => requisitionsApi.getJob(id), [id])
  // The public API answers 404 for any requisition that isn't open, so it never discloses unapproved ones.
  const unavailable = state.status === 'error' && state.error instanceof ApiError && state.error.status === 404
  const posting = state.status === 'ready' ? state.data : null

  return (
    <AppShell
      title={posting ? posting.title : unavailable ? 'Posting unavailable' : 'Job posting'}
      context="Candidate job board"
      actions={
        <button className="btn btn-secondary" onClick={() => navigate('/jobs')}>
          Back to open positions
        </button>
      }
    >
      {state.status === 'loading' && <p className="text-muted">Loading posting…</p>}
      {state.status === 'error' && !unavailable && (
        <Banner variant="danger" title="Couldn't load this posting.">
          <p>Check your connection and try again.</p>
        </Banner>
      )}
      {unavailable && (
        <>
          <Banner variant="warning" title="This job posting isn't open for applications yet.">
            <p>It's still under review, or no longer available. It also won't appear when browsing or searching open roles.</p>
          </Banner>
          <div className="card">
            <button className="btn btn-secondary" disabled title="Applications are refused until this requisition is published.">
              Apply now
            </button>
          </div>
          <Link className="btn btn-primary" to="/jobs">
            Browse open positions
          </Link>
        </>
      )}
      {posting && <OpenPosting posting={posting} />}
    </AppShell>
  )
}

function OpenPosting({ posting }: { posting: PublicPosting }) {
  const [status, setStatus] = useState<'idle' | 'applying' | 'applied'>('idle')
  const [error, setError] = useState<string | null>(null)

  async function apply() {
    setStatus('applying')
    setError(null)
    try {
      await requisitionsApi.apply(posting.id)
      setStatus('applied')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Try again.')
      setStatus('idle')
    }
  }

  if (status === 'applied') {
    return (
      <Banner variant="success" title={`Application submitted — ${posting.title}.`}>
        <p>The hiring team will be in touch if there's a match.</p>
      </Banner>
    )
  }

  return (
    <>
      {error && (
        <Banner variant="danger" title="We couldn't submit your application.">
          <p>{error}</p>
        </Banner>
      )}
      <div className="card">
        <h3 className="card-title">{posting.title}</h3>
        <p className="mb-2 mt-[2px] text-sm text-fg-muted">
          {posting.department} · {posting.location} · {posting.employmentType}
        </p>
        <p className="card-body">{posting.description}</p>
        <dl className="mt-3 grid grid-cols-1 gap-x-4 gap-y-3 md:grid-cols-2">
          <div>
            <dt className="text-sm text-fg-muted">Salary range</dt>
            <dd className="m-0 mt-[2px]">
              {money(posting.salaryMin)} – {money(posting.salaryMax)}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-fg-muted">Target start date</dt>
            <dd className="m-0 mt-[2px]">{formatDate(posting.startDate)}</dd>
          </div>
        </dl>
        <button className="btn btn-primary mt-3" disabled={status === 'applying'} onClick={apply}>
          {status === 'applying' ? 'Submitting…' : 'Apply now'}
        </button>
      </div>
    </>
  )
}
