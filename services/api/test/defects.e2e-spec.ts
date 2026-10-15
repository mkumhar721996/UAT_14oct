import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DataSource } from 'typeorm';
import { Defect } from '../src/defects/entities/defect.entity';
import { createTestApp, TENANT, tokenFor } from './support/create-test-app';

describe('Defects (e2e)', () => {
  let app: INestApplication;
  const reporter = `Bearer ${tokenFor({ sub: 'rep-1', role: 'reporter' })}`;
  const nonReporter = `Bearer ${tokenFor({ sub: 'e-1', role: 'employee' })}`;
  const http = () => request(app.getHttpServer());
  const validBody = {
    title: 'Login button unresponsive',
    description: 'Clicking Sign in does nothing.',
    severity: 'Critical',
    stepsToReproduce: '1. Open /login\n2. Click Sign in',
  };

  beforeAll(async () => {
    app = await createTestApp();
  });
  afterAll(async () => {
    await app.close();
  });

  it('AC1/AC5: a Reporter creates a defect with status New', async () => {
    const res = await http().post('/defects').set('Authorization', reporter).send(validBody);
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ title: validBody.title, severity: 'Critical', status: 'New', reportedBy: 'rep-1' });
    expect(res.body.id).toBeTruthy();
  });

  it.each([
    ['title', 'Enter a title for the defect.'],
    ['description', 'Describe the defect.'],
    ['severity', 'Choose a severity.'],
    ['stepsToReproduce', 'Describe the steps to reproduce the defect.'],
  ])('AC2: refuses when %s is missing or blank', async (field, message) => {
    const missing: any = { ...validBody };
    delete missing[field];
    const res = await http().post('/defects').set('Authorization', reporter).send(missing);
    expect(res.status).toBe(400);
    expect(res.body.message).toContain(message);
    const blank = await http().post('/defects').set('Authorization', reporter).send({ ...validBody, [field]: '   ' });
    expect(blank.status).toBe(400);
    expect(blank.body.message).toContain(message);
  });

  it('AC3: optional fields may be left out and come back null', async () => {
    const res = await http().post('/defects').set('Authorization', reporter).send({ ...validBody, expectedResult: '', environment: '  ' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ expectedResult: null, actualResult: null, environment: null });
  });

  it('AC4: rejects a severity outside Critical/High/Medium/Low', async () => {
    const res = await http().post('/defects').set('Authorization', reporter).send({ ...validBody, severity: 'Blocker' });
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
    await http().get('/employees').set('Authorization', reporter).expect(403);
    await http().get(`/employees/${e.id}`).set('Authorization', reporter).expect(403);
    await http().get(`/employees/${e.id}/history`).set('Authorization', reporter).expect(403);
  });

  describe('detail and edit', () => {
    const admin = `Bearer ${tokenFor({ sub: 'adm-1', role: 'admin' })}`;
    const seed = async (status: string, extra: Record<string, unknown> = {}) => {
      const repo = app.get(DataSource).getRepository(Defect);
      return repo.save(repo.create({ ...validBody, tenantId: TENANT, status, reportedBy: 'rep-1', priority: null, assigneeName: null, ...extra } as Partial<Defect>) as Defect);
    };
    const get = (id: string) => http().get(`/defects/${id}`).set('Authorization', nonReporter);

    it('AC1: any signed-in user reads the full record, status and assignee', async () => {
      const d = await seed('New');
      const res = await get(d.id);
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ id: d.id, title: validBody.title, status: 'New', severity: 'Critical', priority: null, assigneeName: null, reportedBy: 'rep-1', description: validBody.description, stepsToReproduce: validBody.stepsToReproduce });
      await http().get(`/defects/${d.id}`).expect(401);
      await http().get('/defects/not-a-uuid').set('Authorization', nonReporter).expect(400);
      await http().get('/defects/22222222-2222-4222-8222-222222222222').set('Authorization', nonReporter).expect(404);
    });

    it('AC2: the reporter edits description and steps before triage', async () => {
      const d = await seed('New');
      const res = await http().patch(`/defects/${d.id}`).set('Authorization', reporter).send({ description: 'New desc', stepsToReproduce: 'New steps' });
      expect(res.status).toBe(200);
      expect((await get(d.id)).body).toMatchObject({ description: 'New desc', stepsToReproduce: 'New steps' });
    });

    it('AC3: the reporter is refused after triage and nothing changes', async () => {
      const d = await seed('Triaged');
      const res = await http().patch(`/defects/${d.id}`).set('Authorization', reporter).send({ description: 'x' });
      expect(res.status).toBe(403);
      expect((await get(d.id)).body.description).toBe(validBody.description);
    });

    it.each(['New', 'Triaged'])('AC4: an admin changes severity at status %s', async (status) => {
      const d = await seed(status);
      const res = await http().patch(`/defects/${d.id}`).set('Authorization', admin).send({ severity: 'High' });
      expect(res.status).toBe(200);
      expect(res.body.severity).toBe('High');
    });

    it('AC5: an admin edits the description of a triaged defect', async () => {
      const d = await seed('Triaged');
      await http().patch(`/defects/${d.id}`).set('Authorization', admin).send({ description: 'Updated' }).expect(200);
      expect((await get(d.id)).body.description).toBe('Updated');
    });

    it('AC6: someone who is neither reporter nor admin gets 403 and nothing changes', async () => {
      const d = await seed('New');
      for (const body of [{ description: 'x' }, { severity: 'Low' }]) {
        expect((await http().patch(`/defects/${d.id}`).set('Authorization', nonReporter).send(body)).status).toBe(403);
      }
      expect((await get(d.id)).body).toMatchObject({ description: validBody.description, severity: 'Critical' });
    });

    it('AC7: an admin changing severity leaves priority unchanged', async () => {
      const d = await seed('Triaged', { priority: 'P2' });
      await http().patch(`/defects/${d.id}`).set('Authorization', admin).send({ severity: 'Low' }).expect(200);
      expect((await get(d.id)).body).toMatchObject({ severity: 'Low', priority: 'P2' });
    });

    it.each(['description', 'stepsToReproduce', 'severity'])('refuses a null %s with 400, not a 500', async (field) => {
      const d = await seed('Triaged');
      const res = await http().patch(`/defects/${d.id}`).set('Authorization', admin).send({ [field]: null });
      expect(res.status).toBe(400);
    });

    it('AC8: status and priority cannot be set through the API', async () => {
      const d = await seed('New', { priority: 'P2' });
      for (const body of [{ status: 'Triaged' }, { priority: 'P1' }]) {
        expect((await http().patch(`/defects/${d.id}`).set('Authorization', admin).send(body)).status).toBe(400);
      }
      expect((await get(d.id)).body).toMatchObject({ status: 'New', priority: 'P2' });
    });
  });
});
