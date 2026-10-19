import { createHash, timingSafeEqual } from 'node:crypto';
import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { loadRevalidationConfig } from './revalidation-config';

// Hashing first gives equal-length buffers, so the comparison is constant-time regardless of input length.
const digest = (value: string) => createHash('sha256').update(value).digest();

@Injectable()
export class RevalidationSecretGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const header: string | undefined = request.headers?.['x-revalidation-secret'];
    const { secret } = loadRevalidationConfig(process.env);
    if (typeof header !== 'string' || !timingSafeEqual(digest(header), digest(secret))) throw new UnauthorizedException('Invalid revalidation secret');
    return true;
  }
}
