import { CognitoJwtVerifier } from 'aws-jwt-verify';

export const TOKEN_VERIFIER = Symbol('TOKEN_VERIFIER');

export interface TokenVerifier {
  verify(token: string): Promise<Record<string, unknown>>;
}

/**
 * Verifies Cognito ID tokens; the verifier is built lazily so the app boots without Cognito env set.
 * ID tokens (not access tokens) are used because custom attributes such as custom:role and
 * custom:tenant_id are only populated onto the access token when a Pre Token Generation Lambda
 * bridges them there; they are included on the ID token by default, so validating it keeps role
 * and tenant checks working without relying on an out-of-repo Lambda trigger being configured.
 */
export class CognitoTokenVerifier implements TokenVerifier {
  private verifier?: ReturnType<typeof CognitoJwtVerifier.create>;

  verify(token: string): Promise<Record<string, unknown>> {
    this.verifier ??= CognitoJwtVerifier.create({
      userPoolId: process.env.COGNITO_USER_POOL_ID ?? '',
      clientId: process.env.COGNITO_CLIENT_ID ?? '',
      tokenUse: 'id',
    });
    return this.verifier.verify(token) as Promise<Record<string, unknown>>;
  }
}
