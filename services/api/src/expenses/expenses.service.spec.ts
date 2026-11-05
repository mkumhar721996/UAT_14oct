import { describe, expect, it } from 'vitest';
import { FakeDataSource } from '../../test/support/fake-data-source';
import { AuthUser } from '../auth/auth-user';
import { ExpensesService } from './expenses.service';

const user = (over: Partial<AuthUser> = {}) => ({ sub: 'u1', currency: 'EUR', ...over }) as AuthUser;

describe('ExpensesService', () => {
  const service = () => new ExpensesService(new FakeDataSource() as any);

  it('lists a saved expense in the profile currency', async () => {
    const s = service();
    await s.createExpense('t1', user(), { amount: 12.5, date: '2026-11-01', category: 'Food' });
    expect(await s.listExpenses('t1', user())).toMatchObject({ currency: 'EUR', expenses: [{ amount: '12.50', currency: 'EUR' }] });
  });

  it('keeps a minimum amount of 0.01', async () => {
    const s = service();
    await s.createExpense('t1', user(), { amount: 0.01, date: '2026-11-01', category: 'Food' });
    expect((await s.listExpenses('t1', user())).expenses[0].amount).toBe('0.01');
  });

  it('stores blank optional fields as null and falls back to USD', async () => {
    const s = service();
    const view = await s.createExpense('t1', user({ currency: null }), { amount: 3, date: '2026-11-01', category: 'Other', merchant: ' ', note: '' });
    expect(view).toMatchObject({ currency: 'USD', merchant: null, note: null, spentOn: '2026-11-01' });
  });

  it('returns only the caller’s rows, newest first, and the currency for an empty list', async () => {
    const s = service();
    await s.createExpense('t1', user(), { amount: 1, date: '2026-11-01', category: 'Food' });
    await s.createExpense('t1', user(), { amount: 2, date: '2026-11-03', category: 'Food' });
    await s.createExpense('t1', user({ sub: 'u2' }), { amount: 3, date: '2026-11-04', category: 'Food' });
    expect((await s.listExpenses('t1', user())).expenses.map((e) => e.amount)).toEqual(['2.00', '1.00']);
    expect(await s.listExpenses('t2', user())).toEqual({ currency: 'EUR', expenses: [] });
  });
});
