import { Role } from '../employees/employee-fields';

export interface AuthUser {
  sub: string;
  tenantId: string;
  role: Role;
  employeeId: string | null;
}
