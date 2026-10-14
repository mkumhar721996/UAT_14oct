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
  const creator = `Bearer ${tokenFor({ sub: 'rep-1', role: 'reporter' })}`;
  const nonReporter = `Bearer ${tokenFor({ sub: 'e-1', role: 'employee' })}`;
  const http = () => request(app.getHttpServer());
  const validBody = {
    title: 'Login button unresponsive',
    description: 'Clicking Sign in does nothing.',
    severity: 'Critical',
    reproSteps: '1. Open /login\n2. Click Sign in',
  };

  beforeAll(async () => {
    app = await createTestApp();
    const repo = app.get(DataSource).getRepository(Defect);
    const base = {
      tenantId: TENANT, title: 'Export freezes', description: 'Original description', reproSteps: 'Original steps',
      severity: 'Medium' as const, type: 'Functional', reporterId: 'reporter-1', reporterName: 'Jordan Lee',
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

  describe('POST /defects', () => {
    it('AC1/AC5: a Reporter creates a defect with status New', async () => {
      const res = await http().post('/defects').set('Authorization', creator).send(validBody);
      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ title: validBody.title, severity: 'Critical', status: 'New', reporterId: 'rep-1' });
      expect(res.body.id).toBeTruthy();
      expect(res.body.defectNumber).toBeTruthy();
    });

    it.each([
      ['title', 'Enter a title for the defect.'],
      ['description', 'Describe the defect.'],
      ['severity', 'Choose a severity.'],
      ['reproSteps', 'Describe the steps to reproduce the defect.'],
    ])('AC2: refuses when %s is missing or blank', async (field, message) => {
      const missing: any = { ...validBody };
      delete missing[field];
      const res = await http().post('/defects').set('Authorization', creator).send(missing);
      expect(res.status).toBe(400);
      expect(res.body.message).toContain(message);
      const blank = await http().post('/defects').set('Authorization', creator).send({ ...validBody, [field]: '   ' });
      expect(blank.status).toBe(400);
      expect(blank.body.message).toContain(message);
    });

    it('AC3: optional fields may be left out and come back null', async () => {
      const res = await http().post('/defects').set('Authorization', creator).send({ ...validBody, expectedResult: '', environment: '  ' });
      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ expectedResult: null, actualResult: null, environment: null });
    });

    it('AC4: rejects a severity outside Critical/High/Medium/Low', async () => {
      const res = await http().post('/defects').set('Authorization', creator).send({ ...validBody, severity: 'Blocker' });
      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Choose a severity.');
    });

    it('AC6: a non-Reporter gets 403 even with an invalid body; unauthenticated gets 401', async () => {
      expect((await http().post('/defects').set('Authorization', nonReporter).send(validBody)).status).toBe(403);
      expect((await http().post('/defects').set('Authorization', nonReporter).send({})).status).toBe(403);
      await http().post('/defects').send(validBody).expect(401);
    });

    it('a Reporter cannot read the employee directory, profiles or history', async () => {
      const hr = `Bearer ${tokenFor({ sub: 'hr-1', role: 'hr_admin' })}`;
      const { body: e } = await http().post('/employees').set('Authorization', hr).send({ fullName: 'Target', startDate: '2026-01-01' });
      await http().get('/employees').set('Authorization', creator).expect(403);
      await http().get(`/employees/${e.id}`).set('Authorization', creator).expect(403);
      await http().get(`/employees/${e.id}/history`).set('Authorization', creator).expect(403);
    });
  });

  describe('GET/PATCH /defects/:id', () => {
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
});
