import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthUser } from '../auth/auth-user';
import { CognitoAuthGuard } from '../auth/cognito-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { ExpensesService } from './expenses.service';

@Controller('expenses')
@UseGuards(CognitoAuthGuard, RolesGuard)
export class ExpensesController {
  constructor(private readonly expenses: ExpensesService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.expenses.listExpenses(user.tenantId, user.sub);
  }
}
