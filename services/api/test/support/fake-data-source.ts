import { randomUUID } from 'node:crypto';

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
    } else {
      this.rows = this.rows.map((r) => (r.id === row.id ? { ...row } : r));
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
}

function matches(row: Row, where?: Row): boolean {
  return Object.entries(where ?? {}).every(([k, v]) => row[k] === v);
}

/** Minimal in-memory stand-in for TypeORM's DataSource (no Postgres in the sandbox). */
export class FakeDataSource {
  private repos = new Map<unknown, FakeRepository>();
  private seq = 1044;

  getRepository(entity: unknown): any {
    if (!this.repos.has(entity)) this.repos.set(entity, new FakeRepository());
    return this.repos.get(entity);
  }

  async transaction<T>(cb: (manager: { getRepository: (e: unknown) => any }) => Promise<T>): Promise<T> {
    return cb({ getRepository: (e) => this.getRepository(e) });
  }

  async query(): Promise<{ n: string }[]> {
    this.seq += 1;
    return [{ n: String(this.seq) }];
  }
}
