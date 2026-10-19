export const ROLES = ['hr_admin', 'employee', 'reporter', 'customer', 'admin', 'developer', 'qa_verifier'] as const;
export type Role = (typeof ROLES)[number];
