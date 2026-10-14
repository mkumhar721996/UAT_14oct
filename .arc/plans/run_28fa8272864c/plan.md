summary: |
  Adds the schema and TypeORM migrations for the ten POC entities named in
  UAT-14OCT-STORY-025 (Distributors, Users, Roles, Permissions, SAP Customer Mappings,
  Ship-To Addresses, Carts, Cart Line Items, Orders, Retry Queue) to `services/api`,
  following the exact raw-SQL-migration + plain-column-entity convention already
  established by `create-employees-schema`/`create-defects-schema`. Orders model both
  the parent (cart-derived) order and its per-SAP-instance child orders as rows in one
  self-referencing `orders` table, with a CHECK constraint enforcing that a child row
  always carries a parent reference. The Ship-To Addresses table is deliberately built
  across two migrations — a minimal placeholder, then a later migration that drops the
  placeholder column and adds the confirmed structured ("WOM") address columns — to
  prove the migration chain evolves non-destructively, mirroring the existing
  `UniquePendingChangeRequest1700000000001` additive-follow-up pattern. Only schema,
  migrations and entity classes are in scope; no modules/services/controllers/DTOs are
  added (those are for the services that will consume this data model later), and no
  seed data is inserted (AC11 depends on that). Because this sandbox has no real
  Postgres available (the existing test harness's `FakeDataSource` says so explicitly:
  "no Postgres in the sandbox"), and environment/RDS provisioning is explicitly
  out-of-scope for this story, the migration-level acceptance criteria are verified
  against `pg-mem` — an in-memory engine that implements enough real Postgres (DDL,
  FK/CHECK/UNIQUE enforcement, `information_schema`/`pg_catalog` introspection) to run
  the actual TypeORM migration classes and repositories unmodified via
  `pg-mem`'s `db.adapters.createTypeormDataSource()` bridge, which is the standard way
  this library is used to test real TypeORM migrations without a live server.
scope:
  - description: |
      Refactor `data-source.ts` to export the `entities` and `migrations` arrays as
      named consts (not just inline inside `dataSourceOptions()`), so both the real
      CLI data source and the new test harness can import the exact same lists instead
      of duplicating them.

      ```ts
      export const entities = [Employee, EmploymentHistoryEntry, PendingChangeRequest, Defect,
        Distributor, Role, Permission, User, SapCustomerMapping, ShipToAddress,
        Cart, CartLineItem, Order, RetryQueueEntry];
      export const migrations = [CreateEmployeesSchema1700000000000, UniquePendingChangeRequest1700000000001,
        CreateDefectsSchema1700000000002, CreateDistributorsAndRbacSchema1700000000003,
        CreateSapMappingsAndShipToPlaceholder1700000000004, CreateCartsAndOrdersSchema1700000000005,
        ReplaceShipToPlaceholderWithWomStructure1700000000006];
      export const dataSourceOptions = (): DataSourceOptions => ({ type: 'postgres', url: process.env.DATABASE_URL, entities, migrations });
      ```
    files:
      - services/api/src/database/data-source.ts
    rationale: |
      `typeorm.module.ts` keeps working unchanged (it only calls `dataSourceOptions()`).
      The pg-mem test harness needs the identical entity/migration lists to build a
      `DataSource` that proves the real migration files run cleanly, not a hand-copied
      subset that could silently drift from what `migration:run` actually executes.
  - description: |
      Add a `migration:run` script so "the services/api migration command" named by
      AC1 actually exists, using the already-present `typeorm` CLI binary against the
      compiled output (no new `ts-node` dependency needed, since `data-source.ts` is a
      plain TypeScript file with no path aliases).
      ```json
      "migration:run": "pnpm run build && typeorm migration:run -d dist/database/data-source.js"
      ```
    files:
      - services/api/package.json
    rationale: |
      No migration-running script exists today. `nest build` already emits
      `dist/database/data-source.js` (CommonJS, per `tsconfig.build.json`'s
      `outDir: "./dist"`), and `typeorm` is already a dependency whose package exposes
      a `typeorm` CLI bin — reusing it avoids adding `ts-node`/`typeorm-ts-node-commonjs`
      purely for this one script.
  - description: |
      Add the ten new entity classes, one domain folder per group, using the exact
      column-naming convention already used by `Employee`/`Defect` (snake_case via
      `name:`, `@PrimaryGeneratedColumn('uuid')`, `@CreateDateColumn`/`@UpdateDateColumn`,
      plain uuid FK columns with no `@ManyToOne` relations — referential integrity is
      enforced at the migration/DB level only, matching how `EmploymentHistoryEntry`
      references `employeeId`).

      Key shapes:
      ```ts
      // carts/entities/cart-line-item.entity.ts — AC3/AC10: quantity exposed, no price column at all
      @Entity('cart_line_items')
      export class CartLineItem {
        @PrimaryGeneratedColumn('uuid') id!: string;
        @Column({ name: 'cart_id', type: 'uuid' }) cartId!: string;
        @Column({ name: 'sap_material_number', type: 'text' }) sapMaterialNumber!: string;
        @Column({ type: 'int' }) quantity!: number;
        @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt!: Date;
        @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' }) updatedAt!: Date;
      }
      ```
      ```ts
      // orders/entities/order.entity.ts — AC4/AC5: self-referencing parent/child
      export type OrderType = 'parent' | 'child';
      @Entity('orders')
      export class Order {
        @PrimaryGeneratedColumn('uuid') id!: string;
        @Column({ name: 'distributor_id', type: 'uuid' }) distributorId!: string;
        @Column({ name: 'cart_id', type: 'uuid', nullable: true }) cartId!: string | null;
        @Column({ name: 'order_type', type: 'text' }) orderType!: OrderType;
        @Column({ name: 'parent_order_id', type: 'uuid', nullable: true }) parentOrderId!: string | null;
        @Column({ name: 'sap_instance', type: 'text', nullable: true }) sapInstance!: string | null;
        @Column({ name: 'placement_status', type: 'text', default: 'pending' }) placementStatus!: string;
        @Column({ name: 'sap_order_number', type: 'text', nullable: true }) sapOrderNumber!: string | null;
        @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt!: Date;
        @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' }) updatedAt!: Date;
      }
      ```
      ```ts
      // orders/entities/retry-queue-entry.entity.ts — AC6/AC14/AC15
      @Entity('retry_queue')
      export class RetryQueueEntry {
        @PrimaryGeneratedColumn('uuid') id!: string;
        @Column({ name: 'child_order_id', type: 'uuid' }) childOrderId!: string;
        @Column({ name: 'distributor_id', type: 'uuid' }) distributorId!: string;
        @Column({ name: 'attempt_count', type: 'int', default: 0 }) attemptCount!: number;
        @Column({ name: 'attempt_limit', type: 'int', default: 3 }) attemptLimit!: number;
        @Column({ name: 'initial_interval_seconds', type: 'int', default: 30 }) initialIntervalSeconds!: number;
        @Column({ name: 'next_retry_at', type: 'timestamptz', nullable: true }) nextRetryAt!: Date | null;
        @Column({ type: 'text', default: 'pending' }) status!: string;
        @Column({ name: 'last_error', type: 'text', nullable: true }) lastError!: string | null;
        @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt!: Date;
        @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' }) updatedAt!: Date;
      }
      ```
      The remaining six entities (`Distributor`, `Role`, `Permission`, `User`,
      `SapCustomerMapping`, `ShipToAddress`) follow the same column-mapping style; see
      the migrations below for their exact columns — `ShipToAddress` reflects only the
      final, post-replacement ("WOM") shape (`addressLine1/2`, `city`, `region`,
      `postalCode`, `countryCode`, `sapShipToNumber`), never the dropped placeholder
      column, matching how `Employee` only ever reflects current-state columns.
    files:
      - services/api/src/distributors/entities/distributor.entity.ts
      - services/api/src/rbac/entities/role.entity.ts
      - services/api/src/rbac/entities/permission.entity.ts
      - services/api/src/users/entities/user.entity.ts
      - services/api/src/sap/entities/sap-customer-mapping.entity.ts
      - services/api/src/sap/entities/ship-to-address.entity.ts
      - services/api/src/carts/entities/cart.entity.ts
      - services/api/src/carts/entities/cart-line-item.entity.ts
      - services/api/src/orders/entities/order.entity.ts
      - services/api/src/orders/entities/retry-queue-entry.entity.ts
    rationale: |
      One domain folder per group (`distributors`, `rbac`, `users`, `sap`, `carts`,
      `orders`) mirrors the existing `employees/entities/*`/`defects/entities/*`
      layout. `CartLineItem` has no price-shaped column at all (not merely
      `nullable`/unused) so AC10 holds structurally, not by convention. `Order` uses one
      self-referencing table with an `orderType` discriminator instead of a separate
      "child orders" table, since AC2's table list names only `Orders` (singular) and
      the epic describes "order parent/child relationships" as one concept.
  - description: |
      Add migration `1700000000003-create-distributors-and-rbac-schema.ts` creating
      `distributors`, `roles`, `permissions`, `users` (in that FK dependency order,
      none seeded — AC11).
      ```sql
      CREATE EXTENSION IF NOT EXISTS pgcrypto;
      CREATE TABLE distributors (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        name text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE TABLE roles (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        name text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE TABLE permissions (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        name text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE TABLE users (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        distributor_id uuid NOT NULL REFERENCES distributors(id),
        role_id uuid REFERENCES roles(id),
        email text NOT NULL,
        name text,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
      ```
      `down()` drops `users`, `permissions`, `roles`, `distributors` in that reverse
      order.
    files:
      - services/api/src/database/migrations/1700000000003-create-distributors-and-rbac-schema.ts
      - services/api/src/database/data-source.ts
    rationale: |
      `users.distributor_id NOT NULL REFERENCES distributors(id)` is what AC7 enforces
      for Users; `role_id` is a nullable FK rather than a join table because no AC
      exercises a roles↔permissions mapping (see assumptions) — only the table's
      existence and emptiness (AC2/AC11) are tested.
  - description: |
      Add migration `1700000000004-create-sap-mappings-and-shipto-placeholder.ts`
      creating `sap_customer_mappings` (with the AC8 index) and the Ship-To
      **placeholder** table.
      ```sql
      CREATE TABLE sap_customer_mappings (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        distributor_id uuid NOT NULL REFERENCES distributors(id),
        sap_instance text NOT NULL,
        sap_customer_number text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX idx_sap_customer_mappings_distributor_id ON sap_customer_mappings (distributor_id);

      -- Placeholder pending the confirmed WOM Ship-To structure; replaced by
      -- migration 1700000000006, never edited in place.
      CREATE TABLE ship_to_addresses (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        distributor_id uuid NOT NULL REFERENCES distributors(id),
        placeholder_address text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      );
      ```
      `down()` drops `ship_to_addresses`, the index, then `sap_customer_mappings`.
    files:
      - services/api/src/database/migrations/1700000000004-create-sap-mappings-and-shipto-placeholder.ts
      - services/api/src/database/data-source.ts
    rationale: |
      `idx_sap_customer_mappings_distributor_id` backs AC8 directly. The placeholder
      table exists only so AC12/AC13 have a real "already applied" migration to
      replace — its single `placeholder_address` column is intentionally minimal since
      the real WOM shape isn't confirmed yet (see assumptions).
  - description: |
      Add migration `1700000000005-create-carts-and-orders-schema.ts` creating
      `carts` (AC8 index), `cart_line_items`, `orders` (AC4/AC5/AC8) and `retry_queue`
      (AC6/AC7/AC14/AC15).
      ```sql
      CREATE TABLE carts (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL REFERENCES users(id),
        distributor_id uuid NOT NULL REFERENCES distributors(id),
        status text NOT NULL DEFAULT 'open',
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX idx_carts_user_id ON carts (user_id);

      CREATE TABLE cart_line_items (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        cart_id uuid NOT NULL REFERENCES carts(id),
        sap_material_number text NOT NULL,
        quantity integer NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );

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
      );
      CREATE INDEX idx_orders_sap_order_number ON orders (sap_order_number);

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
      );
      ```
      `down()` drops in reverse: `retry_queue`, the `idx_orders_sap_order_number`
      index, `orders`, `cart_line_items`, the `idx_carts_user_id` index, `carts`.
    files:
      - services/api/src/database/migrations/1700000000005-create-carts-and-orders-schema.ts
      - services/api/src/database/data-source.ts
    rationale: |
      `chk_orders_child_has_parent` is the DB-level enforcement for AC5 (a `child` row
      with a null `parent_order_id` fails the CHECK). `distributor_id NOT NULL
      REFERENCES distributors(id)` on `carts`, `orders` and `retry_queue` is AC7's
      enforcement for those three tables (`users` gets the same in the prior
      migration). `user_id NOT NULL REFERENCES users(id)` on `carts` is AC9's
      enforcement. `cart_line_items` intentionally has no price-shaped column (AC10).
  - description: |
      Add migration `1700000000006-replace-shipto-placeholder-with-wom-structure.ts`,
      the AC12/AC13 replacement: it does not touch migrations 1700000000000-005, it
      only alters `ship_to_addresses`.
      ```sql
      ALTER TABLE ship_to_addresses
        DROP COLUMN placeholder_address,
        ADD COLUMN address_line1 text NOT NULL DEFAULT '',
        ADD COLUMN address_line2 text,
        ADD COLUMN city text NOT NULL DEFAULT '',
        ADD COLUMN region text,
        ADD COLUMN postal_code text NOT NULL DEFAULT '',
        ADD COLUMN country_code text NOT NULL DEFAULT '',
        ADD COLUMN sap_ship_to_number text;
      ALTER TABLE ship_to_addresses ALTER COLUMN address_line1 DROP DEFAULT;
      ALTER TABLE ship_to_addresses ALTER COLUMN city DROP DEFAULT;
      ALTER TABLE ship_to_addresses ALTER COLUMN postal_code DROP DEFAULT;
      ALTER TABLE ship_to_addresses ALTER COLUMN country_code DROP DEFAULT;
      ```
      `down()` reverses this: drops the five new columns and re-adds
      `placeholder_address text NOT NULL DEFAULT ''` then drops that default.
    files:
      - services/api/src/database/migrations/1700000000006-replace-shipto-placeholder-with-wom-structure.ts
      - services/api/src/database/data-source.ts
    rationale: |
      A transient `DEFAULT ''` on the new `NOT NULL` columns lets the `ALTER TABLE` run
      safely even if the placeholder table already held rows (immediately dropped
      after, so the final schema has no default) — this is the same additive-migration
      discipline already established by `UniquePendingChangeRequest1700000000001`
      (a second, never-edited-in-place migration file layered on top of
      `create-employees-schema`).
  - description: |
      Add the `pg-mem`-backed test harness: builds one in-memory Postgres-compatible
      `IMemoryDb`, registers `gen_random_uuid()` (pg-mem's documented stand-in for the
      `pgcrypto` extension our migrations call), and exposes a helper to create a real
      TypeORM `DataSource` against it for a given migration subset — letting two
      `DataSource`s share the same underlying in-memory store (needed for AC12/AC13's
      "already applied, then run the replacement" staging).
      ```ts
      export function createPgMemDb() {
        const db = newDb({ autoCreateForeignKeyIndices: true });
        db.public.registerFunction({ name: 'gen_random_uuid', returns: DataType.uuid, implementation: randomUUID, impure: true });
        return db;
      }
      export function dataSourceFor(db: IMemoryDb, migrationSubset: MigrationInterface[]): DataSource {
        return db.adapters.createTypeormDataSource({ type: 'postgres', entities, migrations: migrationSubset });
      }
      export async function createMigratedDataSource(): Promise<DataSource> {
        const ds = dataSourceFor(createPgMemDb(), migrations);
        await ds.initialize();
        await ds.runMigrations();
        return ds;
      }
      ```
    files:
      - services/api/test/support/create-pg-mem-data-source.ts
    rationale: |
      No existing test infrastructure runs real migrations — `FakeDataSource`
      (`test/support/fake-data-source.ts`) has no `runMigrations`/constraint
      enforcement and is deliberately out of scope here (it exists for business-logic
      e2e tests, not schema verification). `pg-mem`'s `createTypeormDataSource` is
      the one bridge that lets the real migration classes and real TypeORM repository
      constraint enforcement (FK/CHECK/UNIQUE/defaults) run against something other
      than a live Postgres server, which this sandbox doesn't have.
  - description: |
      Add `test/schema-migrations.e2e-spec.ts` with one test per acceptance criterion
      (see `tests` below for the concrete assertions), run via the existing
      `pnpm run test:e2e` (`vitest.config.e2e.ts` already includes
      `test/**/*.e2e-spec.ts`) — no vitest config change needed.
    files:
      - services/api/test/schema-migrations.e2e-spec.ts
    rationale: |
      Keeps this story's tests in the same `test/*.e2e-spec.ts` location and runner as
      `employees.e2e-spec.ts`/`defects.e2e-spec.ts`, just exercising the data layer
      directly (repositories + `QueryRunner` introspection) instead of going through
      HTTP, since no controller exists yet for this domain.
tests:
  - |
    AC1 — migrations run successfully against an empty (pg-mem) database:
    ```ts
    it('AC1: migrations run successfully against an empty database', async () => {
      const ds = await createMigratedDataSource();
      expect(ds.isInitialized).toBe(true);
      await ds.destroy();
    });
    ```
  - |
    AC2 — all ten tables exist after migrating:
    ```ts
    it('AC2: creates every POC table', async () => {
      const ds = await createMigratedDataSource();
      const qr = ds.createQueryRunner();
      for (const table of ['distributors','users','roles','permissions','sap_customer_mappings',
        'ship_to_addresses','carts','cart_line_items','orders','retry_queue']) {
        expect(await qr.hasTable(table)).toBe(true);
      }
      await qr.release(); await ds.destroy();
    });
    ```
  - |
    AC3 — a cart line item exposes its quantity:
    ```ts
    it('AC3: a cart line item exposes its quantity', async () => {
      const line = await ds.getRepository(CartLineItem).save({ cartId: cart.id, sapMaterialNumber: 'MAT-1', quantity: 4 });
      const found = await ds.getRepository(CartLineItem).findOneByOrFail({ id: line.id });
      expect(found.quantity).toBe(4);
    });
    ```
  - |
    AC4 — a child order exposes SAP instance, placement status and SAP order number:
    ```ts
    it('AC4: a child order exposes SAP instance, placement status and SAP order number', async () => {
      const found = await ds.getRepository(Order).findOneByOrFail({ id: child.id });
      expect(found).toMatchObject({ sapInstance: 'EU01', placementStatus: 'submitted', sapOrderNumber: '4500001234' });
    });
    ```
  - |
    AC5 — a child order with no parent reference is rejected:
    ```ts
    it('AC5: rejects a child order with no parent order reference', async () => {
      await expect(ds.getRepository(Order).save({ distributorId, orderType: 'child' })).rejects.toThrow();
    });
    ```
  - |
    AC6 — a retry queue entry exposes its tracking fields:
    ```ts
    it('AC6: a retry queue entry exposes its tracking fields', async () => {
      const found = await ds.getRepository(RetryQueueEntry).findOneByOrFail({ id: entry.id });
      expect(found).toMatchObject({ childOrderId: child.id, attemptCount: 1, status: 'pending', lastError: 'SAP timeout' });
      expect(found.nextRetryAt).toBeInstanceOf(Date);
    });
    ```
  - |
    AC7 — Users/Carts/Orders/Retry Queue reject a nonexistent distributor reference:
    ```ts
    it('AC7: rejects a row in users/carts/orders/retry_queue referencing a nonexistent distributor', async () => {
      const bogus = randomUUID();
      await expect(ds.getRepository(User).save({ distributorId: bogus, email: 'a@b.com' })).rejects.toThrow();
      await expect(ds.getRepository(Cart).save({ userId: realUser.id, distributorId: bogus })).rejects.toThrow();
      await expect(ds.getRepository(Order).save({ distributorId: bogus, orderType: 'parent' })).rejects.toThrow();
      await expect(ds.getRepository(RetryQueueEntry).save({ childOrderId: realChild.id, distributorId: bogus })).rejects.toThrow();
    });
    ```
  - |
    AC8 — indexes exist on Orders.sapOrderNumber, Carts.userId, SapCustomerMappings.distributorId:
    ```ts
    it('AC8: indexes exist on the required lookup columns', async () => {
      const qr = ds.createQueryRunner();
      expect((await qr.getTable('orders'))!.indices.some(i => i.columnNames.includes('sap_order_number'))).toBe(true);
      expect((await qr.getTable('carts'))!.indices.some(i => i.columnNames.includes('user_id'))).toBe(true);
      expect((await qr.getTable('sap_customer_mappings'))!.indices.some(i => i.columnNames.includes('distributor_id'))).toBe(true);
    });
    ```
  - |
    AC9 — a cart with no user reference is rejected:
    ```ts
    it('AC9: rejects a cart with no user reference', async () => {
      await expect(ds.getRepository(Cart).save({ distributorId } as any)).rejects.toThrow();
    });
    ```
  - |
    AC10 — a cart line item never exposes a stored price (structural, not just empty):
    ```ts
    it('AC10: a cart line item has no price-shaped column at all', async () => {
      const columnNames = ds.getMetadata(CartLineItem).columns.map(c => c.propertyName.toLowerCase());
      expect(columnNames.some(n => n.includes('price'))).toBe(false);
    });
    ```
  - |
    AC11 — no role rows exist on an empty, freshly-migrated database:
    ```ts
    it('AC11: no role rows exist after migrating an empty database', async () => {
      expect(await ds.getRepository(Role).find()).toHaveLength(0);
    });
    ```
  - |
    AC12/AC13 — the WOM replacement migration leaves earlier migrations' recorded
    history unchanged and removes the placeholder structure (staged over the SAME
    underlying pg-mem store, modeling "already applied" then "run the replacement"):
    ```ts
    it('AC12/AC13: replacing the Ship-To placeholder leaves prior migrations untouched and removes the placeholder column', async () => {
      const db = createPgMemDb();
      const upToPlaceholder = migrations.slice(0, migrations.findIndex(m => m.name.startsWith('CreateSapMappingsAndShipToPlaceholder')) + 1);
      const ds1 = dataSourceFor(db, upToPlaceholder);
      await ds1.initialize(); await ds1.runMigrations();
      const before = (await ds1.query('SELECT name FROM migrations ORDER BY id')).map((m: any) => m.name);
      const placeholderTable = await ds1.createQueryRunner().getTable('ship_to_addresses');
      expect(placeholderTable!.columns.some(c => c.name === 'placeholder_address')).toBe(true);
      await ds1.destroy();

      const ds2 = dataSourceFor(db, migrations);
      await ds2.initialize(); await ds2.runMigrations();
      const after = (await ds2.query('SELECT name FROM migrations ORDER BY id')).map((m: any) => m.name);
      expect(after.slice(0, before.length)).toEqual(before); // AC12
      const womTable = await ds2.createQueryRunner().getTable('ship_to_addresses');
      expect(womTable!.columns.some(c => c.name === 'placeholder_address')).toBe(false); // AC13
      expect(womTable!.columns.some(c => c.name === 'address_line1')).toBe(true);
      await ds2.destroy();
    });
    ```
  - |
    AC14 — a retry queue entry defaults its attempt limit to 3 when not specified:
    ```ts
    it('AC14: defaults the attempt limit to 3', async () => {
      const saved = await ds.getRepository(RetryQueueEntry).save({ childOrderId: child.id, distributorId, status: 'pending' } as any);
      const found = await ds.getRepository(RetryQueueEntry).findOneByOrFail({ id: saved.id });
      expect(found.attemptLimit).toBe(3);
    });
    ```
  - |
    AC15 — a retry queue entry defaults its initial interval to 30 seconds when not specified:
    ```ts
    it('AC15: defaults the initial retry interval to 30 seconds', async () => {
      const found = await ds.getRepository(RetryQueueEntry).findOneByOrFail({ id: saved.id });
      expect(found.initialIntervalSeconds).toBe(30);
    });
    ```
assumptions_or_open_questions:
  - |
    This sandbox has no reachable Postgres server (the existing `FakeDataSource`
    comment states this outright, and no `.env`/docker-compose/CI config defines a
    `DATABASE_URL` anywhere in the repo), and the story's own scope explicitly
    excludes environment provisioning. All fifteen acceptance criteria are therefore
    verified against `pg-mem` rather than a live Amazon RDS Postgres 16 instance. This
    is the best available substitute for "an empty PostgreSQL database" in this
    environment, not a claim that `pg-mem`'s SQL compatibility is 100% identical to
    real Postgres — if a real RDS instance becomes reachable later (e.g. in CI), the
    same migrations/`migration:run` script should also be smoke-tested there.
  - |
    "WOM structure" (AC12/AC13) isn't defined anywhere in the repo, story, or epic
    beyond that phrase, so the "confirmed" Ship-To shape (`addressLine1/2`, `city`,
    `region`, `postalCode`, `countryCode`, `sapShipToNumber`) is this plan's own
    reasonable guess at a standard SAP ship-to address, built specifically so a real
    placeholder-then-replace migration pair exists to test AC12/AC13 against. A future
    story should correct these columns once the actual WOM field list is confirmed —
    doing so is just another additive migration, per the pattern this plan establishes.
  - |
    Roles/Permissions are created as two independent, unlinked tables (no
    `role_permissions` join table, no `user_roles` join table beyond `users.role_id`)
    because no acceptance criterion exercises a roles↔permissions relationship — only
    that the tables exist (AC2) and that Roles starts empty (AC11). Building that
    relationship is left to whichever future story actually implements RBAC
    enforcement.
  - |
    Modeled "child orders" as rows in one self-referencing `orders` table
    (`orderType: 'parent' | 'child'`, `parentOrderId`) rather than a second table,
    since AC2 names only one `Orders` table and the epic describes "order
    parent/child relationships" as a single concept, not two entities.
  - |
    No controllers/services/DTOs/modules are added for any of the ten new domains —
    the story scope line says "Table/entity design and TypeORM migrations only," and
    the epic frames this story as enabling *other* services to build persistence on
    top of this model, not as this story building that persistence layer itself.
  - |
    `pg-mem`'s `db.adapters.createTypeormDataSource()` can be called more than once
    against the same underlying `IMemoryDb` to produce independent `DataSource`s that
    share the same in-memory data — this plan's AC12/AC13 test depends on that
    capability to stage "placeholder already applied" before "replacement runs". If
    the installed `pg-mem` version doesn't support reusing one `IMemoryDb` this way,
    the test will need restructuring (e.g. asserting directly against the migration
    *files*' table/column diffs instead of two staged connections), but the migration
    SQL itself does not change.
estimated_points: 8
package_dependencies:
  - name: pg-mem
    version: ^3.0.5
    ecosystem: npm
    component_id: comp_api_service
    rationale: |
      In-memory Postgres-compatible engine used to run the real TypeORM migration
      classes and repository constraint enforcement (FK/CHECK/UNIQUE/defaults) in
      tests, since no live Postgres is reachable in this sandbox and real RDS
      provisioning is out of this story's scope.
notes: |
  ```mermaid
  flowchart TD
    classDef touched fill:#f96,color:#000
    classDef context fill:#eee,color:#000

    DataSource["data-source.ts\n(entities + migrations exported)"]:::touched
    TypeOrmModule["typeorm.module.ts"]:::context
    M0["migrations 000-002\n(employees, pending-change, defects)"]:::context
    M3["1700000000003\ndistributors/roles/permissions/users"]:::touched
    M4["1700000000004\nsap_customer_mappings +\nship_to_addresses (placeholder)"]:::touched
    M5["1700000000005\ncarts/cart_line_items/orders/retry_queue"]:::touched
    M6["1700000000006\nreplace Ship-To placeholder\nwith WOM structure"]:::touched
    Entities["10 new entity classes\n(distributors/rbac/users/sap/carts/orders)"]:::touched
    PgMemHarness["test/support/create-pg-mem-data-source.ts"]:::touched
    SchemaTest["test/schema-migrations.e2e-spec.ts"]:::touched
    PgMem[("pg-mem\nIMemoryDb")]:::context
    PackageJson["package.json\n(migration:run script)"]:::touched

    DataSource --> M0
    DataSource --> M3 --> M4 --> M5 --> M6
    DataSource --> Entities
    TypeOrmModule --> DataSource
    PackageJson -->|"typeorm migration:run -d dist/..."| DataSource
    PgMemHarness -->|"db.adapters.createTypeormDataSource"| PgMem
    PgMemHarness --> DataSource
    SchemaTest --> PgMemHarness
    SchemaTest --> Entities
  ```
review_focus: |
  In scope: raw-SQL migrations + plain TypeORM entity classes for the ten named
  tables, following the existing `create-employees-schema`/`create-defects-schema`
  convention exactly — no controllers, services, DTOs, modules or seed data. Riskiest
  area: this is the first time any test in this repo runs real migrations and real DB
  constraint enforcement (every prior e2e spec uses the in-memory `FakeDataSource`,
  which has neither) — the `pg-mem` harness is new, and its two-staged-DataSource
  approach for AC12/AC13 is the least conventional piece here; a reviewer should check
  it actually proves "earlier migrations are untouched" rather than just "the final
  schema looks right." Also deliberate and not a gap to flag: the Ship-To "WOM"
  column list is this plan's own reasonable placeholder for an unconfirmed structure
  (see assumptions), and Roles/Permissions are intentionally left unlinked since no AC
  exercises that relationship.
