export const ROLES = ['hr_admin', 'employee', 'reporter', 'customer'] as const;
export type Role = (typeof ROLES)[number];
