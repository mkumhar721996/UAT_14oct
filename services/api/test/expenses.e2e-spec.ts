import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Expense } from '../src/expenses/entities/expense.entity';
import { createTestApp, TENANT, tokenFor } from './support/create-test-app';

const OTHER_TENANT = '22222222-2222-4222-8222-222222222222';

describe('Expenses (e2e)', () => {
  let app: INestApplication;
  const http = () => request(app.getHttpServer());
  const auth = (sub: string) => `Bearer ${tokenFor({ sub, 'custom:role': 'employee' })}`;
  const seed = (rows: Partial<Expense>[]) => Promise.all(rows.map((r) => app.get(DataSource).getRepository(Expense).save({ tenantId: TENANT, note: null, ...r })));

  beforeAll(async () => {
    app = await createTestApp();
  });
  afterAll(async () => {
    await app.close();
  });

  it('rejects a request without a token', async () => {
    expect((await http().get('/expenses')).status).toBe(401);
  });

  it('AC13: lists only the signed-in user\'s expenses, within their tenant', async () => {
    await seed([
      { ownerSub: 'user-a', amount: '5.00', expenseDate: '2026-05-01', merchant: 'A-shop', category: 'Food' },
      { ownerSub: 'user-b', amount: '6.00', expenseDate: '2026-05-01', merchant: 'B-shop', category: 'Food' },
      { ownerSub: 'user-a', tenantId: OTHER_TENANT, amount: '7.00', expenseDate: '2026-05-01', merchant: 'Other-tenant', category: 'Food' },
    ]);
    const res = await http().get('/expenses').set('Authorization', auth('user-a'));
    expect(res.status).toBe(200);
    expect(res.body.map((e: any) => e.merchant)).toEqual(['A-shop']);
  });

  it('AC3: returns newest first', async () => {
    await seed([
      { ownerSub: 'user-sort', amount: '1.00', expenseDate: '2026-09-20', merchant: 'm1', category: 'Food' },
      { ownerSub: 'user-sort', amount: '1.00', expenseDate: '2026-11-01', merchant: 'm2', category: 'Food' },
      { ownerSub: 'user-sort', amount: '1.00', expenseDate: '2026-10-10', merchant: 'm3', category: 'Food' },
    ]);
    const res = await http().get('/expenses').set('Authorization', auth('user-sort'));
    expect(res.body.map((e: any) => e.expenseDate)).toEqual(['2026-11-01', '2026-10-10', '2026-09-20']);
  });

  it('AC14-AC17: each row carries amount, date, merchant, category and note', async () => {
    await seed([{ ownerSub: 'user-fields', amount: '12.50', expenseDate: '2026-05-03', merchant: 'Cafe', category: 'Food' }]);
    const res = await http().get('/expenses').set('Authorization', auth('user-fields'));
    expect(res.body[0]).toMatchObject({ amount: '12.50', expenseDate: '2026-05-03', merchant: 'Cafe', category: 'Food', note: null });
  });
});
