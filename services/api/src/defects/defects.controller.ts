import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, UseGuards } from '@nestjs/common';
import { AuthUser } from '../auth/auth-user';
import { CognitoAuthGuard } from '../auth/cognito-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { DefectsService } from './defects.service';
import { UpdateDefectDto } from './dto/update-defect.dto';

// Authorization is per record (Reporter / Admin / triage state), so it lives in the service, not in @Roles().
@Controller('defects')
@UseGuards(CognitoAuthGuard, RolesGuard)
export class DefectsController {
  constructor(private readonly defects: DefectsService) {}

  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.defects.getDefect(user.tenantId, id);
  }

  @Patch(':id')
  update(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateDefectDto) {
    return this.defects.updateDefect(user.tenantId, id, user, dto);
  }
}
