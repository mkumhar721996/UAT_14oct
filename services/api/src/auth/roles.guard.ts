import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '../employees/employee-fields';
import { ActorRequest, ActorRole } from './actor.types';
import { AuthUser } from './auth-user';
import { ROLES_KEY } from './roles.decorator';

type GuardedRequest = ActorRequest & { user?: AuthUser };

/**
 * Shared role guard: requisitions/jobs routes populate `request.actor`
 * (ActorMiddleware's dev stand-in); employee-profile routes populate
 * `request.user` (CognitoAuthGuard, which runs first and already rejects
 * unauthenticated requests).
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<(ActorRole | Role)[] | undefined>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required || required.length === 0) {
      return true;
    }
    const request = context.switchToHttp().getRequest<GuardedRequest>();
    // A verified Cognito-authenticated user always wins over the dev actor stand-in,
    // so a forged x-actor-role header can never shadow a real token's role.
    const role = request.user?.role ?? request.actor?.role;
    if (!role) {
      throw new UnauthorizedException('Sign in to continue.');
    }
    if (!required.includes(role)) {
      throw new ForbiddenException('Your role cannot perform this action.');
    }
    return true;
  }
}
