export const CORE_FIELDS = ['jobTitle', 'department', 'contractType', 'salary'] as const;
export type CoreField = (typeof CORE_FIELDS)[number];
export type Role = 'hr_admin' | 'employee';
