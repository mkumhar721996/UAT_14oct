import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateBookingsSchema1700000000003 implements MigrationInterface {
  name = 'CreateBookingsSchema1700000000003';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto`);
    await q.query(`
      CREATE TABLE bookings (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id uuid NOT NULL,
        customer_sub text NOT NULL,
        service_type text NOT NULL CHECK (service_type IN ('Faucet repair','Drain cleaning','Water heater install','AC tune-up')),
        status text NOT NULL DEFAULT 'Requested',
        created_at timestamptz NOT NULL DEFAULT now()
      )`);
    await q.query(`CREATE INDEX idx_bookings_tenant_customer ON bookings (tenant_id, customer_sub)`);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE bookings`);
  }
}
