import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp, tokenFor } from './support/create-test-app';

describe('Service types (e2e)', () => {
  let app: INestApplication;
  const OTHER_TENANT = '22222222-2222-4222-8222-222222222222';
  const admin = `Bearer ${tokenFor({ sub: 'adm-1', role: 'admin' })}`;
  const otherAdmin = `Bearer ${tokenFor({ sub: 'adm-2', role: 'admin', 'custom:tenant_id': OTHER_TENANT })}`;
  const customer = `Bearer ${tokenFor({ sub: 'cus-1', role: 'customer' })}`;
  const http = () => request(app.getHttpServer());
  const create = (body: object, auth = admin) => http().post('/service-types').set('Authorization', auth).send(body);

  beforeAll(async () => {
    app = await createTestApp();
  });
  afterAll(async () => {
    await app.close();
  });

  it('AC7: with nothing created a customer sees an empty list', async () => {
    const res = await http().get('/service-types').set('Authorization', `Bearer ${tokenFor({ sub: 'c', role: 'customer', 'custom:tenant_id': '33333333-3333-4333-8333-333333333333' })}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('AC1: an admin creates a service type and it appears in the list', async () => {
    const res = await create({ name: 'Faucet repair', description: 'Fix leaky or broken faucets.' });
    expect(res.status).toBe(201);
    const list = await http().get('/service-types').set('Authorization', admin);
    expect(list.body).toContainEqual(expect.objectContaining({ name: 'Faucet repair', description: 'Fix leaky or broken faucets.', active: true }));
  });

  it('creates without a description (null) and active', async () => {
    const res = await create({ name: 'No description' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ description: null, active: true });
  });

  it('AC2/AC3: an admin changes name and description', async () => {
    const created = await create({ name: 'Drain cleaning', description: 'Old copy' });
    const res = await http().patch(`/service-types/${created.body.id}`).set('Authorization', admin).send({ name: 'Drain & pipe cleaning', description: 'New copy' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ name: 'Drain & pipe cleaning', description: 'New copy' });
  });

  it('refuses an empty or whitespace name on create and edit', async () => {
    const created = await create({ name: 'Valid name' });
    for (const name of ['', '   ']) {
      const c = await create({ name });
      expect(c.status).toBe(400);
      expect(c.body.message).toContain('Enter a name for this service type.');
      const e = await http().patch(`/service-types/${created.body.id}`).set('Authorization', admin).send({ name });
      expect(e.status).toBe(400);
      expect(e.body.message).toContain('Enter a name for this service type.');
    }
  });

  it('refuses a duplicate name on create and edit with 409, case-insensitively', async () => {
    await create({ name: 'Water heater install' });
    const other = await create({ name: 'Other thing' });
    const dup = await create({ name: 'WATER HEATER INSTALL' });
    expect(dup.status).toBe(409);
    expect(dup.body.message).toContain('Another service type already uses this name.');
    const edit = await http().patch(`/service-types/${other.body.id}`).set('Authorization', admin).send({ name: 'water heater install' });
    expect(edit.status).toBe(409);
  });

  it('AC4/AC6: deactivating hides from customers and reactivating restores', async () => {
    const created = await create({ name: 'AC tune-up' });
    const status = (active: boolean) => http().patch(`/service-types/${created.body.id}/status`).set('Authorization', admin).send({ active });
    expect((await status(false)).status).toBe(200);
    const customerList = await http().get('/service-types').set('Authorization', customer);
    expect(customerList.body.find((s: any) => s.id === created.body.id)).toBeUndefined();
    const adminList = await http().get('/service-types').set('Authorization', admin);
    expect(adminList.body.find((s: any) => s.id === created.body.id)).toMatchObject({ active: false });
    await status(true);
    const after = await http().get('/service-types').set('Authorization', customer);
    expect(after.body.find((s: any) => s.id === created.body.id)).toBeTruthy();
  });

  it('AC5: a customer gets 403 on create, edit and status change; unauthenticated gets 401', async () => {
    const created = await create({ name: 'Protected' });
    await create({ name: 'Hack attempt' }, customer).then((r) => expect(r.status).toBe(403));
    await http().patch(`/service-types/${created.body.id}`).set('Authorization', customer).send({ name: 'Hacked' }).expect(403);
    await http().patch(`/service-types/${created.body.id}/status`).set('Authorization', customer).send({ active: false }).expect(403);
    await http().get('/service-types').expect(401);
  });

  it('tenant isolation: another tenant admin gets 404', async () => {
    const created = await create({ name: 'Tenant A only' });
    await http().patch(`/service-types/${created.body.id}`).set('Authorization', otherAdmin).send({ name: 'Stolen' }).expect(404);
    await http().patch(`/service-types/${created.body.id}/status`).set('Authorization', otherAdmin).send({ active: false }).expect(404);
  });

  it('unknown id 404s and malformed id 400s', async () => {
    await http().patch('/service-types/00000000-0000-4000-8000-000000000000').set('Authorization', admin).send({ name: 'X' }).expect(404);
    await http().patch('/service-types/not-a-uuid').set('Authorization', admin).send({ name: 'X' }).expect(400);
  });

  it('refuses a non-boolean or missing active; repeating a status is idempotent', async () => {
    const created = await create({ name: 'Status body' });
    const url = `/service-types/${created.body.id}/status`;
    await http().patch(url).set('Authorization', admin).send({ active: 'yes' }).expect(400);
    await http().patch(url).set('Authorization', admin).send({}).expect(400);
    expect((await http().patch(url).set('Authorization', admin).send({ active: true })).status).toBe(200);
  });
});
