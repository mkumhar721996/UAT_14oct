import { Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { AuthUser } from '../auth/auth-user';
import { CognitoAuthGuard } from '../auth/cognito-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { EmployeesService } from './employees.service';

@Controller('pending-change-requests')
@UseGuards(CognitoAuthGuard, RolesGuard)
@Roles('hr_admin')
export class PendingChangeRequestsController {
  constructor(private readonly employees: EmployeesService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.employees.listPendingRequests(user.tenantId);
  }

  @Post(':id/approve')
  @HttpCode(200)
  approve(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.employees.approveChangeRequest(user.tenantId, id, user.sub);
  }

  @Post(':id/reject')
  @HttpCode(204)
  async reject(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    await this.employees.rejectChangeRequest(user.tenantId, id, user.sub);
  }
}
