import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateExpensesSchema1700000000007 implements MigrationInterface {
  name = 'CreateExpensesSchema1700000000007';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto`);
    await q.query(`
      CREATE TABLE expenses (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id uuid NOT NULL,
        user_sub text NOT NULL,
        amount numeric(12,2) NOT NULL CHECK (amount > 0),
        currency text NOT NULL,
        spent_on date NOT NULL,
        merchant text NULL,
        category text NOT NULL CHECK (category IN ('Food','Travel','Other')),
        note text NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      )`);
    await q.query(`CREATE INDEX idx_expenses_tenant_user_spent_on ON expenses (tenant_id, user_sub, spent_on)`);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE expenses`);
  }
}
