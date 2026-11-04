import { ConflictException, Logger } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { FakeCustomerIdentityProvider } from '../../test/support/fake-customer-identity-provider';
import { FakeDataSource } from '../../test/support/fake-data-source';
import { InvalidPasswordError, ProviderThrottledError } from './customer-identity.provider';
import { CustomersService } from './customers.service';

describe('CustomersService', () => {
  const service = () => new CustomersService(new FakeDataSource() as any, new FakeCustomerIdentityProvider((c) => JSON.stringify(c)));

  it('normalises the email when signing up and logging in', async () => {
    const s = service();
    expect(await s.signUp({ name: 'Dana', email: ' Dana@Example.com ', password: 'test-password' })).toEqual({
      email: 'dana@example.com',
      accessToken: expect.any(String),
    });
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

  it('maps a rejected password to 400 and throttling to 429, logging the throttling so it is visible to on-call', async () => {
    await expect(failing(new InvalidPasswordError('policy')).signUp({ name: 'Dana', email: 'a@example.com', password: 'test-password' })).rejects.toMatchObject({
      status: 400,
    });
    const warnSpy = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    await expect(failing(new ProviderThrottledError('slow')).logIn({ email: 'a@example.com', password: 'x' })).rejects.toMatchObject({ status: 429 });
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('cognito_call_outcome'));
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('outcome=throttled'));
    warnSpy.mockRestore();
  });

  const spied = (login?: () => Promise<{ accessToken: string } | null>) => {
    const fake = new FakeCustomerIdentityProvider((c) => JSON.stringify(c));
    const identity = { signUp: vi.fn(fake.signUp.bind(fake)), login: vi.fn(login ?? fake.login.bind(fake)) };
    return { identity, s: new CustomersService(new FakeDataSource() as any, identity) };
  };
  const dto = { name: 'Dana', email: 'Dana@Example.com', password: 'test-password' };

  it('signs the new customer in, passing the trimmed name to the provider', async () => {
    const { identity, s } = spied();
    const res = await s.signUp({ ...dto, name: ' Dana ' });
    expect(identity.signUp).toHaveBeenCalledWith('dana@example.com', 'test-password', 'Dana');
    expect(res).toEqual({ email: 'dana@example.com', accessToken: expect.any(String) });
  });

  it('rejects a duplicate email with 409 and issues no second session', async () => {
    const { identity, s } = spied();
    await s.signUp(dto);
    await expect(s.signUp(dto)).rejects.toBeInstanceOf(ConflictException);
    expect(identity.signUp).toHaveBeenCalledTimes(2);
    expect(identity.login).toHaveBeenCalledTimes(1);
  });

  it('fails with a 500-class error when the account is created but login yields no token', async () => {
    const errorSpy = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const { s } = spied(async () => null);
    await expect(s.signUp(dto)).rejects.toMatchObject({ status: 500 });
    expect(errorSpy).toHaveBeenCalled();
    expect(errorSpy.mock.calls.flat().join(' ')).not.toContain('test-password');
    errorSpy.mockRestore();
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
