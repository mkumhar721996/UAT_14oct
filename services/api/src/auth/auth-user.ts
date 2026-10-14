import { Role } from './role';

export interface AuthUser {
  sub: string;
  tenantId: string;
  role: Role;
  employeeId: string | null;
}
