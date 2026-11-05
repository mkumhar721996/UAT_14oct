import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Expense } from './entities/expense.entity';

@Injectable()
export class ExpensesService {
  constructor(private readonly dataSource: DataSource) {}

  /** Newest first; scoped to one owner within one tenant. */
  listExpenses(tenantId: string, ownerSub: string): Promise<Expense[]> {
    return this.dataSource.getRepository(Expense).find({
      where: { tenantId, ownerSub },
      order: { expenseDate: 'DESC', createdAt: 'DESC' },
    });
  }
}
