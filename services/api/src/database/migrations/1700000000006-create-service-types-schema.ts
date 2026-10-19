import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateServiceTypesSchema1700000000006 implements MigrationInterface {
  name = 'CreateServiceTypesSchema1700000000006';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto`);
    await q.query(`
      CREATE TABLE service_types (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id uuid NOT NULL,
        name text NOT NULL,
        description text,
        active boolean NOT NULL DEFAULT true,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )`);
    await q.query(`CREATE UNIQUE INDEX uq_service_types_tenant_name ON service_types (tenant_id, lower(name))`);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE service_types`);
  }
}
