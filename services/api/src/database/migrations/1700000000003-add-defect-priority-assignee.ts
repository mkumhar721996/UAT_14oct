import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDefectPriorityAssignee1700000000003 implements MigrationInterface {
  name = 'AddDefectPriorityAssignee1700000000003';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE defects ADD COLUMN priority text, ADD COLUMN assignee_name text`);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE defects DROP COLUMN priority, DROP COLUMN assignee_name`);
  }
}
