import { Role } from './roles';

export interface AuthUser {
  sub: string;
  tenantId: string;
  role: Role;
  employeeId: string | null;
}
