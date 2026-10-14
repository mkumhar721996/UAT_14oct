import { randomUUID } from 'crypto';
import { DataType, IMemoryDb, newDb } from 'pg-mem';
import { DataSource, MigrationInterface } from 'typeorm';
import { entities, migrations } from '../../src/database/data-source';

// pg-mem stands in for Postgres (no server in the sandbox); gen_random_uuid()
// replaces the pgcrypto function the migrations rely on.
export function createPgMemDb(): IMemoryDb {
  const db = newDb({ autoCreateForeignKeyIndices: true });
  db.public.registerFunction({ name: 'gen_random_uuid', returns: DataType.uuid, implementation: randomUUID, impure: true });
  db.public.registerFunction({ name: 'version', returns: DataType.text, implementation: () => 'PostgreSQL 16 (pg-mem)' });
  db.public.registerFunction({ name: 'current_database', returns: DataType.text, implementation: () => 'pgmem' });
  db.registerExtension('pgcrypto', () => undefined);
  return db;
}

// Several DataSources can share one in-memory store, to stage "already applied" migrations.
export function dataSourceFor(db: IMemoryDb, migrationSubset: Array<new () => MigrationInterface>): DataSource {
  return db.adapters.createTypeormDataSource({ type: 'postgres', entities, migrations: migrationSubset });
}

export async function createMigratedDataSource(): Promise<DataSource> {
  const ds = dataSourceFor(createPgMemDb(), migrations);
  await ds.initialize();
  await ds.runMigrations();
  return ds;
}
