import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { AuthUser } from '../auth/auth-user';
import { CognitoAuthGuard } from '../auth/cognito-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { UpdateServiceTypeStatusDto } from './dto/update-service-type-status.dto';
import { UpsertServiceTypeDto } from './dto/upsert-service-type.dto';
import { ServiceTypesService } from './service-types.service';

@Controller('service-types')
@UseGuards(CognitoAuthGuard, RolesGuard)
export class ServiceTypesController {
  constructor(private readonly serviceTypes: ServiceTypesService) {}

  @Get()
  @Roles('admin', 'customer')
  list(@CurrentUser() user: AuthUser) {
    return this.serviceTypes.listServiceTypes(user.tenantId, user.role);
  }

  @Post()
  @Roles('admin')
  create(@CurrentUser() user: AuthUser, @Body() dto: UpsertServiceTypeDto) {
    return this.serviceTypes.createServiceType(user.tenantId, dto);
  }

  @Patch(':id')
  @Roles('admin')
  update(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpsertServiceTypeDto) {
    return this.serviceTypes.updateServiceType(user.tenantId, id, dto);
  }

  @Patch(':id/status')
  @Roles('admin')
  setStatus(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateServiceTypeStatusDto) {
    return this.serviceTypes.setStatus(user.tenantId, id, dto.active);
  }
}
