import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateSapMappingsAndShipToPlaceholder1700000000004 implements MigrationInterface {
  name = 'CreateSapMappingsAndShipToPlaceholder1700000000004';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE sap_customer_mappings (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        distributor_id uuid NOT NULL REFERENCES distributors(id),
        sap_instance text NOT NULL,
        sap_customer_number text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )`);
    await q.query(`CREATE INDEX idx_sap_customer_mappings_distributor_id ON sap_customer_mappings (distributor_id)`);
    // Placeholder pending the confirmed WOM Ship-To structure; replaced by
    // migration 1700000000006, never edited in place.
    await q.query(`
      CREATE TABLE ship_to_addresses (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        distributor_id uuid NOT NULL REFERENCES distributors(id),
        placeholder_address text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      )`);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE ship_to_addresses`);
    await q.query(`DROP INDEX idx_sap_customer_mappings_distributor_id`);
    await q.query(`DROP TABLE sap_customer_mappings`);
  }
}
