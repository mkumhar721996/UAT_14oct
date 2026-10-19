import { CanActivate, ExecutionContext, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { ROLES, Role } from './roles';
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

    // Cognito ID tokens carry custom attributes under a `custom:` prefix; plain claim names are
    // kept as a fallback for tokens minted outside Cognito's custom-attribute mechanism.
    const { sub } = claims;
    const tenantId = claims['custom:tenant_id'] ?? claims.tenant_id;
    const role = claims['custom:role'] ?? claims.role;
    const employeeId = claims['custom:employee_id'] ?? claims.employee_id;
    if (typeof sub !== 'string' || typeof tenantId !== 'string' || !ROLES.includes(role as Role)) {
      throw new UnauthorizedException('Token is missing required claims');
    }
    const user: AuthUser = { sub, tenantId, role: role as Role, employeeId: typeof employeeId === 'string' ? employeeId : null };
    request.user = user;
    return true;
  }
}
