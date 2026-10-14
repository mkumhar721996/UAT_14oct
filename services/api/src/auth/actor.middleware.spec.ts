import { afterEach, describe, expect, it, vi } from 'vitest';
import { ActorRequest } from './actor.types';
import { ActorMiddleware } from './actor.middleware';

const run = (headers: ActorRequest['headers']) => {
  const req: ActorRequest = { headers };
  new ActorMiddleware().use(req, undefined, () => {});
  return req.actor;
};
const hr = { 'x-actor-id': 'morgan', 'x-actor-role': 'hr_admin' };

describe('ActorMiddleware', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('reads the actor from headers outside production', () => {
    vi.stubEnv('NODE_ENV', 'development');
    expect(run(hr)).toEqual({ id: 'morgan', role: 'hr_admin' });
  });

  it('ignores forgeable identity headers in production', () => {
    vi.stubEnv('NODE_ENV', 'production');
    expect(run(hr)).toBeUndefined();
  });

  it('ignores unknown roles', () => {
    vi.stubEnv('NODE_ENV', 'development');
    expect(run({ ...hr, 'x-actor-role': 'admin' })).toBeUndefined();
  });
});
