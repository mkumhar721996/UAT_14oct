export type CoreField = 'jobTitle' | 'department' | 'contractType' | 'salary'

export interface Employee {
  id: string
  employeeNumber: string
  fullName: string
  startDate: string
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

export type DefectSeverity = 'Critical' | 'High' | 'Medium' | 'Low'

export interface Defect {
  id: string
  defectNumber: string
  title: string
  description: string
  reproSteps: string
  severity: DefectSeverity
  priority: string | null
  type: string
  status: string
  triagedAt: string | null
  reporterId: string
  reporterName: string | null
  assigneeId: string | null
  assigneeName: string | null
  expectedResult: string | null
  actualResult: string | null
  environment: string | null
  createdAt: string
  updatedAt: string
}
