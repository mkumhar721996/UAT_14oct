import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ActorRequest, ActorRole } from './actor.types';
import { ROLES_KEY } from './roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<ActorRole[] | undefined>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required || required.length === 0) {
      return true;
    }
    const actor = context.switchToHttp().getRequest<ActorRequest>().actor;
    if (!actor) {
      throw new UnauthorizedException('Sign in to continue.');
    }
    if (!required.includes(actor.role)) {
      throw new ForbiddenException('Your role cannot perform this action.');
    }
    return true;
  }
}
