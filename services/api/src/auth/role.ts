export const ROLES = ['hr_admin', 'employee', 'reporter', 'admin'] as const;
export type Role = (typeof ROLES)[number];
