import type { CoreField } from './types'

export const CORE_FIELDS: CoreField[] = ['jobTitle', 'department', 'contractType', 'salary']
export const CORE_FIELD_LABELS: Record<CoreField, string> = {
  jobTitle: 'Job title',
  department: 'Department',
  contractType: 'Contract type',
  salary: 'Salary',
}
export const DEPARTMENTS = ['Design', 'Engineering', 'Customer Success', 'People & Culture', 'Finance', 'Sales']
export const CONTRACT_TYPES = ['Full-time', 'Part-time', 'Contract', 'Intern']
