import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RevalidationSecretGuard } from './revalidation-secret.guard';

const contextFor = (request: Record<string, unknown>) =>
  ({ switchToHttp: () => ({ getRequest: () => request }) }) as unknown as ExecutionContext;

describe('RevalidationSecretGuard', () => {
  const guard = new RevalidationSecretGuard();
  beforeEach(() => vi.stubEnv('REVALIDATION_SECRET', 'fake-secret'));
  afterEach(() => vi.unstubAllEnvs());

  it('accepts the matching secret', () => {
    expect(guard.canActivate(contextFor({ headers: { 'x-revalidation-secret': 'fake-secret' } }))).toBe(true);
  });

  it('rejects an absent secret', () => {
    expect(() => guard.canActivate(contextFor({ headers: {} }))).toThrow(UnauthorizedException);
  });

  it('rejects a wrong secret', () => {
    expect(() => guard.canActivate(contextFor({ headers: { 'x-revalidation-secret': 'nope' } }))).toThrow(UnauthorizedException);
  });
});
