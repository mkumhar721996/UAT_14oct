import { Injectable, NestMiddleware } from '@nestjs/common';
import { ACTOR_ROLES, ActorRequest, ActorRole } from './actor.types';

/**
 * Temporary stand-in for real (Cognito) authentication: reads the acting user
 * from `x-actor-id` / `x-actor-role` headers. This is the only place identity
 * is extracted, so replacing it with verified token claims is a one-file change.
 *
 * Headers are forgeable, so this fails closed: in production they are ignored and every
 * protected route answers 401 until real token verification replaces this middleware.
 */
@Injectable()
export class ActorMiddleware implements NestMiddleware {
  use(req: ActorRequest, _res: unknown, next: () => void): void {
    if (process.env.NODE_ENV === 'production') {
      next();
      return;
    }
    const id = req.headers['x-actor-id'];
    const role = req.headers['x-actor-role'];
    if (
      typeof id === 'string' &&
      id.length > 0 &&
      typeof role === 'string' &&
      (ACTOR_ROLES as readonly string[]).includes(role)
    ) {
      req.actor = { id, role: role as ActorRole };
    }
    next();
  }
}
