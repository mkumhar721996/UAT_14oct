import { FormEvent, useState } from 'react'
import { Banner } from '../components/Banner'
import { Layout } from '../components/Layout'
import { useToast } from '../components/Toast'
import { apiClient } from '../lib/apiClient'
import type { ServiceType } from '../lib/types'
import { useAsync } from '../lib/useAsync'

const NAME_REQUIRED = 'Enter a name for this service type.'

/** `editing === null` is the create form; a ServiceType is the edit form for that row. */
function ServiceTypeModal({ editing, onClose, onSaved }: { editing: ServiceType | null; onClose: () => void; onSaved: () => void }) {
  const toast = useToast()
  const [name, setName] = useState(editing?.name ?? '')
  const [description, setDescription] = useState(editing?.description ?? '')
  const [nameError, setNameError] = useState('')
  const [saving, setSaving] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) return setNameError(NAME_REQUIRED)
    setNameError('')
    setSaving(true)
    const body = { name: name.trim(), description: description.trim() }
    try {
      if (editing) await apiClient.patch(`/service-types/${editing.id}`, body)
      else await apiClient.post('/service-types', body)
      toast(editing ? 'Service type updated' : 'Service type created')
      onSaved()
    } catch (err) {
      setNameError((err as Error).message)
      setSaving(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="service-type-title">
        <h3 id="service-type-title">{editing ? 'Edit service type' : 'New service type'}</h3>
        <form onSubmit={submit} noValidate>
          <div className="field">
            <label className="field-label" htmlFor="service-type-name">
              Name
            </label>
            <input
              className="input"
              id="service-type-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              aria-invalid={!!nameError}
              aria-describedby="service-type-name-error"
            />
            <span className="field-error" id="service-type-name-error" role="alert">
              {nameError}
            </span>
          </div>
          <div className="field">
            <label className="field-label" htmlFor="service-type-description">
              Description <span className="text-muted">(optional)</span>
            </label>
            <textarea className="textarea" id="service-type-description" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {editing ? 'Save changes' : 'Save service type'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function ServiceTypesPage() {
  const toast = useToast()
  const [filter, setFilter] = useState('')
  const [form, setForm] = useState<{ editing: ServiceType | null } | null>(null)
  const [deactivating, setDeactivating] = useState<ServiceType | null>(null)
  const { data, error, loading, reload } = useAsync(() => apiClient.get<ServiceType[]>('/service-types'))

  const q = filter.trim().toLowerCase()
  const rows = (data ?? []).filter((s) => !q || s.name.toLowerCase().includes(q) || (s.description ?? '').toLowerCase().includes(q))

  async function setActive(s: ServiceType, active: boolean) {
    try {
      await apiClient.patch(`/service-types/${s.id}/status`, { active })
      toast(active ? 'Now visible to customers again' : "Marked inactive — customers won't see it when booking")
    } catch (err) {
      toast((err as Error).message, true)
    }
    setDeactivating(null)
    reload()
  }

  return (
    <Layout
      title="Service types"
      actions={
        <button className="btn btn-primary" onClick={() => setForm({ editing: null })}>
          + New service type
        </button>
      }
    >
      <div className="search-row">
        <input
          className="input"
          type="search"
          aria-label="Search service types"
          placeholder="Search service types"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
      </div>
      {error ? (
        <>
          <Banner kind="danger" title="Couldn't load service types">
            Check your connection and try again.
          </Banner>
          <button className="btn btn-secondary" onClick={reload}>
            Retry
          </button>
        </>
      ) : !loading && rows.length === 0 ? (
        <div className="empty-state">
          <div className="glyph" aria-hidden="true">&#128269;</div>
          {q ? (
            <>
              <p>
                <strong>No service types match "{filter}"</strong>
              </p>
              <button className="btn btn-secondary" onClick={() => setFilter('')}>
                Clear search
              </button>
            </>
          ) : (
            <>
              <p>
                <strong>No service types yet</strong>
              </p>
              <p className="text-muted">Create one so customers have something to choose when booking.</p>
            </>
          )}
        </div>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Description</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 3 }).map((_, i) => (
                  <tr className="skeleton-row" key={i} aria-hidden="true">
                    {[120, 200, 60, 100].map((w) => (
                      <td key={w}>
                        <div className="skeleton skeleton-line" style={{ width: w }} />
                      </td>
                    ))}
                  </tr>
                ))
              : rows.map((s) => (
                  <tr key={s.id}>
                    <td>{s.name}</td>
                    <td className={'desc-cell' + (s.description ? '' : ' is-empty')}>{s.description || '(no description)'}</td>
                    <td>{s.active ? <span className="chip chip-success">Active</span> : <span className="chip chip-warning">Inactive</span>}</td>
                    <td>
                      <div className="row-actions">
                        <button className="btn btn-secondary" onClick={() => setForm({ editing: s })}>
                          Edit
                        </button>
                        {s.active ? (
                          <button className="btn btn-secondary" onClick={() => setDeactivating(s)}>
                            Deactivate
                          </button>
                        ) : (
                          <button className="btn btn-secondary" onClick={() => setActive(s, true)}>
                            Activate
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
          </tbody>
        </table>
      )}
      {form && (
        <ServiceTypeModal
          editing={form.editing}
          onClose={() => setForm(null)}
          onSaved={() => {
            setForm(null)
            reload()
          }}
        />
      )}
      {deactivating && (
        <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && setDeactivating(null)}>
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby="deactivate-title">
            <h3 id="deactivate-title">Deactivate service type?</h3>
            <p>
              "<strong>{deactivating.name}</strong>" will no longer be listed to customers when booking. You can reactivate it anytime.
            </p>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setDeactivating(null)}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={() => setActive(deactivating, false)}>
                Deactivate
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}
