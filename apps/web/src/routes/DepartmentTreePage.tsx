import { useState, type FormEvent } from 'react'
import { Banner } from '../components/Banner'
import { Layout } from '../components/Layout'
import { useToast } from '../components/Toast'
import { apiClient } from '../lib/apiClient'
import { childrenOf, descendantIds } from '../lib/orgTree'
import type { Department, Employee } from '../lib/types'
import { useAsync } from '../lib/useAsync'

type Editing = { id: string | null; parentId: string | null }

export default function DepartmentTreePage() {
  const toast = useToast()
  const { data, error, reload } = useAsync(async () => {
    const [departments, employees] = await Promise.all([
      apiClient.get<Department[]>('/departments'),
      apiClient.get<Employee[]>('/employees'),
    ])
    return { departments, employees }
  })
  const [editing, setEditing] = useState<Editing | null>(null)
  const [deleting, setDeleting] = useState<Department | null>(null)

  const departments = data?.departments ?? []
  const employees = data?.employees ?? []
  const nameOf = (id: string) => employees.find((e) => e.id === id)?.fullName ?? '—'
  const memberCount = (id: string) => employees.filter((e) => e.departmentId === id).length

  function renderNode(dept: Department) {
    const count = memberCount(dept.id)
    const kids = childrenOf(departments, dept.id)
    return (
      <li key={dept.id}>
        <div className="tree-row">
          <span className="tree-name">{dept.name}</span>
          <span className="tree-manager">Managed by {nameOf(dept.managerId)}</span>
          <span className="tree-count">
            {count} {count === 1 ? 'person' : 'people'}
          </span>
          <span className="tree-actions">
            <button className="btn btn-secondary btn-sm" onClick={() => setEditing({ id: null, parentId: dept.id })}>
              Add sub-department
            </button>
            <button className="btn btn-secondary btn-sm" onClick={() => setEditing({ id: dept.id, parentId: dept.parentId })}>
              Edit
            </button>
            <button className="btn btn-secondary btn-sm" onClick={() => setDeleting(dept)}>
              Delete
            </button>
          </span>
        </div>
        {kids.length > 0 && <ul className="tree-children">{kids.map(renderNode)}</ul>}
      </li>
    )
  }

  return (
    <Layout
      title="Department tree"
      crumbs={[{ label: 'Each department has exactly one manager' }]}
      actions={
        <button className="btn btn-primary" onClick={() => setEditing({ id: null, parentId: null })}>
          + Add department
        </button>
      }
    >
      {error ? (
        <Banner kind="danger" title="Couldn't load departments">
          {error.message}
        </Banner>
      ) : data ? (
        <ul className="org-tree">{childrenOf(departments, null).map(renderNode)}</ul>
      ) : null}
      {editing && (
        <DepartmentModal
          editing={editing}
          departments={departments}
          employees={employees}
          onClose={() => setEditing(null)}
          onSaved={(message) => {
            setEditing(null)
            toast(message)
            reload()
          }}
        />
      )}
      {deleting && (
        <DeleteModal
          dept={deleting}
          members={memberCount(deleting.id)}
          subDepartments={childrenOf(departments, deleting.id).length}
          onClose={() => setDeleting(null)}
          onDeleted={() => {
            toast(`"${deleting.name}" deleted.`)
            setDeleting(null)
            reload()
          }}
        />
      )}
    </Layout>
  )
}

function DepartmentModal({
  editing,
  departments,
  employees,
  onClose,
  onSaved,
}: {
  editing: Editing
  departments: Department[]
  employees: Employee[]
  onClose: () => void
  onSaved: (message: string) => void
}) {
  const existing = departments.find((d) => d.id === editing.id)
  const [name, setName] = useState(existing?.name ?? '')
  const [parentId, setParentId] = useState(editing.parentId ?? '')
  const [managerId, setManagerId] = useState(existing?.managerId ?? '')
  const [errors, setErrors] = useState<{ name?: string; manager?: string }>({})
  const [saving, setSaving] = useState(false)

  const excluded = existing ? [existing.id, ...descendantIds(departments, existing.id)] : []
  const parents = departments.filter((d) => !excluded.includes(d.id)).sort((a, b) => a.name.localeCompare(b.name))
  const people = [...employees].sort((a, b) => a.fullName.localeCompare(b.fullName))

  function validate() {
    const found: { name?: string; manager?: string } = {}
    const trimmed = name.trim()
    if (!trimmed) found.name = 'Enter a department name.'
    else if (
      departments.some(
        (d) => d.id !== existing?.id && (d.parentId ?? '') === parentId && d.name.trim().toLowerCase() === trimmed.toLowerCase(),
      )
    ) {
      const parentName = departments.find((d) => d.id === parentId)?.name ?? 'the top level'
      found.name = `A department named "${trimmed}" already exists under ${parentName}. Choose a different name.`
    }
    if (!managerId) found.manager = 'Select a manager for this department.'
    return found
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    const found = validate()
    setErrors(found)
    if (found.name || found.manager) return
    setSaving(true)
    const body = { name: name.trim(), parentId: parentId || null, managerId }
    try {
      if (existing) await apiClient.patch(`/departments/${existing.id}`, body)
      else await apiClient.post('/departments', body)
      onSaved(`"${body.name}" saved.`)
    } catch (err) {
      setErrors({ name: (err as Error).message })
      setSaving(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="dept-modal-title">
        <h3 id="dept-modal-title">{existing ? 'Edit department' : 'Add department'}</h3>
        <form onSubmit={submit} noValidate>
          <div className="field">
            <label className="field-label" htmlFor="dept-name">
              Department name
            </label>
            <input
              className={'input' + (errors.name ? ' has-error' : '')}
              id="dept-name"
              type="text"
              placeholder="e.g. Data Platform"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            {errors.name && (
              <span className="field-error" role="alert">
                {errors.name}
              </span>
            )}
          </div>
          <div className="field">
            <label className="field-label" htmlFor="dept-parent">
              Parent department
            </label>
            <select className="select" id="dept-parent" value={parentId} onChange={(e) => setParentId(e.target.value)}>
              <option value="">No parent (top level)</option>
              {parents.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
            <span className="field-help">Leave as "No parent" to place it at the top level of the tree.</span>
          </div>
          <div className="field">
            <label className="field-label" htmlFor="dept-manager">
              Manager
            </label>
            <select
              className={'select' + (errors.manager ? ' has-error' : '')}
              id="dept-manager"
              value={managerId}
              onChange={(e) => setManagerId(e.target.value)}
            >
              <option value="">— Select a manager —</option>
              {people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.fullName}
                </option>
              ))}
            </select>
            <span className="field-help">Every department needs exactly one manager.</span>
            {errors.manager && (
              <span className="field-error" role="alert">
                {errors.manager}
              </span>
            )}
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              Save department
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function DeleteModal({
  dept,
  members,
  subDepartments,
  onClose,
  onDeleted,
}: {
  dept: Department
  members: number
  subDepartments: number
  onClose: () => void
  onDeleted: () => void
}) {
  const [failure, setFailure] = useState<string | null>(null)
  const blocked = members > 0 || subDepartments > 0
  const reasons = [
    members > 0 && `${members} ${members === 1 ? 'employee' : 'employees'}`,
    subDepartments > 0 && `${subDepartments} ${subDepartments === 1 ? 'sub-department' : 'sub-departments'}`,
  ].filter(Boolean)

  async function confirm() {
    try {
      await apiClient.delete(`/departments/${dept.id}`)
      onDeleted()
    } catch (err) {
      setFailure((err as Error).message)
    }
  }

  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="delete-dept-title">
        <h3 id="delete-dept-title">Delete department</h3>
        {blocked ? (
          <Banner kind="danger" title={`Can't delete "${dept.name}".`}>
            <span>Reassign its {reasons.join(' and ')} to another department before deleting it.</span>
          </Banner>
        ) : (
          <p>Delete "{dept.name}"? This can't be undone.</p>
        )}
        {failure && (
          <Banner kind="danger" title="Couldn't delete the department">
            {failure}
          </Banner>
        )}
        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={onClose}>
            {blocked ? 'Close' : 'Cancel'}
          </button>
          {!blocked && (
            <button className="btn btn-danger" onClick={confirm}>
              Delete department
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
