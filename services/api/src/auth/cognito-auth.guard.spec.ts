import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { CognitoAuthGuard } from './cognito-auth.guard';
import { TokenVerifier } from './token-verifier';

const contextFor = (request: Record<string, unknown>) =>
  ({ switchToHttp: () => ({ getRequest: () => request }) }) as unknown as ExecutionContext;

const verifierFor = (claims: Record<string, unknown>): TokenVerifier => ({ verify: async () => claims });

describe('CognitoAuthGuard', () => {
  it('accepts a real Cognito ID token, reading role/tenant/employee from custom:-prefixed claims', async () => {
    const guard = new CognitoAuthGuard(
      verifierFor({ sub: 'cust-1', 'custom:role': 'customer', 'custom:tenant_id': 'tenant-1', 'custom:employee_id': null }),
    );
    const request: Record<string, unknown> = { headers: { authorization: 'Bearer token' } };
    await expect(guard.canActivate(contextFor(request))).resolves.toBe(true);
    expect(request.user).toEqual({ sub: 'cust-1', tenantId: 'tenant-1', role: 'customer', employeeId: null });
  });

  it('falls back to plain role/tenant_id claims for tokens without the custom: prefix', async () => {
    const guard = new CognitoAuthGuard(verifierFor({ sub: 'emp-1', role: 'employee', tenant_id: 'tenant-1', employee_id: 'e-1' }));
    const request: Record<string, unknown> = { headers: { authorization: 'Bearer token' } };
    await expect(guard.canActivate(contextFor(request))).resolves.toBe(true);
    expect(request.user).toEqual({ sub: 'emp-1', tenantId: 'tenant-1', role: 'employee', employeeId: 'e-1' });
  });

  it('rejects a token missing the required claims', async () => {
    const guard = new CognitoAuthGuard(verifierFor({ sub: 'cust-1' }));
    const request: Record<string, unknown> = { headers: { authorization: 'Bearer token' } };
    await expect(guard.canActivate(contextFor(request))).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects a request with no bearer token', async () => {
    const guard = new CognitoAuthGuard(verifierFor({}));
    await expect(guard.canActivate(contextFor({ headers: {} }))).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
