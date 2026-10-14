import { MigrationInterface, QueryRunner } from 'typeorm';

export class ReplaceShipToPlaceholderWithWomStructure1700000000006 implements MigrationInterface {
  name = 'ReplaceShipToPlaceholderWithWomStructure1700000000006';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE ship_to_addresses DROP COLUMN placeholder_address`);
    // Transient defaults let NOT NULL columns be added even if rows exist; dropped right after.
    for (const col of ['address_line1', 'city', 'postal_code', 'country_code']) {
      await q.query(`ALTER TABLE ship_to_addresses ADD COLUMN ${col} text NOT NULL DEFAULT ''`);
      await q.query(`ALTER TABLE ship_to_addresses ALTER COLUMN ${col} DROP DEFAULT`);
    }
    await q.query(`ALTER TABLE ship_to_addresses ADD COLUMN address_line2 text`);
    await q.query(`ALTER TABLE ship_to_addresses ADD COLUMN region text`);
    await q.query(`ALTER TABLE ship_to_addresses ADD COLUMN sap_ship_to_number text`);
  }

  async down(q: QueryRunner): Promise<void> {
    for (const col of ['address_line1', 'address_line2', 'city', 'region', 'postal_code', 'country_code', 'sap_ship_to_number']) {
      await q.query(`ALTER TABLE ship_to_addresses DROP COLUMN ${col}`);
    }
    await q.query(`ALTER TABLE ship_to_addresses ADD COLUMN placeholder_address text NOT NULL DEFAULT ''`);
    await q.query(`ALTER TABLE ship_to_addresses ALTER COLUMN placeholder_address DROP DEFAULT`);
  }
}
