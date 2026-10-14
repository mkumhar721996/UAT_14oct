import { IsIn } from 'class-validator';
import { EMPLOYEE_STATUSES, EmployeeStatus } from '../employee-fields';

export class UpdateEmployeeStatusDto {
  @IsIn(EMPLOYEE_STATUSES)
  status!: EmployeeStatus;
}
