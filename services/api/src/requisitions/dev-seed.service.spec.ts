import { afterEach, describe, expect, it, vi } from 'vitest';
import { FakeRepository } from '../../test/support/fake-repository';
import { User } from '../database/entities/user.entity';
import { DevSeedService } from './dev-seed.service';

describe('DevSeedService', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('populates the development users, including hiring managers and a non-manager', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    const users = new FakeRepository<User>();
    await new DevSeedService(users as never).onApplicationBootstrap();
    expect(users.rows.find((u) => u.id === 'priya')?.role).toBe('hiring_manager');
    expect(users.rows.find((u) => u.id === 'morgan')?.role).toBe('hr_admin');
    expect(users.rows.some((u) => u.role !== 'hiring_manager' && u.id === 'sam')).toBe(true);
  });

  it('does not touch the users table in production', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const users = new FakeRepository<User>();
    await new DevSeedService(users as never).onApplicationBootstrap();
    expect(users.rows).toHaveLength(0);
  });
});
