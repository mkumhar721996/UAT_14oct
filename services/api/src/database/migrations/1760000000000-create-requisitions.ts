import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateRequisitions1760000000000 implements MigrationInterface {
  name = 'CreateRequisitions1760000000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" varchar PRIMARY KEY,
        "name" varchar NOT NULL,
        "role" varchar NOT NULL,
        "employment_status" varchar NOT NULL DEFAULT 'active'
      )`);
    await queryRunner.query(`
      CREATE TABLE "job_requisitions" (
        "id" SERIAL PRIMARY KEY,
        "title" varchar NOT NULL,
        "department" varchar,
        "location" varchar,
        "employment_type" varchar NOT NULL DEFAULT 'Full-time',
        "headcount" integer NOT NULL DEFAULT 1,
        "start_date" date,
        "description" text,
        "salary_min" integer,
        "salary_max" integer,
        "hiring_manager_id" varchar NOT NULL REFERENCES "users" ("id"),
        "status" varchar NOT NULL DEFAULT 'draft',
        "pipeline" jsonb NOT NULL DEFAULT '[]',
        "submitted_at" timestamptz,
        "approved_by" varchar,
        "published_at" timestamptz,
        "rejected_by" varchar,
        "rejected_at" timestamptz,
        "rejection_reason" text,
        "last_saved_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "job_requisitions_status_check"
          CHECK ("status" IN ('draft', 'pending_approval', 'open', 'rejected'))
      )`);
    await queryRunner.query(
      `CREATE INDEX "job_requisitions_status_idx" ON "job_requisitions" ("status")`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "job_requisitions"`);
    await queryRunner.query(`DROP TABLE "users"`);
  }
}
