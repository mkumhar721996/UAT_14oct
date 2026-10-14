import { MigrationInterface, QueryRunner } from 'typeorm';

export class UniquePendingChangeRequest1700000000001 implements MigrationInterface {
  name = 'UniquePendingChangeRequest1700000000001';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE UNIQUE INDEX uq_pending_change_requests_open
      ON pending_change_requests (tenant_id, employee_id, field)
      WHERE status = 'pending'
    `);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP INDEX uq_pending_change_requests_open`);
  }
}
