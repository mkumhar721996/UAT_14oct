import { randomUUID } from 'node:crypto';
import { FindOperator } from 'typeorm';

type Row = Record<string, any>;

class FakeRepository {
  rows: Row[] = [];

  create(data: Row): Row {
    return { ...data };
  }

  async save(row: Row): Promise<Row> {
    if (!row.id) {
      row.id = randomUUID();
      row.createdAt = row.createdAt ?? new Date();
      if ('effectiveDate' in row && 'field' in row && !('requestedValue' in row)) row.recordedAt = new Date();
      if ('requestedValue' in row) row.submittedAt = new Date();
      this.rows.push(row);
    } else if (this.rows.includes(row) || this.rows.some((r) => r.id === row.id)) {
      this.rows = this.rows.map((r) => (r.id === row.id ? { ...row } : r));
    } else {
      this.rows.push(row);
    }
    return row;
  }

  async find(opts: { where?: Row } = {}): Promise<Row[]> {
    return this.rows.filter((r) => matches(r, opts.where)).map((r) => ({ ...r }));
  }

  async findOne(opts: { where?: Row }): Promise<Row | null> {
    const found = this.rows.find((r) => matches(r, opts.where));
    return found ? { ...found } : null;
  }

  async findOneBy(where: Row): Promise<Row | null> {
    return this.findOne({ where });
  }
}

function matchesValue(actual: unknown, expected: unknown): boolean {
  if (expected instanceof FindOperator) {
    if (expected.type === 'in') {
      return (expected.value as unknown[]).includes(actual);
    }
    if (expected.type === 'not') {
      return !matchesValue(actual, expected.child ?? expected.value);
    }
    throw new Error(`Unsupported operator ${expected.type}`);
  }
  return actual === expected;
}

function matches(row: Row, where?: Row): boolean {
  return Object.entries(where ?? {}).every(([k, v]) => matchesValue(row[k], v));
}

/**
 * Minimal in-memory stand-in for TypeORM's DataSource (no Postgres in the sandbox).
 * Also shaped enough (`options`, `entityMetadatas`) to satisfy `@nestjs/typeorm`'s
 * `TypeOrmModule.forFeature()` provider factory, so `@InjectRepository` keeps working
 * when this is swapped in for the real `DataSource` in e2e tests.
 */
export class FakeDataSource {
  private repos = new Map<unknown, FakeRepository>();
  private seq = 1044;

  readonly options = { type: 'postgres' as const };
  readonly entityMetadatas: unknown[] = [];

  getRepository(entity: unknown): any {
    if (!this.repos.has(entity)) this.repos.set(entity, new FakeRepository());
    return this.repos.get(entity);
  }

  getTreeRepository(entity: unknown): any {
    return this.getRepository(entity);
  }

  getMongoRepository(entity: unknown): any {
    return this.getRepository(entity);
  }

  async transaction<T>(cb: (manager: { getRepository: (e: unknown) => any }) => Promise<T>): Promise<T> {
    return cb({ getRepository: (e) => this.getRepository(e) });
  }

  async query(): Promise<{ n: string }[]> {
    this.seq += 1;
    return [{ n: String(this.seq) }];
  }
}
