import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp, tokenFor } from './support/create-test-app';

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
});
