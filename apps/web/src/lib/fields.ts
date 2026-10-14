import type { CoreField, EmployeeStatus } from './types'

export const CORE_FIELDS: CoreField[] = ['jobTitle', 'department', 'contractType', 'salary']
export const CORE_FIELD_LABELS: Record<CoreField, string> = {
  jobTitle: 'Job title',
  department: 'Department',
  contractType: 'Contract type',
  salary: 'Salary',
}
export const DEPARTMENTS = ['Design', 'Engineering', 'Customer Success', 'People & Culture', 'Finance', 'Sales']
export const CONTRACT_TYPES = ['Full-time', 'Part-time', 'Contract', 'Intern']
export const EMPLOYEE_STATUSES: EmployeeStatus[] = ['active', 'on_leave', 'terminated']
export const EMPLOYEE_STATUS_LABELS: Record<EmployeeStatus, string> = {
  active: 'Active',
  on_leave: 'On leave',
  terminated: 'Terminated',
}
