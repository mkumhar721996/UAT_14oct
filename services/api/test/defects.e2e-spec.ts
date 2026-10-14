import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Defect } from '../src/defects/entities/defect.entity';
import { createTestApp, TENANT, tokenFor } from './support/create-test-app';

describe('Defects (e2e)', () => {
  let app: INestApplication;
  let fresh: Defect;
  let triaged: Defect;
  const reporter = `Bearer ${tokenFor({ sub: 'reporter-1', role: 'employee' })}`;
  const admin = `Bearer ${tokenFor({ sub: 'admin-1', role: 'admin' })}`;
  const other = `Bearer ${tokenFor({ sub: 'other-1', role: 'employee' })}`;
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    app = await createTestApp();
    const repo = app.get(DataSource).getRepository(Defect);
    const base = {
      tenantId: TENANT, title: 'Export freezes', description: 'Original description', reproSteps: 'Original steps',
      severity: 'Medium', type: 'Functional', reporterId: 'reporter-1', reporterName: 'Jordan Lee',
      assigneeId: null, assigneeName: null, environment: 'Staging',
    };
    fresh = await repo.save(repo.create({ ...base, defectNumber: 'DEF-1042', status: 'New', priority: null, triagedAt: null }));
    triaged = await repo.save(
      repo.create({ ...base, defectNumber: 'DEF-1038', status: 'Triaged', priority: 'P2 — High', triagedAt: new Date() }),
    );
  });
  afterAll(async () => {
    await app.close();
  });

  it('AC1: any signed-in user can read the full record; unauthenticated is 401', async () => {
    const res = await http().get(`/defects/${triaged.id}`).set('Authorization', other);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ defectNumber: 'DEF-1038', status: 'Triaged', priority: 'P2 — High', environment: 'Staging' });
    await http().get(`/defects/${triaged.id}`).expect(401);
  });

  it('AC2: the Reporter can change description and reproSteps before Triaged', async () => {
    const res = await http().patch(`/defects/${fresh.id}`).set('Authorization', reporter).send({ description: 'New description', reproSteps: 'New steps' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ description: 'New description', reproSteps: 'New steps' });
    const after = await http().get(`/defects/${fresh.id}`).set('Authorization', reporter);
    expect(after.body.description).toBe('New description');
  });

  it('AC3: once Triaged the Reporter is refused and values stay the same', async () => {
    const res = await http().patch(`/defects/${triaged.id}`).set('Authorization', reporter).send({ description: 'Hack' });
    expect(res.status).toBe(403);
    const after = await http().get(`/defects/${triaged.id}`).set('Authorization', reporter);
    expect(after.body.description).toBe('Original description');
  });

  it('AC4: an Admin can change severity at any status', async () => {
    const res = await http().patch(`/defects/${fresh.id}`).set('Authorization', admin).send({ severity: 'Critical' });
    expect(res.status).toBe(200);
    expect(res.body.severity).toBe('Critical');
  });

  it('AC5: an Admin can change description once Triaged', async () => {
    const res = await http().patch(`/defects/${triaged.id}`).set('Authorization', admin).send({ description: 'Refined description' });
    expect(res.status).toBe(200);
    expect(res.body.description).toBe('Refined description');
  });

  it('AC6: neither Reporter nor Admin is refused with 403', async () => {
    const res = await http().patch(`/defects/${triaged.id}`).set('Authorization', other).send({ description: 'Hack' });
    expect(res.status).toBe(403);
    await http().patch(`/defects/${fresh.id}`).set('Authorization', other).send({ severity: 'Low' }).expect(403);
  });

  it('AC7: changing severity leaves priority unchanged', async () => {
    const res = await http().patch(`/defects/${triaged.id}`).set('Authorization', admin).send({ severity: 'Low' });
    expect(res.status).toBe(200);
    expect(res.body.priority).toBe('P2 — High');
  });

  it('AC8: status cannot be changed through this endpoint', async () => {
    const res = await http().patch(`/defects/${fresh.id}`).set('Authorization', admin).send({ status: 'Resolved' });
    expect(res.status).toBe(400);
    expect((await http().get(`/defects/${fresh.id}`).set('Authorization', admin)).body.status).toBe('New');
  });
});
