import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateDistributorsAndRbacSchema1700000000003 implements MigrationInterface {
  name = 'CreateDistributorsAndRbacSchema1700000000003';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto`);
    await q.query(`
      CREATE TABLE distributors (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        name text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )`);
    await q.query(`
      CREATE TABLE roles (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        name text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      )`);
    await q.query(`
      CREATE TABLE permissions (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        name text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      )`);
    await q.query(`
      CREATE TABLE users (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        distributor_id uuid NOT NULL REFERENCES distributors(id),
        role_id uuid REFERENCES roles(id),
        email text NOT NULL,
        name text,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )`);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE users`);
    await q.query(`DROP TABLE permissions`);
    await q.query(`DROP TABLE roles`);
    await q.query(`DROP TABLE distributors`);
  }
}
