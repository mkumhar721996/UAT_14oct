import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp, tokenFor } from './support/create-test-app';

describe('Departments (e2e)', () => {
  let app: INestApplication;
  const hr = `Bearer ${tokenFor({ sub: 'hr-1', role: 'hr_admin' })}`;
  const http = () => request(app.getHttpServer());
  let a: { id: string };

  beforeAll(async () => {
    app = await createTestApp();
    a = (await http().post('/employees').set('Authorization', hr).send({ fullName: 'Ann', startDate: '2026-01-01' })).body;
  });
  afterAll(async () => {
    await app.close();
  });

  it('AC9: the saved tree and managers are unchanged across two independent reads', async () => {
    await http().post('/departments').set('Authorization', hr).send({ name: 'Ops', managerId: a.id }).expect(201);
    const first = await http().get('/departments').set('Authorization', hr);
    const second = await http().get('/departments').set('Authorization', hr);
    expect(first.body).toHaveLength(1);
    expect(second.body).toEqual(first.body);
  });

  it('AC4: rejects a missing manager with 400', async () => {
    await http().post('/departments').set('Authorization', hr).send({ name: 'NoMgr' }).expect(400);
  });

  it('only hr_admin can write; delete conflicts return 409', async () => {
    const emp = `Bearer ${tokenFor({ sub: 'u', role: 'employee', employee_id: a.id })}`;
    await http().post('/departments').set('Authorization', emp).send({ name: 'Z', managerId: a.id }).expect(403);
    await http().get('/departments').set('Authorization', emp).expect(200);
    const parent = (await http().post('/departments').set('Authorization', hr).send({ name: 'P', managerId: a.id })).body;
    await http().post('/departments').set('Authorization', hr).send({ name: 'C', parentId: parent.id, managerId: a.id }).expect(201);
    await http().delete(`/departments/${parent.id}`).set('Authorization', hr).expect(409);
  });

  it('GET /departments/my is scoped to the token employee', async () => {
    const emp = `Bearer ${tokenFor({ sub: 'u', role: 'employee', employee_id: a.id })}`;
    const res = await http().get('/departments/my').set('Authorization', emp).expect(200);
    expect(res.body.departments.length).toBeGreaterThan(0);
    const none = `Bearer ${tokenFor({ sub: 'u2', role: 'employee' })}`;
    await http().get('/departments/my').set('Authorization', none).expect(403);
  });

  it('GET /departments/my redacts salary and contact details of others for a non-HR manager', async () => {
    const mk = async (fullName: string) =>
      (await http().post('/employees').set('Authorization', hr).send({ fullName, startDate: '2026-01-01', salary: 90000 })).body;
    const mgr = await mk('Boss');
    const rep = await mk('Report');
    const dept = (await http().post('/departments').set('Authorization', hr).send({ name: 'Secret', managerId: mgr.id })).body;
    await http().patch(`/employees/${rep.id}/department`).set('Authorization', hr).send({ departmentId: dept.id }).expect(200);
    await http().patch(`/employees/${mgr.id}/department`).set('Authorization', hr).send({ departmentId: dept.id }).expect(200);
    const asMgr = `Bearer ${tokenFor({ sub: 'm', role: 'employee', employee_id: mgr.id })}`;
    const res = await http().get('/departments/my').set('Authorization', asMgr).expect(200);
    const other = res.body.employees.find((e: any) => e.id === rep.id);
    expect(other).toBeDefined();
    expect(other).not.toHaveProperty('salary');
    expect(other).not.toHaveProperty('personalEmail');
    expect(other).not.toHaveProperty('phone');
    expect(res.body.employees.find((e: any) => e.id === mgr.id).salary).toBe(90000);
    const asHr = await http().get('/departments/my').set('Authorization', hr);
    expect(asHr.status).toBe(403);
  });
});
