export type CoreField = 'jobTitle' | 'department' | 'contractType' | 'salary'

export type EmployeeStatus = 'active' | 'on_leave' | 'terminated'

export interface Employee {
  id: string
  employeeNumber: string
  fullName: string
  startDate: string
  status: EmployeeStatus
  rehiredFromId: string | null
  jobTitle: string | null
  department: string | null
  contractType: string | null
  salary: number | null
  personalEmail?: string | null
  phone?: string | null
}

export interface HistoryEntry {
  id: string
  field: CoreField
  previousValue: string | null
  newValue: string | null
  effectiveDate: string
  recordedAt: string
}

export interface ChangeRequest {
  id: string
  employeeId: string
  field: CoreField
  requestedValue: string
  effectiveDate: string
  note: string | null
  submittedAt: string
}
