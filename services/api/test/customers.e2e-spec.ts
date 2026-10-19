import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp } from './support/create-test-app';

describe('Customers (e2e)', () => {
  let app: INestApplication;
  const http = () => request(app.getHttpServer());
  const password = 'test-password';
  const signUp = (email: string) => http().post('/customers/signup').send({ email, password });
  const logIn = async (email: string) => (await http().post('/customers/login').send({ email, password })).body.accessToken as string;

  beforeAll(async () => {
    app = await createTestApp();
  });
  afterAll(async () => {
    await app.close();
  });

  it('AC1: signup creates a customer account that can then log in', async () => {
    await signUp('dana@example.com').expect(201);
    const res = await http().post('/customers/login').send({ email: 'dana@example.com', password });
    expect(res.status).toBe(200);
    expect(typeof res.body.accessToken).toBe('string');
  });

  it('AC1: signing up twice with the same email is rejected', async () => {
    await signUp('dup@example.com').expect(201);
    const res = await signUp('Dup@Example.com');
    expect(res.status).toBe(409);
  });

  it('AC1: a short password is rejected', async () => {
    await http().post('/customers/signup').send({ email: 'short@example.com', password: 'short' }).expect(400);
  });

  it('AC2: logging in with correct credentials grants access to the customer account', async () => {
    await signUp('ac2@example.com');
    const token = await logIn('ac2@example.com');
    const res = await http().get('/customers/me/bookings').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });

  it('AC3: a wrong password is refused with a generic message', async () => {
    await signUp('ac3@example.com');
    const res = await http().post('/customers/login').send({ email: 'ac3@example.com', password: 'wrong-password' });
    expect(res.status).toBe(401);
    expect(res.body.message).toBe("That email and password don't match. Check your details and try again.");
    expect(res.body.accessToken).toBeUndefined();
  });

  it('AC3: an unknown email gets the same generic refusal', async () => {
    const res = await http().post('/customers/login').send({ email: 'nobody@example.com', password });
    expect(res.status).toBe(401);
    expect(res.body.message).toBe("That email and password don't match. Check your details and try again.");
  });

  it('AC4: a logged-in customer is denied an hr_admin-only route', async () => {
    await signUp('ac4@example.com');
    const token = await logIn('ac4@example.com');
    const res = await http().post('/employees').set('Authorization', `Bearer ${token}`).send({ fullName: 'x', startDate: '2026-01-01' });
    expect(res.status).toBe(403);
  });

  it('AC5: a submitted booking is recorded against the logged-in customer', async () => {
    await signUp('ac5@example.com');
    const auth = `Bearer ${await logIn('ac5@example.com')}`;
    await http().post('/customers/me/bookings').set('Authorization', auth).send({ serviceType: 'Faucet repair' }).expect(201);
    const res = await http().get('/customers/me/bookings').set('Authorization', auth);
    expect(res.body).toMatchObject([{ serviceType: 'Faucet repair', status: 'Requested' }]);
  });

  it("AC5: one customer never sees another customer's bookings", async () => {
    await signUp('a@example.com');
    await signUp('b@example.com');
    const a = `Bearer ${await logIn('a@example.com')}`;
    const b = `Bearer ${await logIn('b@example.com')}`;
    await http().post('/customers/me/bookings').set('Authorization', a).send({ serviceType: 'AC tune-up' }).expect(201);
    const res = await http().get('/customers/me/bookings').set('Authorization', b);
    expect(res.body).toEqual([]);
  });

  it('AC5: an unknown service type is refused', async () => {
    await signUp('bad@example.com');
    const auth = `Bearer ${await logIn('bad@example.com')}`;
    await http().post('/customers/me/bookings').set('Authorization', auth).send({ serviceType: 'Nope' }).expect(400);
  });

  it('AC6: a booking made before logging out is still listed after logging back in', async () => {
    await signUp('ac6@example.com');
    const first = `Bearer ${await logIn('ac6@example.com')}`;
    await http().post('/customers/me/bookings').set('Authorization', first).send({ serviceType: 'Drain cleaning' }).expect(201);
    const second = `Bearer ${await logIn('ac6@example.com')}`;
    const res = await http().get('/customers/me/bookings').set('Authorization', second);
    expect(res.body.map((b: any) => b.serviceType)).toContain('Drain cleaning');
  });
});
