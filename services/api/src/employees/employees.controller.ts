import { Body, Controller, ForbiddenException, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { AuthUser } from '../auth/auth-user';
import { CognitoAuthGuard } from '../auth/cognito-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { CreateChangeRequestDto } from './dto/create-change-request.dto';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateContactDto } from './dto/update-contact.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { Employee } from './entities/employee.entity';
import { EmploymentHistoryEntry } from './entities/employment-history-entry.entity';
import { EmployeesService } from './employees.service';

const canSeePrivate = (user: AuthUser, employeeId: string) => user.role === 'hr_admin' || user.employeeId === employeeId;

/** Non-HR callers only see salary and personal contact details on their own record. */
function present(user: AuthUser, e: Employee): Partial<Employee> {
  if (canSeePrivate(user, e.id)) return e;
  const { salary, personalEmail, phone, ...rest } = e;
  return rest;
}

@Controller('employees')
@UseGuards(CognitoAuthGuard, RolesGuard)
export class EmployeesController {
  constructor(private readonly employees: EmployeesService) {}

  @Post()
  @Roles('hr_admin')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateEmployeeDto) {
    return this.employees.createEmployee(user.tenantId, dto, user.sub);
  }

  @Get()
  @Roles('hr_admin', 'employee')
  async list(@CurrentUser() user: AuthUser) {
    return (await this.employees.listEmployees(user.tenantId)).map((e) => present(user, e));
  }

  // "me" routes resolve the employee from the token, never from client input, and are declared before ':id'.
  @Get('me')
  @Roles('employee')
  me(@CurrentUser() user: AuthUser) {
    return this.employees.getEmployee(user.tenantId, requireSelf(user));
  }

  @Patch('me/contact')
  @Roles('employee')
  updateContact(@CurrentUser() user: AuthUser, @Body() dto: UpdateContactDto) {
    return this.employees.updateOwnContact(user.tenantId, requireSelf(user), dto);
  }

  @Get('me/change-requests')
  @Roles('employee')
  myRequests(@CurrentUser() user: AuthUser) {
    return this.employees.listPendingRequests(user.tenantId, requireSelf(user));
  }

  @Post('me/change-requests')
  @Roles('employee')
  submitRequest(@CurrentUser() user: AuthUser, @Body() dto: CreateChangeRequestDto) {
    return this.employees.submitChangeRequest(user.tenantId, requireSelf(user), dto);
  }

  @Get(':id')
  @Roles('hr_admin', 'employee')
  async get(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return present(user, await this.employees.getEmployee(user.tenantId, id));
  }

  @Patch(':id')
  @Roles('hr_admin')
  update(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateEmployeeDto) {
    return this.employees.updateAsHrAdmin(user.tenantId, id, dto, user.sub);
  }

  @Get(':id/history')
  @Roles('hr_admin', 'employee')
  async history(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string): Promise<EmploymentHistoryEntry[]> {
    const rows = await this.employees.getHistory(user.tenantId, id);
    return canSeePrivate(user, id) ? rows : rows.filter((h) => h.field !== 'salary');
  }
}

function requireSelf(user: AuthUser): string {
  if (!user.employeeId) throw new ForbiddenException('No employee record linked to this user');
  return user.employeeId;
}
