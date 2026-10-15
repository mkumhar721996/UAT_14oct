import type { Actor } from '../auth/ActorContext'

export type RequisitionStatus = 'draft' | 'pending_approval' | 'open' | 'rejected'

export interface OwnerSummary {
  id: string
  name: string
  role: string
  employmentStatus: string
  eligible: boolean
}

export interface Requisition {
  id: number
  title: string
  department: string | null
  location: string | null
  employmentType: string
  headcount: number
  startDate: string | null
  description: string | null
  salaryMin: number | null
  salaryMax: number | null
  hiringManagerId: string
  hiringManager: OwnerSummary | null
  status: RequisitionStatus
  pipeline: { name: string; stage: string }[]
  pipelineCandidateCount: number
  submittedAt: string | null
  approvedBy: string | null
  publishedAt: string | null
  rejectedBy: string | null
  rejectedAt: string | null
  rejectionReason: string | null
  lastSavedAt: string | null
}

export interface RequisitionInput {
  title: string
  department?: string
  location?: string
  employmentType?: string
  headcount?: number
  startDate?: string
  description?: string
  salaryMin?: number
  salaryMax?: number
}

export type PublicPosting = Pick<
  Requisition,
  | 'id'
  | 'title'
  | 'department'
  | 'location'
  | 'employmentType'
  | 'startDate'
  | 'description'
  | 'salaryMin'
  | 'salaryMax'
>

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message)
  }
}

async function call<T>(path: string, init: { method?: string; body?: unknown; actor?: Actor } = {}): Promise<T> {
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (init.actor) {
    headers['x-actor-id'] = init.actor.id
    headers['x-actor-role'] = init.actor.role
  }
  const res = await fetch(`${BASE_URL}${path}`, {
    method: init.method ?? 'GET',
    headers,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  })
  const payload = await res.json().catch(() => ({}))
  if (!res.ok) {
    const message = Array.isArray(payload.message) ? payload.message.join(' ') : payload.message
    throw new ApiError(res.status, message ?? 'Something went wrong. Try again.')
  }
  return payload as T
}

export const requisitionsApi = {
  list: (actor: Actor, status?: string) =>
    call<Requisition[]>(`/requisitions${status ? `?status=${status}` : ''}`, { actor }),
  listPending: (actor: Actor) => call<Requisition[]>('/requisitions/pending-approval', { actor }),
  get: (actor: Actor, id: number) => call<Requisition>(`/requisitions/${id}`, { actor }),
  create: (actor: Actor, body: RequisitionInput, action: 'draft' | 'submit') =>
    call<Requisition>('/requisitions', { method: 'POST', actor, body: { ...body, action } }),
  update: (actor: Actor, id: number, body: RequisitionInput) =>
    call<Requisition>(`/requisitions/${id}`, { method: 'PATCH', actor, body }),
  submit: (actor: Actor, id: number) => call<Requisition>(`/requisitions/${id}/submit`, { method: 'POST', actor, body: {} }),
  approve: (actor: Actor, id: number) => call<Requisition>(`/requisitions/${id}/approve`, { method: 'POST', actor, body: {} }),
  reject: (actor: Actor, id: number, reason: string) =>
    call<Requisition>(`/requisitions/${id}/reject`, { method: 'POST', actor, body: { reason } }),
  reassign: (actor: Actor, id: number, newHiringManagerId: string) =>
    call<Requisition>(`/requisitions/${id}/reassign`, { method: 'POST', actor, body: { newHiringManagerId } }),
  reassignmentTargets: (actor: Actor) => call<OwnerSummary[]>('/requisitions/reassignment-targets', { actor }),
  listJobs: (q?: string) => call<PublicPosting[]>(`/job-board${q ? `?q=${encodeURIComponent(q)}` : ''}`),
  getJob: (id: number) => call<PublicPosting>(`/job-board/${id}`),
  apply: (id: number) => call<{ applied: boolean }>(`/job-board/${id}/apply`, { method: 'POST', body: {} }),
}
