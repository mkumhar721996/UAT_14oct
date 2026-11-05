import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { AuthUser } from '../auth/auth-user';
import { CognitoAuthGuard } from '../auth/cognito-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { ExpensesService } from './expenses.service';

// No @Roles: the expense tracker is a personal single-user tool, so any signed-in user manages their own.
@Controller('expenses')
@UseGuards(CognitoAuthGuard, RolesGuard)
export class ExpensesController {
  constructor(private readonly expenses: ExpensesService) {}

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateExpenseDto) {
    return this.expenses.createExpense(user.tenantId, user, dto);
  }

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.expenses.listExpenses(user.tenantId, user);
  }
}
