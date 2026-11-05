import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CreateExpenseDto } from './create-expense.dto';

const ok = { amount: 12.5, date: '2026-11-01', category: 'Food', merchant: 'Corner Shop' };
const errorsFor = async (body: object, prop: string) =>
  (await validate(plainToInstance(CreateExpenseDto, body))).filter((e) => e.property === prop);

describe('CreateExpenseDto', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-05T12:00:00Z'));
  });
  afterEach(() => vi.useRealTimers());

  it('accepts a valid expense, with or without a merchant', async () => {
    expect(await validate(plainToInstance(CreateExpenseDto, ok))).toEqual([]);
    expect(await validate(plainToInstance(CreateExpenseDto, { ...ok, merchant: undefined }))).toEqual([]);
  });

  it('rejects a date after today and accepts today', async () => {
    expect(await errorsFor({ ...ok, date: '2026-11-06' }, 'date')).toHaveLength(1);
    expect(await errorsFor({ ...ok, date: '2026-11-05' }, 'date')).toHaveLength(0);
  });

  it('rejects a missing date', async () => {
    expect(await errorsFor({ ...ok, date: undefined }, 'date')).toHaveLength(1);
  });

  it('rejects a missing or zero amount, accepts 0.01', async () => {
    expect(await errorsFor({ ...ok, amount: undefined }, 'amount')).toHaveLength(1);
    expect(await errorsFor({ ...ok, amount: 0 }, 'amount')).toHaveLength(1);
    expect(await errorsFor({ ...ok, amount: 0.01 }, 'amount')).toHaveLength(0);
  });

  it('rejects a category outside the fixed list', async () => {
    expect(await errorsFor({ ...ok, category: 'Rent' }, 'category')).toHaveLength(1);
    expect(await errorsFor({ ...ok, category: undefined }, 'category')).toHaveLength(1);
  });
});
