import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateEmployeesSchema1700000000000 implements MigrationInterface {
  name = 'CreateEmployeesSchema1700000000000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE SEQUENCE IF NOT EXISTS employee_number_seq START 1001`);
    await q.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto`);
    await q.query(`
      CREATE TABLE employees (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id uuid NOT NULL,
        employee_number text NOT NULL,
        full_name text NOT NULL,
        start_date date NOT NULL,
        job_title text,
        department text,
        contract_type text,
        salary numeric(12,2),
        personal_email text,
        phone text,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT uq_employees_tenant_number UNIQUE (tenant_id, employee_number)
      )`);
    await q.query(`
      CREATE TABLE employment_history_entries (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id uuid NOT NULL,
        employee_id uuid NOT NULL REFERENCES employees(id),
        field text NOT NULL,
        previous_value text,
        new_value text,
        effective_date date NOT NULL,
        recorded_at timestamptz NOT NULL DEFAULT now(),
        recorded_by text
      )`);
    await q.query(`CREATE INDEX idx_history_tenant_employee ON employment_history_entries (tenant_id, employee_id)`);
    await q.query(`
      CREATE TABLE pending_change_requests (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id uuid NOT NULL,
        employee_id uuid NOT NULL REFERENCES employees(id),
        field text NOT NULL,
        requested_value text NOT NULL,
        effective_date date NOT NULL,
        note text,
        status text NOT NULL DEFAULT 'pending',
        submitted_at timestamptz NOT NULL DEFAULT now(),
        resolved_at timestamptz,
        resolved_by text
      )`);
    await q.query(`CREATE INDEX idx_pending_tenant_status ON pending_change_requests (tenant_id, status)`);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE pending_change_requests`);
    await q.query(`DROP TABLE employment_history_entries`);
    await q.query(`DROP TABLE employees`);
    await q.query(`DROP SEQUENCE employee_number_seq`);
  }
}
