import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp, tokenFor } from './support/create-test-app';

describe('Employees (e2e)', () => {
  let app: INestApplication;
  const hr = `Bearer ${tokenFor({ sub: 'hr-1', role: 'hr_admin' })}`;
  const http = () => request(app.getHttpServer());
  const create = (body: object) => http().post('/employees').set('Authorization', hr).send(body);

  beforeAll(async () => {
    app = await createTestApp();
  });
  afterAll(async () => {
    await app.close();
  });

  it('AC1/AC9: creates a profile with the four core values and a generated id', async () => {
    const res = await create({ fullName: 'Jordan Lee', startDate: '2026-01-05', jobTitle: 'Product Designer', department: 'Design', contractType: 'Full-time', salary: 95000 });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ jobTitle: 'Product Designer', department: 'Design', contractType: 'Full-time', salary: 95000 });
    expect(res.body.employeeNumber).toMatch(/^EMP-\d+$/);
  });

  it('AC8: saves with only name and start date', async () => {
    expect((await create({ fullName: 'Min Viable', startDate: '2026-01-01' })).status).toBe(201);
  });

  it('AC7: rejects a profile missing full name or start date, and a client-supplied employee number', async () => {
    expect((await create({ fullName: 'No Start Date' })).status).toBe(400);
    expect((await create({ startDate: '2026-01-01' })).status).toBe(400);
    expect((await create({ fullName: 'X', startDate: '2026-01-01', employeeNumber: 'EMP-1' })).status).toBe(400);
    const list = await http().get('/employees').set('Authorization', hr);
    expect(list.body.find((e: any) => e.fullName === 'No Start Date')).toBeUndefined();
  });

  it('AC7: rejects a whitespace-only full name on create and update', async () => {
    expect((await create({ fullName: '   ', startDate: '2026-01-01' })).status).toBe(400);
    const { body: e } = await create({ fullName: 'Named', startDate: '2026-01-01' });
    await http().patch(`/employees/${e.id}`).set('Authorization', hr).send({ fullName: '  ' }).expect(400);
    expect((await http().get(`/employees/${e.id}`).set('Authorization', hr)).body.fullName).toBe('Named');
  });

  it('AC3: a non-HR-Admin cannot create or edit; unauthenticated is 401', async () => {
    const emp = `Bearer ${tokenFor({ sub: 'e-1', role: 'employee' })}`;
    const res = await http().post('/employees').set('Authorization', emp).send({ fullName: 'Should Not Save', startDate: '2026-01-01' });
    expect(res.status).toBe(403);
    const list = await http().get('/employees').set('Authorization', hr);
    expect(list.body.find((e: any) => e.fullName === 'Should Not Save')).toBeUndefined();
    const created = await create({ fullName: 'Target', startDate: '2026-01-01' });
    const patch = await http().patch(`/employees/${created.body.id}`).set('Authorization', emp).send({ fullName: 'Hacked' });
    expect(patch.status).toBe(403);
    expect((await http().get(`/employees/${created.body.id}`).set('Authorization', hr)).body.fullName).toBe('Target');
    await http().post('/employees').send({ fullName: 'x', startDate: '2026-01-01' }).expect(401);
  });

  it('AC2/AC4/AC5/AC6/AC13/AC14: edits append dated history, ordered, with no edit/delete routes', async () => {
    const { body: e } = await create({ fullName: 'History', startDate: '2026-01-01', contractType: 'Contract' });
    await http().patch(`/employees/${e.id}`).set('Authorization', hr).send({ jobTitle: 'Senior', jobTitleEffectiveDate: '2026-02-01' }).expect(200);
    await http().patch(`/employees/${e.id}`).set('Authorization', hr).send({ contractType: 'Part-time', contractTypeEffectiveDate: '2026-01-05' }).expect(200);
    await http().patch(`/employees/${e.id}`).set('Authorization', hr).send({ department: 'Sales' }).expect(400);
    const detail = await http().get(`/employees/${e.id}`).set('Authorization', hr);
    expect(detail.body).toMatchObject({ jobTitle: 'Senior', contractType: 'Part-time' });
    const history = await http().get(`/employees/${e.id}/history`).set('Authorization', hr);
    expect(history.body.map((h: any) => h.effectiveDate)).toEqual(['2026-01-01', '2026-01-05', '2026-02-01']);
    expect(history.body.map((h: any) => h.newValue)).toEqual(['Contract', 'Part-time', 'Senior']);
    expect(Number.isNaN(new Date(history.body[2].recordedAt).getTime())).toBe(false);
    await http().delete(`/employees/${e.id}/history/${history.body[0].id}`).set('Authorization', hr).expect(404);
    await http().patch(`/employees/${e.id}/history/${history.body[0].id}`).set('Authorization', hr).send({}).expect(404);
  });

  describe('self-service', () => {
    let selfId: string;
    let emp: string;
    beforeAll(async () => {
      const { body } = await create({ fullName: 'Priya', startDate: '2021-11-08', jobTitle: 'Engineering Manager' });
      selfId = body.id;
      emp = `Bearer ${tokenFor({ sub: 'e-2', role: 'employee', employee_id: selfId })}`;
    });

    it('AC11: contact details save directly; core fields are refused on that route', async () => {
      const res = await http().patch('/employees/me/contact').set('Authorization', emp).send({ personalEmail: 'new@personalmail.com' });
      expect(res.status).toBe(200);
      expect(res.body.personalEmail).toBe('new@personalmail.com');
      await http().patch('/employees/me/contact').set('Authorization', emp).send({ jobTitle: 'CEO' }).expect(400);
    });

    it('AC12: core change becomes a pending request; HR approval applies it', async () => {
      await http().patch(`/employees/${selfId}`).set('Authorization', emp).send({ jobTitle: 'CEO', jobTitleEffectiveDate: '2026-01-01' }).expect(403);
      const reqRes = await http().post('/employees/me/change-requests').set('Authorization', emp)
        .send({ field: 'jobTitle', requestedValue: 'Director of Engineering', effectiveDate: '2026-12-01' }).expect(201);
      const detail = await http().get(`/employees/${selfId}`).set('Authorization', hr);
      expect(detail.body.jobTitle).toBe('Engineering Manager');
      await http().get('/pending-change-requests').set('Authorization', emp).expect(403);
      await http().post(`/pending-change-requests/${reqRes.body.id}/approve`).set('Authorization', emp).expect(403);
      await http().post(`/pending-change-requests/${reqRes.body.id}/approve`).set('Authorization', hr).expect(200);
      const after = await http().get(`/employees/${selfId}`).set('Authorization', hr);
      expect(after.body.jobTitle).toBe('Director of Engineering');
      const hist = await http().get(`/employees/${selfId}/history`).set('Authorization', hr);
      expect(hist.body.at(-1)).toMatchObject({ newValue: 'Director of Engineering', effectiveDate: '2026-12-01' });
    });

    it('rejecting leaves the value untouched', async () => {
      const r = await http().post('/employees/me/change-requests').set('Authorization', emp)
        .send({ field: 'salary', requestedValue: '150000', effectiveDate: '2026-12-01' }).expect(201);
      await http().post(`/pending-change-requests/${r.body.id}/reject`).set('Authorization', hr).expect(204);
      expect((await http().get(`/employees/${selfId}`).set('Authorization', hr)).body.salary).toBeNull();
    });

    it('hides salary and contact details of other employees from non-HR users', async () => {
      const { body: other } = await create({ fullName: 'Other', startDate: '2026-01-01', salary: 1 });
      const res = await http().get(`/employees/${other.id}`).set('Authorization', emp);
      expect(res.body.salary).toBeUndefined();
      expect(res.body.fullName).toBe('Other');
    });
  });

  describe('lifecycle status', () => {
    const emp = `Bearer ${tokenFor({ sub: 'e-9', role: 'employee' })}`;
    const status = (id: string, value: unknown, auth = hr) => http().patch(`/employees/${id}/status`).set('Authorization', auth).send({ status: value });

    it('AC2-AC4/AC13: transitions round-trip and are visible on read, including to non-HR viewers', async () => {
      const { body: e } = await create({ fullName: 'Status', startDate: '2026-01-01' });
      expect((await http().get(`/employees/${e.id}`).set('Authorization', emp)).body.status).toBe('active');
      for (const next of ['on_leave', 'active', 'terminated']) {
        expect((await status(e.id, next)).status).toBe(200);
        expect((await http().get(`/employees/${e.id}`).set('Authorization', hr)).body.status).toBe(next);
      }
      const list = await http().get('/employees').set('Authorization', emp);
      expect(list.body.find((x: any) => x.id === e.id).status).toBe('terminated');
    });

    it('AC1: rejects a status outside the three allowed values', async () => {
      const { body: e } = await create({ fullName: 'Bogus', startDate: '2026-01-01' });
      await status(e.id, 'bogus').expect(400);
    });

    it('enforces 401/403 on both routes', async () => {
      const { body: e } = await create({ fullName: 'Guards', startDate: '2026-01-01' });
      await http().patch(`/employees/${e.id}/status`).send({ status: 'on_leave' }).expect(401);
      await status(e.id, 'on_leave', emp).expect(403);
      await http().post(`/employees/${e.id}/rehire`).set('Authorization', emp).send({ startDate: '2026-06-01' }).expect(403);
    });

    it('AC7: a terminated record rejects edits with 409', async () => {
      const { body: e } = await create({ fullName: 'Gone', startDate: '2026-01-01' });
      await status(e.id, 'terminated').expect(200);
      await http().patch(`/employees/${e.id}`).set('Authorization', hr).send({ fullName: 'New' }).expect(409);
      expect((await http().get(`/employees/${e.id}`).set('Authorization', hr)).body.fullName).toBe('Gone');
    });

    it('AC10-AC12: rehire creates a linked record, only from a terminated one', async () => {
      const { body: e } = await create({ fullName: 'Back Again', startDate: '2026-01-01' });
      await http().post(`/employees/${e.id}/rehire`).set('Authorization', hr).send({ startDate: '2026-06-01' }).expect(409);
      await status(e.id, 'terminated').expect(200);
      await http().post(`/employees/${e.id}/rehire`).set('Authorization', hr).send({}).expect(400);
      const res = await http().post(`/employees/${e.id}/rehire`).set('Authorization', hr).send({ startDate: '2026-06-01' });
      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ status: 'active', rehiredFromId: e.id, fullName: 'Back Again' });
      expect(res.body.id).not.toBe(e.id);
      expect((await http().get(`/employees/${e.id}`).set('Authorization', hr)).body.status).toBe('terminated');
    });
  });
});
