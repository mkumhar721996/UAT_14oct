import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { describe, expect, it } from 'vitest';
import { Actor } from './actor.types';
import { Roles } from './roles.decorator';
import { RolesGuard } from './roles.guard';

class Handlers {
  @Roles('recruiter', 'hr_admin')
  reviewOnly() {}

  open() {}
}

function contextFor(
  handler: () => void,
  actor?: Actor,
  user?: { role: string },
) {
  return {
    getHandler: () => handler,
    getClass: () => Handlers,
    switchToHttp: () => ({ getRequest: () => ({ headers: {}, actor, user }) }),
  } as never;
}

describe('RolesGuard', () => {
  const guard = new RolesGuard(new Reflector());
  const proto = Handlers.prototype;

  it('allows an actor whose role is listed', () => {
    expect(
      guard.canActivate(
        contextFor(proto.reviewOnly, { id: 'morgan', role: 'hr_admin' }),
      ),
    ).toBe(true);
  });

  it('refuses an actor whose role is not listed', () => {
    expect(() =>
      guard.canActivate(
        contextFor(proto.reviewOnly, { id: 'priya', role: 'hiring_manager' }),
      ),
    ).toThrow(ForbiddenException);
  });

  it('refuses a request without an actor', () => {
    expect(() => guard.canActivate(contextFor(proto.reviewOnly))).toThrow(
      UnauthorizedException,
    );
  });

  it('allows any request to an undecorated handler', () => {
    expect(guard.canActivate(contextFor(proto.open))).toBe(true);
  });

  it('never lets a forged actor role override a verified request.user role', () => {
    expect(() =>
      guard.canActivate(
        contextFor(
          proto.reviewOnly,
          { id: 'priya', role: 'hr_admin' },
          { role: 'employee' },
        ),
      ),
    ).toThrow(ForbiddenException);
  });
});
