import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { createHash, timingSafeEqual } from 'node:crypto';

const digest = (value: string) => createHash('sha256').update(value).digest();

// Fails closed: an unset REVALIDATION_SHARED_SECRET rejects every request.
@Injectable()
export class RevalidationSecretGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const expected = process.env.REVALIDATION_SHARED_SECRET ?? '';
    const header = context.switchToHttp().getRequest().headers['x-revalidate-secret'];
    if (!expected || typeof header !== 'string' || !timingSafeEqual(digest(header), digest(expected))) {
      throw new UnauthorizedException('Invalid revalidation secret');
    }
    return true;
  }
}
