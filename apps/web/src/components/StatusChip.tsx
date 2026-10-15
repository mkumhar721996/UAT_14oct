import type { RequisitionStatus } from '../api/requisitionsApi'

const STATUS: Record<RequisitionStatus, { label: string; className: string }> = {
  draft: { label: 'Draft', className: 'chip-neutral' },
  pending_approval: { label: 'Pending approval', className: 'chip-warning' },
  open: { label: 'Open', className: 'chip-success' },
  rejected: { label: 'Rejected', className: 'chip-danger' },
}

export const statusLabel = (status: RequisitionStatus) => STATUS[status].label

export function StatusChip({ status }: { status: RequisitionStatus }) {
  return <span className={`chip ${STATUS[status].className}`}>{STATUS[status].label}</span>
}
