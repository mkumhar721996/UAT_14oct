export const CORE_FIELDS = ['jobTitle', 'department', 'contractType', 'salary'] as const;
export type CoreField = (typeof CORE_FIELDS)[number];
export const ROLES = ['hr_admin', 'employee', 'reporter', 'admin'] as const;
export type Role = (typeof ROLES)[number];
