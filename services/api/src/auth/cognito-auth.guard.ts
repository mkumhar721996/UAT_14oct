import { CanActivate, ExecutionContext, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthUser } from './auth-user';
import { TOKEN_VERIFIER, TokenVerifier } from './token-verifier';

@Injectable()
export class CognitoAuthGuard implements CanActivate {
  constructor(@Inject(TOKEN_VERIFIER) private readonly verifier: TokenVerifier) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const header: string | undefined = request.headers?.authorization;
    if (!header?.startsWith('Bearer ')) throw new UnauthorizedException('Missing bearer token');

    let claims: Record<string, unknown>;
    try {
      claims = await this.verifier.verify(header.slice('Bearer '.length));
    } catch {
      throw new UnauthorizedException('Invalid token');
    }

    const { sub, tenant_id: tenantId, role, employee_id: employeeId } = claims;
    if (typeof sub !== 'string' || typeof tenantId !== 'string' || (role !== 'hr_admin' && role !== 'employee')) {
      throw new UnauthorizedException('Token is missing required claims');
    }
    const user: AuthUser = { sub, tenantId, role, employeeId: typeof employeeId === 'string' ? employeeId : null };
    request.user = user;
    return true;
  }
}
