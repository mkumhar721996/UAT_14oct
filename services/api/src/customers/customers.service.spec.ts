import { describe, expect, it } from 'vitest';
import { FakeCustomerIdentityProvider } from '../../test/support/fake-customer-identity-provider';
import { FakeDataSource } from '../../test/support/fake-data-source';
import { InvalidPasswordError, ProviderThrottledError } from './customer-identity.provider';
import { CustomersService } from './customers.service';

describe('CustomersService', () => {
  const service = () => new CustomersService(new FakeDataSource() as any, new FakeCustomerIdentityProvider((c) => JSON.stringify(c)));

  it('normalises the email when signing up and logging in', async () => {
    const s = service();
    expect(await s.signUp({ email: ' Dana@Example.com ', password: 'test-password' })).toEqual({ email: 'dana@example.com' });
    await expect(s.logIn({ email: 'DANA@example.com', password: 'test-password' })).resolves.toHaveProperty('accessToken');
  });

  const failing = (error: Error) =>
    new CustomersService(new FakeDataSource() as any, {
      signUp: async () => {
        throw error;
      },
      login: async () => {
        throw error;
      },
    });

  it('maps a rejected password to 400 and throttling to 429', async () => {
    await expect(failing(new InvalidPasswordError('policy')).signUp({ email: 'a@example.com', password: 'test-password' })).rejects.toMatchObject({
      status: 400,
    });
    await expect(failing(new ProviderThrottledError('slow')).logIn({ email: 'a@example.com', password: 'x' })).rejects.toMatchObject({ status: 429 });
  });

  it('records a booking against the customer, tenant-scoped, as Requested', async () => {
    const s = service();
    await s.createBooking('t1', 'cust-1', { serviceType: 'AC tune-up' });
    await s.createBooking('t1', 'cust-2', { serviceType: 'Faucet repair' });
    const list = await s.listBookings('t1', 'cust-1');
    expect(list).toMatchObject([{ customerSub: 'cust-1', serviceType: 'AC tune-up', status: 'Requested' }]);
    expect(await s.listBookings('t2', 'cust-1')).toEqual([]);
  });
});
