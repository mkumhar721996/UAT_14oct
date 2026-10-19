import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { CognitoAuthGuard } from '../auth/cognito-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { RecordPageReviewDto } from './dto/record-page-review.dto';
import { InventoryService } from './inventory.service';

@Controller('inventory')
@UseGuards(CognitoAuthGuard, RolesGuard)
@Roles('hr_admin', 'employee', 'reporter', 'admin')
export class InventoryController {
  constructor(private readonly inventory: InventoryService) {}

  @Get()
  list() {
    return this.inventory.buildInventory();
  }

  @Post(':pageId/results')
  recordResult(@Param('pageId') pageId: string, @Body() dto: RecordPageReviewDto) {
    return this.inventory.recordResult(pageId, dto);
  }
}
