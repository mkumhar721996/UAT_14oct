import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateDefectsSchema1700000000002 implements MigrationInterface {
  name = 'CreateDefectsSchema1700000000002';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto`);
    await q.query(`
      CREATE TABLE defects (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id uuid NOT NULL,
        title text NOT NULL,
        description text NOT NULL,
        severity text NOT NULL CHECK (severity IN ('Critical','High','Medium','Low')),
        steps_to_reproduce text NOT NULL,
        expected_result text,
        actual_result text,
        environment text,
        status text NOT NULL DEFAULT 'New',
        reported_by text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )`);
    await q.query(`CREATE INDEX idx_defects_tenant_status ON defects (tenant_id, status)`);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE defects`);
  }
}
