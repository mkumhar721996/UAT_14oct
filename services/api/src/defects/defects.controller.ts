import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { AuthUser } from '../auth/auth-user';
import { CognitoAuthGuard } from '../auth/cognito-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { DefectsService } from './defects.service';
import { CreateDefectDto } from './dto/create-defect.dto';
import { UpdateDefectDto } from './dto/update-defect.dto';

// Create requires the Reporter role (@Roles()); editing is authorized per record (Reporter / Admin / triage
// state), so that logic lives in the service instead.
@Controller('defects')
@UseGuards(CognitoAuthGuard, RolesGuard)
export class DefectsController {
  constructor(private readonly defects: DefectsService) {}

  @Post()
  @Roles('reporter')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateDefectDto) {
    return this.defects.createDefect(user.tenantId, dto, user.sub);
  }

  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.defects.getDefect(user.tenantId, id);
  }

  @Patch(':id')
  update(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateDefectDto) {
    return this.defects.updateDefect(user.tenantId, id, user, dto);
  }
}
