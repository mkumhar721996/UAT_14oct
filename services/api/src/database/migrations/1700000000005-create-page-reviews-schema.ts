import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePageReviewsSchema1700000000005 implements MigrationInterface {
  name = 'CreatePageReviewsSchema1700000000005';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE page_reviews (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      page_id text NOT NULL UNIQUE,
      reviewer_name text NOT NULL,
      review_date date NOT NULL,
      result text NOT NULL CHECK (result IN ('pass','fail')),
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )`);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE page_reviews`);
  }
}
