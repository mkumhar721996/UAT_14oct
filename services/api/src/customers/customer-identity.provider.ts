import {
  AdminCreateUserCommand,
  AdminDeleteUserCommand,
  AdminInitiateAuthCommand,
  AdminSetUserPasswordCommand,
  CognitoIdentityProviderClient,
} from '@aws-sdk/client-cognito-identity-provider';
import { Logger } from '@nestjs/common';
import { createHash } from 'node:crypto';

export const CUSTOMER_IDENTITY_PROVIDER = Symbol('CUSTOMER_IDENTITY_PROVIDER');

/** Email is PII; log a short, non-reversible fingerprint instead of the address itself. */
const hashEmail = (email: string) => createHash('sha256').update(email).digest('hex').slice(0, 16);

export class EmailAlreadyRegisteredError extends Error {}
/** The identity provider's password policy rejected the password. */
export class InvalidPasswordError extends Error {}
/** The identity provider is rate-limiting requests. */
export class ProviderThrottledError extends Error {}

export interface CustomerIdentityProvider {
  signUp(email: string, password: string): Promise<void>;
  /** Resolves null when the credentials don't match (wrong password or unknown email). */
  login(email: string, password: string): Promise<{ accessToken: string } | null>;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const THROTTLE_ERRORS = ['TooManyRequestsException', 'LimitExceededException'];

const errorName = (err: unknown) => (err as Error).name;

/** Creates/authenticates customers in Cognito; the client is built lazily so the app boots without AWS env set. */
export class CognitoCustomerIdentityProvider implements CustomerIdentityProvider {
  private readonly logger = new Logger(CognitoCustomerIdentityProvider.name);
  private client?: CognitoIdentityProviderClient;

  private cognito(): CognitoIdentityProviderClient {
    return (this.client ??= new CognitoIdentityProviderClient({}));
  }

  async signUp(email: string, password: string): Promise<void> {
    const tenantId = process.env.CUSTOMER_TENANT_ID;
    if (!tenantId || !UUID.test(tenantId)) throw new Error('CUSTOMER_TENANT_ID must be set to a uuid before customers can sign up');
    const UserPoolId = process.env.COGNITO_USER_POOL_ID;
    try {
      await this.cognito().send(
        new AdminCreateUserCommand({
          UserPoolId,
          Username: email,
          MessageAction: 'SUPPRESS',
          UserAttributes: [
            { Name: 'email', Value: email },
            { Name: 'email_verified', Value: 'true' },
            { Name: 'custom:role', Value: 'customer' },
            { Name: 'custom:tenant_id', Value: tenantId },
          ],
        }),
      );
    } catch (err) {
      if (errorName(err) === 'UsernameExistsException') throw new EmailAlreadyRegisteredError(email);
      if (THROTTLE_ERRORS.includes(errorName(err))) throw new ProviderThrottledError(errorName(err));
      throw err;
    }
    try {
      await this.cognito().send(new AdminSetUserPasswordCommand({ UserPoolId, Username: email, Password: password, Permanent: true }));
    } catch (err) {
      // Don't leave a user stuck in FORCE_CHANGE_PASSWORD, which would burn the email address.
      await this.cognito()
        .send(new AdminDeleteUserCommand({ UserPoolId, Username: email }))
        .catch((deleteErr) => {
          // Structured so a log-based metric can count "signup_rollback_failed" occurrences.
          this.logger.error(
            `signup_rollback_failed count=1 op=AdminDeleteUserCommand email_hash=${hashEmail(email)} error=${errorName(deleteErr)}: ${(deleteErr as Error).message}`,
          );
        });
      if (errorName(err) === 'InvalidPasswordException') throw new InvalidPasswordError((err as Error).message);
      if (THROTTLE_ERRORS.includes(errorName(err))) throw new ProviderThrottledError(errorName(err));
      throw err;
    }
  }

  async login(email: string, password: string): Promise<{ accessToken: string } | null> {
    try {
      const res = await this.cognito().send(
        new AdminInitiateAuthCommand({
          UserPoolId: process.env.COGNITO_USER_POOL_ID,
          ClientId: process.env.COGNITO_CLIENT_ID,
          AuthFlow: 'ADMIN_USER_PASSWORD_AUTH',
          AuthParameters: { USERNAME: email, PASSWORD: password },
        }),
      );
      // The ID token (not the access token) carries custom:role/custom:tenant_id by default;
      // CognitoTokenVerifier validates it as the bearer token for the same reason.
      const accessToken = res.AuthenticationResult?.IdToken;
      return accessToken ? { accessToken } : null;
    } catch (err) {
      const name = errorName(err);
      if (name === 'NotAuthorizedException' || name === 'UserNotFoundException') return null;
      if (THROTTLE_ERRORS.includes(name)) throw new ProviderThrottledError(name);
      throw err;
    }
  }
}
