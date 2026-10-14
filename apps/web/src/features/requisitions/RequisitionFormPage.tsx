import { useState, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { requisitionsApi, type Requisition, type RequisitionInput } from '../../api/requisitionsApi'
import { useActor } from '../../auth/ActorContext'
import { AppShell } from '../../components/AppShell'
import { Banner } from '../../components/Banner'
import { formatDate } from '../../lib/format'
import { useLoad } from '../../lib/useLoad'

const DEPARTMENTS = ['Engineering', 'Design', 'Product', 'Customer Success', 'Support', 'Sales', 'Marketing', 'Finance', 'People']
const EMPLOYMENT_TYPES = ['Full-time', 'Part-time', 'Contract']

interface FormValues {
  title: string
  department: string
  location: string
  employmentType: string
  headcount: string
  startDate: string
  description: string
  salaryMin: string
  salaryMax: string
}

type FieldErrors = Partial<Record<'title' | 'department' | 'location' | 'headcount' | 'description', string>>

const EMPTY: FormValues = {
  title: '',
  department: '',
  location: '',
  employmentType: 'Full-time',
  headcount: '1',
  startDate: '',
  description: '',
  salaryMin: '',
  salaryMax: '',
}

const fromRequisition = (r: Requisition): FormValues => ({
  title: r.title,
  department: r.department ?? '',
  location: r.location ?? '',
  employmentType: r.employmentType,
  headcount: String(r.headcount),
  startDate: r.startDate ?? '',
  description: r.description ?? '',
  salaryMin: r.salaryMin ? String(r.salaryMin) : '',
  salaryMax: r.salaryMax ? String(r.salaryMax) : '',
})

function toInput(v: FormValues): RequisitionInput {
  const input: RequisitionInput = {
    title: v.title.trim(),
    department: v.department,
    location: v.location.trim(),
    employmentType: v.employmentType,
    headcount: v.headcount.trim() ? Number(v.headcount) : 1,
    description: v.description.trim(),
  }
  if (v.startDate) input.startDate = v.startDate
  if (v.salaryMin) input.salaryMin = Number(v.salaryMin)
  if (v.salaryMax) input.salaryMax = Number(v.salaryMax)
  return input
}

function validate(v: FormValues, requireAll: boolean): FieldErrors {
  const errors: FieldErrors = {}
  if (!v.title.trim()) errors.title = 'Enter a job title.'
  // An explicit, invalid headcount is always rejected; an empty one only blocks submit
  // (a draft defaults it to 1 instead).
  if (v.headcount.trim() ? Number(v.headcount) < 1 : requireAll) {
    errors.headcount = 'Headcount must be at least 1.'
  }
  if (requireAll) {
    if (!v.department) errors.department = 'Select a department.'
    if (!v.location.trim()) errors.location = 'Enter a location.'
    if (!v.description.trim()) errors.description = 'Add a short job description.'
  }
  return errors
}

function Field({ id, label, error, span, children }: { id: string; label: string; error?: string; span?: boolean; children: ReactNode }) {
  return (
    <div className={`field${span ? ' md:col-span-2' : ''}`}>
      <label className="field-label" htmlFor={id}>
        {label}
      </label>
      {children}
      {error && (
        <div className="field-error" id={`${id}-error`}>
          {error}
        </div>
      )}
    </div>
  )
}

export function RequisitionFormPage() {
  const { id } = useParams()
  const requisitionId = id ? Number(id) : null
  const actor = useActor()
  const { state } = useLoad(
    () => (requisitionId ? requisitionsApi.get(actor, requisitionId) : Promise.resolve(null)),
    [requisitionId, actor.id],
  )

  const title = !requisitionId
    ? 'New requisition'
    : state.status === 'ready' && state.data?.status === 'rejected'
      ? `Resubmit requisition — ${state.data.title}`
      : 'Edit draft'

  return (
    <AppShell title={title} context="Hiring Manager console" actions={<CancelButton />}>
      {requisitionId === null && <RequisitionForm requisition={null} />}
      {requisitionId !== null && state.status === 'loading' && <p className="text-muted">Loading requisition…</p>}
      {requisitionId !== null && state.status === 'error' && (
        <Banner variant="danger" title="Couldn't load this requisition.">
          <p>{state.message}</p>
        </Banner>
      )}
      {requisitionId !== null && state.status === 'ready' && <RequisitionForm requisition={state.data} />}
    </AppShell>
  )
}

function CancelButton() {
  const navigate = useNavigate()
  return (
    <button className="btn btn-secondary" onClick={() => navigate('/requisitions')}>
      Cancel
    </button>
  )
}

function RequisitionForm({ requisition }: { requisition: Requisition | null }) {
  const actor = useActor()
  const navigate = useNavigate()
  const [values, setValues] = useState<FormValues>(requisition ? fromRequisition(requisition) : EMPTY)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [pending, setPending] = useState<'draft' | 'submit' | null>(null)
  const [apiError, setApiError] = useState<string | null>(null)
  const isResubmit = requisition?.status === 'rejected'

  const set = (key: keyof FormValues) => (e: { target: { value: string } }) =>
    setValues((v) => ({ ...v, [key]: e.target.value }))
  const cls = (base: string, key: keyof FieldErrors) => (errors[key] ? `${base} has-error` : base)
  const aria = (key: keyof FieldErrors) => ({
    'aria-invalid': errors[key] ? true : undefined,
    'aria-describedby': errors[key] ? `f-${key}-error` : undefined,
  })

  async function run(action: 'draft' | 'submit') {
    const found = validate(values, action === 'submit')
    setErrors(found)
    if (Object.keys(found).length > 0) return
    setPending(action)
    setApiError(null)
    try {
      const input = toInput(values)
      if (!requisition) {
        await requisitionsApi.create(actor, input, action)
      } else {
        await requisitionsApi.update(actor, requisition.id, input)
        if (action === 'submit') await requisitionsApi.submit(actor, requisition.id)
      }
      const notice = action === 'draft' ? 'Saved as draft.' : isResubmit ? 'Resubmitted for approval.' : 'Submitted for approval.'
      navigate('/requisitions', { state: { notice } })
    } catch (err) {
      setApiError((err as Error).message)
      setPending(null)
    }
  }

  return (
    <>
      {isResubmit && requisition && (
        <Banner variant="warning" icon="↺" title="You're resubmitting a previously rejected requisition.">
          <p>
            Rejected by {requisition.rejectedBy} on {formatDate(requisition.rejectedAt)}: "{requisition.rejectionReason}".
            Submitting will send it back to pending approval.
          </p>
        </Banner>
      )}
      {apiError && <Banner variant="danger" title="Couldn't save the requisition."><p>{apiError}</p></Banner>}
      <form className="card" noValidate onSubmit={(e) => e.preventDefault()}>
        <div className="grid grid-cols-1 gap-x-4 md:grid-cols-2">
          <Field id="f-title" label="Job title" error={errors.title} span>
            <input id="f-title" className={cls('input', 'title')} placeholder="e.g. Senior Backend Engineer" value={values.title} onChange={set('title')} {...aria('title')} />
          </Field>
          <Field id="f-department" label="Department" error={errors.department}>
            <select id="f-department" className={cls('select', 'department')} value={values.department} onChange={set('department')} {...aria('department')}>
              <option value="">Select a department</option>
              {DEPARTMENTS.map((d) => (
                <option key={d}>{d}</option>
              ))}
            </select>
          </Field>
          <Field id="f-location" label="Location" error={errors.location}>
            <input id="f-location" className={cls('input', 'location')} placeholder="e.g. Remote (US)" value={values.location} onChange={set('location')} {...aria('location')} />
          </Field>
          <Field id="f-type" label="Employment type">
            <select id="f-type" className="select" value={values.employmentType} onChange={set('employmentType')}>
              {EMPLOYMENT_TYPES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </Field>
          <Field id="f-headcount" label="Headcount" error={errors.headcount}>
            <input id="f-headcount" type="number" min={1} className={cls('input', 'headcount')} value={values.headcount} onChange={set('headcount')} {...aria('headcount')} />
          </Field>
          <Field id="f-start" label="Target start date">
            <input id="f-start" type="date" className="input" value={values.startDate} onChange={set('startDate')} />
          </Field>
          <div className="field">
            <label className="field-label" htmlFor="f-hm">
              Hiring manager
            </label>
            <input id="f-hm" className="input" value={requisition?.hiringManager?.name ?? actor.name} disabled />
            <div className="field-hint">Requisitions are owned by the manager who creates them until reassigned.</div>
          </div>
          <Field id="f-description" label="Job description" error={errors.description} span>
            <textarea
              id="f-description"
              className={cls('textarea', 'description')}
              placeholder="Summarize responsibilities, requirements, and what success looks like in this role."
              value={values.description}
              onChange={set('description')}
              {...aria('description')}
            />
          </Field>
          <Field id="f-salary-min" label="Salary range — min">
            <input id="f-salary-min" type="number" min={0} className="input" placeholder="e.g. 120000" value={values.salaryMin} onChange={set('salaryMin')} />
          </Field>
          <Field id="f-salary-max" label="Salary range — max">
            <input id="f-salary-max" type="number" min={0} className="input" placeholder="e.g. 150000" value={values.salaryMax} onChange={set('salaryMax')} />
          </Field>
        </div>
        <div className="flex justify-end gap-2 border-t border-line pt-3">
          <button type="button" className="btn btn-secondary" disabled={pending !== null} onClick={() => run('draft')}>
            {pending === 'draft' ? 'Saving…' : 'Save as draft'}
          </button>
          <button type="button" className="btn btn-primary" disabled={pending !== null} onClick={() => run('submit')}>
            {pending === 'submit' ? 'Submitting…' : isResubmit ? 'Resubmit for approval' : 'Submit for approval'}
          </button>
        </div>
      </form>
    </>
  )
}
