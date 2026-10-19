import { UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import { afterEach, describe, expect, it } from 'vitest';
import { RevalidationSecretGuard } from './revalidation-secret.guard';

const ctx = (headers: Record<string, unknown>) =>
  ({ switchToHttp: () => ({ getRequest: () => ({ headers }) }) }) as unknown as ExecutionContext;
const original = process.env.REVALIDATION_SHARED_SECRET;
afterEach(() => {
  if (original === undefined) delete process.env.REVALIDATION_SHARED_SECRET;
  else process.env.REVALIDATION_SHARED_SECRET = original;
});

describe('RevalidationSecretGuard', () => {
  it('accepts the matching secret', () => {
    process.env.REVALIDATION_SHARED_SECRET = 'test-secret';
    expect(new RevalidationSecretGuard().canActivate(ctx({ 'x-revalidate-secret': 'test-secret' }))).toBe(true);
  });

  it.each([[{ 'x-revalidate-secret': 'wrong' }], [{}]])('rejects %j', (headers) => {
    process.env.REVALIDATION_SHARED_SECRET = 'test-secret';
    expect(() => new RevalidationSecretGuard().canActivate(ctx(headers))).toThrow(UnauthorizedException);
  });

  it('rejects everything when no secret is configured', () => {
    delete process.env.REVALIDATION_SHARED_SECRET;
    expect(() => new RevalidationSecretGuard().canActivate(ctx({ 'x-revalidate-secret': '' }))).toThrow(
      UnauthorizedException,
    );
  });
});
