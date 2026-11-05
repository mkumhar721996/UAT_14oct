import { Role } from './roles';

export interface AuthUser {
  sub: string;
  tenantId: string;
  role: Role;
  employeeId: string | null;
  /** ISO 4217 code of the user's profile currency; null when the token carries none. */
  currency: string | null;
}
