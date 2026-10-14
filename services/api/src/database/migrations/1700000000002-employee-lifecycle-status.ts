import { MigrationInterface, QueryRunner } from 'typeorm';

export class EmployeeLifecycleStatus1700000000002 implements MigrationInterface {
  name = 'EmployeeLifecycleStatus1700000000002';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE employees ADD COLUMN status text NOT NULL DEFAULT 'active'`);
    await q.query(`ALTER TABLE employees ADD CONSTRAINT ck_employees_status CHECK (status IN ('active', 'on_leave', 'terminated'))`);
    await q.query(`ALTER TABLE employees ADD COLUMN rehired_from_id uuid REFERENCES employees(id)`);
    await q.query(`CREATE INDEX ix_employees_tenant_status ON employees (tenant_id, status)`);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP INDEX ix_employees_tenant_status`);
    await q.query(`ALTER TABLE employees DROP COLUMN rehired_from_id`);
    await q.query(`ALTER TABLE employees DROP CONSTRAINT ck_employees_status`);
    await q.query(`ALTER TABLE employees DROP COLUMN status`);
  }
}
