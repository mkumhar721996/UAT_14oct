import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateExpensesSchema1700000000007 implements MigrationInterface {
  name = 'CreateExpensesSchema1700000000007';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto`);
    await q.query(`
      CREATE TABLE expenses (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id uuid NOT NULL,
        owner_sub text NOT NULL,
        amount numeric(12,2) NOT NULL,
        expense_date date NOT NULL,
        merchant text NOT NULL,
        category text NOT NULL,
        note text,
        created_at timestamptz NOT NULL DEFAULT now()
      )`);
    await q.query(`CREATE INDEX idx_expenses_tenant_owner_date ON expenses (tenant_id, owner_sub, expense_date DESC)`);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE expenses`);
  }
}
