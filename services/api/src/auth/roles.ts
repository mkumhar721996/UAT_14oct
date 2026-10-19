export const ROLES = ['hr_admin', 'employee', 'reporter', 'customer', 'admin'] as const;
export type Role = (typeof ROLES)[number];
