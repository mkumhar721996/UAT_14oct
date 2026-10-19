import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { loadRevalidationConfig } from './revalidation-config';

@Injectable()
export class RevalidationSecretGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const header: string | undefined = request.headers?.['x-revalidation-secret'];
    const { secret } = loadRevalidationConfig(process.env);
    if (!header || header !== secret) throw new UnauthorizedException('Invalid revalidation secret');
    return true;
  }
}
