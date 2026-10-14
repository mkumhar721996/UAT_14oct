export const CORE_FIELDS = ['jobTitle', 'department', 'contractType', 'salary'] as const;
export type CoreField = (typeof CORE_FIELDS)[number];
export type Role = 'hr_admin' | 'employee';
export const EMPLOYEE_STATUSES = ['active', 'on_leave', 'terminated'] as const;
export type EmployeeStatus = (typeof EMPLOYEE_STATUSES)[number];
