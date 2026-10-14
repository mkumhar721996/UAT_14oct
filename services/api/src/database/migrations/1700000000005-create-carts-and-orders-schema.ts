import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCartsAndOrdersSchema1700000000005 implements MigrationInterface {
  name = 'CreateCartsAndOrdersSchema1700000000005';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE carts (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL REFERENCES users(id),
        distributor_id uuid NOT NULL REFERENCES distributors(id),
        status text NOT NULL DEFAULT 'open',
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )`);
    await q.query(`CREATE INDEX idx_carts_user_id ON carts (user_id)`);
    await q.query(`
      CREATE TABLE cart_line_items (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        cart_id uuid NOT NULL REFERENCES carts(id),
        sap_material_number text NOT NULL,
        quantity integer NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )`);
    await q.query(`
      CREATE TABLE orders (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        distributor_id uuid NOT NULL REFERENCES distributors(id),
        cart_id uuid REFERENCES carts(id),
        order_type text NOT NULL CHECK (order_type IN ('parent','child')),
        parent_order_id uuid REFERENCES orders(id),
        sap_instance text,
        placement_status text NOT NULL DEFAULT 'pending',
        sap_order_number text,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT chk_orders_child_has_parent CHECK (order_type <> 'child' OR parent_order_id IS NOT NULL)
      )`);
    await q.query(`CREATE INDEX idx_orders_sap_order_number ON orders (sap_order_number)`);
    await q.query(`
      CREATE TABLE retry_queue (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        child_order_id uuid NOT NULL REFERENCES orders(id),
        distributor_id uuid NOT NULL REFERENCES distributors(id),
        attempt_count integer NOT NULL DEFAULT 0,
        attempt_limit integer NOT NULL DEFAULT 3,
        initial_interval_seconds integer NOT NULL DEFAULT 30,
        next_retry_at timestamptz,
        status text NOT NULL DEFAULT 'pending',
        last_error text,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )`);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE retry_queue`);
    await q.query(`DROP INDEX idx_orders_sap_order_number`);
    await q.query(`DROP TABLE orders`);
    await q.query(`DROP TABLE cart_line_items`);
    await q.query(`DROP INDEX idx_carts_user_id`);
    await q.query(`DROP TABLE carts`);
  }
}
