import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { randomUUID } from 'crypto';
import { DataSource } from 'typeorm';
import { CartLineItem } from '../src/carts/entities/cart-line-item.entity';
import { Cart } from '../src/carts/entities/cart.entity';
import { migrations } from '../src/database/data-source';
import { Distributor } from '../src/distributors/entities/distributor.entity';
import { Order } from '../src/orders/entities/order.entity';
import { RetryQueueEntry } from '../src/orders/entities/retry-queue-entry.entity';
import { Role } from '../src/rbac/entities/role.entity';
import { User } from '../src/users/entities/user.entity';
import { createMigratedDataSource, createPgMemDb, dataSourceFor } from './support/create-pg-mem-data-source';

const columnsOf = async (source: DataSource, table: string): Promise<string[]> =>
  (await source.query(`SELECT column_name FROM information_schema.columns WHERE table_name = '${table}'`)).map(
    (r: { column_name: string }) => r.column_name,
  );

describe('schema migrations', () => {
  let ds: DataSource;
  let distributor: Distributor;
  let user: User;
  let cart: Cart;
  let parent: Order;
  let child: Order;

  beforeEach(async () => {
    ds = await createMigratedDataSource();
    distributor = await ds.getRepository(Distributor).save({ name: 'Acme' });
    user = await ds.getRepository(User).save({ distributorId: distributor.id, email: 'a@example.com' });
    cart = await ds.getRepository(Cart).save({ userId: user.id, distributorId: distributor.id });
    parent = await ds.getRepository(Order).save({ distributorId: distributor.id, cartId: cart.id, orderType: 'parent' });
    child = await ds.getRepository(Order).save({
      distributorId: distributor.id,
      orderType: 'child',
      parentOrderId: parent.id,
      sapInstance: 'EU01',
      placementStatus: 'submitted',
      sapOrderNumber: '4500001234',
    });
  });

  afterEach(async () => {
    await ds.destroy();
  });

  it('AC1: migrations run successfully against an empty database', async () => {
    const fresh = await createMigratedDataSource();
    expect(fresh.isInitialized).toBe(true);
    await fresh.destroy();
  });

  it('AC2: creates every POC table', async () => {
    const qr = ds.createQueryRunner();
    for (const table of [
      'distributors', 'users', 'roles', 'permissions', 'sap_customer_mappings',
      'ship_to_addresses', 'carts', 'cart_line_items', 'orders', 'retry_queue',
    ]) {
      expect(await qr.hasTable(table)).toBe(true);
    }
    await qr.release();
  });

  it('AC3: a cart line item exposes its quantity', async () => {
    const line = await ds.getRepository(CartLineItem).save({ cartId: cart.id, sapMaterialNumber: 'MAT-1', quantity: 4 });
    const found = await ds.getRepository(CartLineItem).findOneByOrFail({ id: line.id });
    expect(found.quantity).toBe(4);
  });

  it('AC4: a child order exposes SAP instance, placement status and SAP order number', async () => {
    const found = await ds.getRepository(Order).findOneByOrFail({ id: child.id });
    expect(found).toMatchObject({ sapInstance: 'EU01', placementStatus: 'submitted', sapOrderNumber: '4500001234' });
  });

  it('AC5: rejects a child order with no parent order reference', async () => {
    await expect(ds.getRepository(Order).save({ distributorId: distributor.id, orderType: 'child' })).rejects.toThrow();
  });

  it('AC6: a retry queue entry exposes its tracking fields', async () => {
    const entry = await ds.getRepository(RetryQueueEntry).save({
      childOrderId: child.id,
      distributorId: distributor.id,
      attemptCount: 1,
      nextRetryAt: new Date(),
      status: 'pending',
      lastError: 'SAP timeout',
    });
    const found = await ds.getRepository(RetryQueueEntry).findOneByOrFail({ id: entry.id });
    expect(found).toMatchObject({ childOrderId: child.id, attemptCount: 1, status: 'pending', lastError: 'SAP timeout' });
    expect(found.nextRetryAt).toBeInstanceOf(Date);
  });

  it('AC7: rejects a row in users/carts/orders/retry_queue referencing a nonexistent distributor', async () => {
    const bogus = randomUUID();
    await expect(ds.getRepository(User).save({ distributorId: bogus, email: 'b@example.com' })).rejects.toThrow();
    await expect(ds.getRepository(Cart).save({ userId: user.id, distributorId: bogus })).rejects.toThrow();
    await expect(ds.getRepository(Order).save({ distributorId: bogus, orderType: 'parent' })).rejects.toThrow();
    await expect(ds.getRepository(RetryQueueEntry).save({ childOrderId: child.id, distributorId: bogus })).rejects.toThrow();
  });

  it('AC8: indexes exist on the required lookup columns', async () => {
    // pg-mem has no pg_indexes catalog; read indexes through its own API.
    const db = createPgMemDb();
    const migrated = dataSourceFor(db, migrations);
    await migrated.initialize();
    await migrated.runMigrations();
    const hasIndexOn = (table: string, column: string) =>
      db.public.getTable(table).listIndices().some((i) => i.expressions.includes(column));
    expect(hasIndexOn('orders', 'sap_order_number')).toBe(true);
    expect(hasIndexOn('carts', 'user_id')).toBe(true);
    expect(hasIndexOn('sap_customer_mappings', 'distributor_id')).toBe(true);
    await migrated.destroy();
  });

  it('AC9: rejects a cart with no user reference', async () => {
    await expect(ds.getRepository(Cart).save({ distributorId: distributor.id } as any)).rejects.toThrow();
  });

  it('AC10: a cart line item has no price-shaped column at all', async () => {
    const names = ds.getMetadata(CartLineItem).columns.map((c) => c.propertyName.toLowerCase());
    expect(names.some((n) => n.includes('price'))).toBe(false);
    expect((await columnsOf(ds, 'cart_line_items')).some((c) => c.includes('price'))).toBe(false);
  });

  it('AC11: no role rows exist after migrating an empty database', async () => {
    expect(await ds.getRepository(Role).find()).toHaveLength(0);
  });

  it('AC12/AC13: replacing the Ship-To placeholder leaves prior migrations untouched and removes the placeholder column', async () => {
    const db = createPgMemDb();
    const upTo = migrations.slice(0, migrations.findIndex((m) => m.name.startsWith('CreateSapMappingsAndShipToPlaceholder')) + 1);
    const ds1 = dataSourceFor(db, upTo);
    await ds1.initialize();
    await ds1.runMigrations();
    const before = (await ds1.query('SELECT name FROM migrations ORDER BY id')).map((m: any) => m.name);
    expect(await columnsOf(ds1, 'ship_to_addresses')).toContain('placeholder_address');
    await ds1.destroy();

    const ds2 = dataSourceFor(db, migrations);
    await ds2.initialize();
    await ds2.runMigrations();
    const after = (await ds2.query('SELECT name FROM migrations ORDER BY id')).map((m: any) => m.name);
    expect(after.length).toBeGreaterThan(before.length);
    expect(after.slice(0, before.length)).toEqual(before);
    const wom = await columnsOf(ds2, 'ship_to_addresses');
    expect(wom).not.toContain('placeholder_address');
    expect(wom).toContain('address_line1');
    await ds2.destroy();
  });

  it('AC14: defaults the attempt limit to 3', async () => {
    const saved = await ds.getRepository(RetryQueueEntry).save({ childOrderId: child.id, distributorId: distributor.id });
    const found = await ds.getRepository(RetryQueueEntry).findOneByOrFail({ id: saved.id });
    expect(found.attemptLimit).toBe(3);
  });

  it('AC15: defaults the initial retry interval to 30 seconds', async () => {
    const saved = await ds.getRepository(RetryQueueEntry).save({ childOrderId: child.id, distributorId: distributor.id });
    const found = await ds.getRepository(RetryQueueEntry).findOneByOrFail({ id: saved.id });
    expect(found.initialIntervalSeconds).toBe(30);
  });
});
