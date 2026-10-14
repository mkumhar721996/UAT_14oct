import { useState } from 'react'
import { Link } from 'react-router-dom'
import { requisitionsApi } from '../../api/requisitionsApi'
import { AppShell } from '../../components/AppShell'
import { Banner } from '../../components/Banner'
import { money } from '../../lib/format'
import { useLoad } from '../../lib/useLoad'

export function JobBoardPage() {
  const [query, setQuery] = useState('')
  const { state, reload } = useLoad(() => requisitionsApi.listJobs(query.trim() || undefined), [query])

  return (
    <AppShell title="Open positions" context="Candidate job board">
      <div className="field max-w-[360px]">
        <label className="field-label" htmlFor="job-search">
          Search open roles
        </label>
        <input
          id="job-search"
          className="input"
          type="search"
          placeholder="Search by title, department, or location"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      {state.status === 'loading' && <p className="text-muted">Loading open roles…</p>}
      {state.status === 'error' && (
        <Banner variant="danger" title="Couldn't load open roles.">
          <p>Check your connection and try again.</p>
          <button className="btn btn-secondary btn-sm mt-2" onClick={reload}>
            Retry
          </button>
        </Banner>
      )}
      {state.status === 'ready' && state.data.length === 0 && (
        <div className="empty-state">
          <h3>No open roles match your search</h3>
          <p>Try a different keyword or clear your search.</p>
        </div>
      )}
      {state.status === 'ready' && state.data.length > 0 && (
        <div className="flex flex-col gap-3">
          {state.data.map((job) => (
            <div className="card" key={job.id}>
              <h3 className="card-title">{job.title}</h3>
              <p className="mb-2 mt-[2px] text-sm text-fg-muted">
                {job.department} · {job.location} · {job.employmentType}
              </p>
              <p className="card-body">{job.description}</p>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-muted">
                  {money(job.salaryMin)} – {money(job.salaryMax)}
                </span>
                <Link className="btn btn-primary btn-sm" to={`/jobs/${job.id}`}>
                  View &amp; apply
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </AppShell>
  )
}
