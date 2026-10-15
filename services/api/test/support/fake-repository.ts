import { FindOperator } from 'typeorm';

/**
 * Minimal in-memory stand-in for a TypeORM repository, covering only the calls
 * RequisitionsService makes. Used by unit and HTTP-level specs so they need no database.
 */
export class FakeRepository<T extends { id: string | number }> {
  rows: T[] = [];
  /** Number of `find` calls, so specs can assert on query counts. */
  findCalls = 0;
  private nextId = 1001;

  constructor(private readonly autoId = false) {}

  create(partial: Partial<T>): T {
    return { ...partial } as T;
  }

  async save(entity: T): Promise<T> {
    if (this.autoId && entity.id === undefined) {
      (entity as { id: number }).id = this.nextId++;
    }
    if (!this.rows.includes(entity)) {
      this.rows.push(entity);
    }
    return entity;
  }

  async findOneBy(where: Partial<T>): Promise<T | null> {
    return this.rows.find((r) => matches(r, where)) ?? null;
  }

  async find(options: { where?: Record<string, unknown> } = {}): Promise<T[]> {
    this.findCalls++;
    return this.rows.filter((r) => matches(r, options.where ?? {}));
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

function matches(row: unknown, where: Record<string, unknown>): boolean {
  return Object.entries(where).every(([key, value]) =>
    matchesValue((row as Record<string, unknown>)[key], value),
  );
}
