import { Body, Controller, Delete, ForbiddenException, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { AuthUser } from '../auth/auth-user';
import { CognitoAuthGuard } from '../auth/cognito-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { present } from '../employees/employees.controller';
import { DepartmentsService } from './departments.service';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';

@Controller('departments')
@UseGuards(CognitoAuthGuard, RolesGuard)
export class DepartmentsController {
  constructor(private readonly departments: DepartmentsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.departments.listDepartments(user.tenantId);
  }

  // Resolved from the token's own employee id, never from client input.
  @Get('my')
  async my(@CurrentUser() user: AuthUser) {
    if (!user.employeeId) throw new ForbiddenException('No employee record linked to this user');
    const { departments, employees } = await this.departments.getMyDepartment(user.tenantId, user.employeeId);
    // Same field-level redaction as GET /employees: salary and personal contact only on the caller's own record.
    return { departments, employees: employees.map((e) => present(user, e)) };
  }

  @Post()
  @Roles('hr_admin')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateDepartmentDto) {
    return this.departments.createDepartment(user.tenantId, dto);
  }

  @Patch(':id')
  @Roles('hr_admin')
  update(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateDepartmentDto) {
    return this.departments.updateDepartment(user.tenantId, id, dto);
  }

  @Delete(':id')
  @Roles('hr_admin')
  @HttpCode(204)
  async remove(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    await this.departments.deleteDepartment(user.tenantId, id);
  }
}
