import { randomUUID } from 'node:crypto';
import { CustomerIdentityProvider, EmailAlreadyRegisteredError } from '../../src/customers/customer-identity.provider';

/** In-memory stand-in for Cognito: email -> password/sub. Login returns a token the faked TOKEN_VERIFIER accepts. */
export class FakeCustomerIdentityProvider implements CustomerIdentityProvider {
  private accounts = new Map<string, { password: string; sub: string }>();

  constructor(private readonly tokenFor: (claims: Record<string, unknown>) => string) {}

  async signUp(email: string, password: string): Promise<void> {
    if (this.accounts.has(email)) throw new EmailAlreadyRegisteredError(email);
    this.accounts.set(email, { password, sub: randomUUID() });
  }

  async login(email: string, password: string): Promise<{ accessToken: string } | null> {
    const account = this.accounts.get(email);
    if (!account || account.password !== password) return null;
    // Mirrors a real Cognito ID token, where custom attributes are namespaced under `custom:`.
    return { accessToken: this.tokenFor({ sub: account.sub, 'custom:role': 'customer', 'custom:employee_id': null }) };
  }
}
