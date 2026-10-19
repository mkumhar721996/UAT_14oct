import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDefectWorkflowNotes1700000000006 implements MigrationInterface {
  name = 'AddDefectWorkflowNotes1700000000006';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE defects ADD COLUMN resolution_note text, ADD COLUMN reopen_reason text`);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE defects DROP COLUMN resolution_note, DROP COLUMN reopen_reason`);
  }
}
