import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AuthUser } from '../auth/auth-user';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { Expense } from './entities/expense.entity';
import { ExpenseCategory } from './expense-categories';

export interface ExpenseView {
  id: string;
  amount: string;
  currency: string;
  spentOn: string;
  merchant: string | null;
  category: ExpenseCategory;
  note: string | null;
}

const DEFAULT_CURRENCY = 'USD';
const blankToNull = (v?: string) => (v && v.trim() ? v.trim() : null);

const toView = (e: Expense): ExpenseView => ({
  id: e.id,
  amount: Number(e.amount).toFixed(2),
  currency: e.currency,
  spentOn: String(e.spentOn).slice(0, 10),
  merchant: e.merchant,
  category: e.category,
  note: e.note,
});

@Injectable()
export class ExpensesService {
  constructor(private readonly dataSource: DataSource) {}

  async createExpense(tenantId: string, user: AuthUser, dto: CreateExpenseDto): Promise<ExpenseView> {
    const repo = this.dataSource.getRepository(Expense);
    const saved = await repo.save(
      repo.create({
        tenantId,
        userSub: user.sub,
        amount: dto.amount,
        currency: user.currency ?? DEFAULT_CURRENCY,
        spentOn: dto.date,
        merchant: blankToNull(dto.merchant),
        category: dto.category,
        note: blankToNull(dto.note),
      }),
    );
    return toView(saved);
  }

  async listExpenses(tenantId: string, user: AuthUser): Promise<{ currency: string; expenses: ExpenseView[] }> {
    const rows = await this.dataSource.getRepository(Expense).find({ where: { tenantId, userSub: user.sub } });
    rows.sort((a, b) => String(b.spentOn).localeCompare(String(a.spentOn)) || b.createdAt.getTime() - a.createdAt.getTime());
    return { currency: user.currency ?? DEFAULT_CURRENCY, expenses: rows.map(toView) };
  }
}
