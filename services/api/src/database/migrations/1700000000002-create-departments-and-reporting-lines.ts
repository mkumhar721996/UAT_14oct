import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateDepartmentsAndReportingLines1700000000002 implements MigrationInterface {
  name = 'CreateDepartmentsAndReportingLines1700000000002';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE departments (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id uuid NOT NULL,
        name text NOT NULL,
        parent_id uuid REFERENCES departments(id),
        manager_id uuid NOT NULL REFERENCES employees(id),
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )`);
    await q.query(`CREATE INDEX idx_departments_tenant_parent ON departments (tenant_id, parent_id)`);
    await q.query(`ALTER TABLE employees ADD COLUMN department_id uuid REFERENCES departments(id)`);
    await q.query(`ALTER TABLE employees ADD COLUMN manager_id uuid REFERENCES employees(id)`);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE employees DROP COLUMN manager_id`);
    await q.query(`ALTER TABLE employees DROP COLUMN department_id`);
    await q.query(`DROP TABLE departments`);
  }
}
