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

export interface Booking {
  id: string
  serviceType: string
  status: string
  createdAt: string
}

export type DefectSeverity = 'Critical' | 'High' | 'Medium' | 'Low'

export interface Defect {
  id: string
  title: string
  description: string
  severity: DefectSeverity
  stepsToReproduce: string
  expectedResult: string | null
  actualResult: string | null
  environment: string | null
  status: string
  priority: string | null
  assigneeName: string | null
  reportedBy: string
  createdAt: string
  updatedAt: string
}

export type TemplateType = 'HomePage' | 'LandingPage' | 'ClientWork' | 'Partner' | 'Services'

export type ReviewResult = 'pass' | 'fail'

export interface InventoryEntry {
  pageId: string
  templateType: TemplateType
  title: string
  path: string | null
  reviewerName: string | null
  reviewDate: string | null
  status: ReviewResult | null
}
