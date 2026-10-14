import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { AuthUser } from '../auth/auth-user';
import { CognitoAuthGuard } from '../auth/cognito-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { DefectsService } from './defects.service';
import { CreateDefectDto } from './dto/create-defect.dto';

@Controller('defects')
@UseGuards(CognitoAuthGuard, RolesGuard)
export class DefectsController {
  constructor(private readonly defects: DefectsService) {}

  @Post()
  @Roles('reporter')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateDefectDto) {
    return this.defects.createDefect(user.tenantId, dto, user.sub);
  }
}
