import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CognitoCustomerIdentityProvider,
  EmailAlreadyRegisteredError,
  InvalidPasswordError,
  ProviderThrottledError,
} from './customer-identity.provider';

const awsError = (name: string) => Object.assign(new Error(name), { name });
const TENANT = '11111111-1111-4111-8111-111111111111';

describe('CognitoCustomerIdentityProvider', () => {
  const sent: string[] = [];
  const provider = (failOn: Record<string, string> = {}) => {
    const p = new CognitoCustomerIdentityProvider();
    (p as any).client = {
      send: vi.fn(async (cmd: any) => {
        const name = cmd.constructor.name;
        sent.push(name);
        if (failOn[name]) throw awsError(failOn[name]);
        return { AuthenticationResult: { IdToken: 'fake-token' } };
      }),
    };
    return p;
  };

  beforeEach(() => {
    sent.length = 0;
    process.env.CUSTOMER_TENANT_ID = TENANT;
  });
  afterEach(() => {
    delete process.env.CUSTOMER_TENANT_ID;
  });

  it('rolls back the half-created user and reports a policy failure when the password is rejected', async () => {
    const p = provider({ AdminSetUserPasswordCommand: 'InvalidPasswordException' });
    await expect(p.signUp('a@example.com', 'test-password')).rejects.toBeInstanceOf(InvalidPasswordError);
    expect(sent).toEqual(['AdminCreateUserCommand', 'AdminSetUserPasswordCommand', 'AdminDeleteUserCommand']);
  });

  it('rolls back and rethrows on any other set-password failure', async () => {
    const p = provider({ AdminSetUserPasswordCommand: 'InternalErrorException' });
    await expect(p.signUp('a@example.com', 'test-password')).rejects.toThrow('InternalErrorException');
    expect(sent).toContain('AdminDeleteUserCommand');
  });

  it('maps an existing username to EmailAlreadyRegisteredError', async () => {
    const p = provider({ AdminCreateUserCommand: 'UsernameExistsException' });
    await expect(p.signUp('a@example.com', 'test-password')).rejects.toBeInstanceOf(EmailAlreadyRegisteredError);
  });

  it('fails fast without calling Cognito when CUSTOMER_TENANT_ID is missing or not a uuid', async () => {
    for (const value of [undefined, 'not-a-uuid']) {
      if (value === undefined) delete process.env.CUSTOMER_TENANT_ID;
      else process.env.CUSTOMER_TENANT_ID = value;
      const p = provider();
      await expect(p.signUp('a@example.com', 'test-password')).rejects.toThrow(/CUSTOMER_TENANT_ID/);
      expect(sent).toEqual([]);
    }
  });

  it('maps login throttling to ProviderThrottledError and bad credentials to null', async () => {
    await expect(provider({ AdminInitiateAuthCommand: 'TooManyRequestsException' }).login('a@example.com', 'x')).rejects.toBeInstanceOf(
      ProviderThrottledError,
    );
    await expect(provider({ AdminInitiateAuthCommand: 'NotAuthorizedException' }).login('a@example.com', 'x')).resolves.toBeNull();
  });
});
