import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateDefectsSchema1700000000002 implements MigrationInterface {
  name = 'CreateDefectsSchema1700000000002';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE SEQUENCE IF NOT EXISTS defect_number_seq START 1001`);
    await q.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto`);
    await q.query(`
      CREATE TABLE defects (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id uuid NOT NULL,
        defect_number text NOT NULL,
        title text NOT NULL,
        description text NOT NULL,
        repro_steps text NOT NULL,
        severity text NOT NULL,
        priority text,
        type text NOT NULL,
        status text NOT NULL,
        triaged_at timestamptz,
        reporter_id text NOT NULL,
        reporter_name text,
        assignee_id text,
        assignee_name text,
        environment text,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT uq_defects_tenant_number UNIQUE (tenant_id, defect_number)
      )`);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE defects`);
    await q.query(`DROP SEQUENCE defect_number_seq`);
  }
}
