import { CognitoJwtVerifier } from 'aws-jwt-verify';

export const TOKEN_VERIFIER = Symbol('TOKEN_VERIFIER');

export interface TokenVerifier {
  verify(token: string): Promise<Record<string, unknown>>;
}

/** Verifies Cognito access tokens; the verifier is built lazily so the app boots without Cognito env set. */
export class CognitoTokenVerifier implements TokenVerifier {
  private verifier?: ReturnType<typeof CognitoJwtVerifier.create>;

  verify(token: string): Promise<Record<string, unknown>> {
    this.verifier ??= CognitoJwtVerifier.create({
      userPoolId: process.env.COGNITO_USER_POOL_ID ?? '',
      clientId: process.env.COGNITO_CLIENT_ID ?? '',
      tokenUse: 'access',
    });
    return this.verifier.verify(token) as Promise<Record<string, unknown>>;
  }
}
