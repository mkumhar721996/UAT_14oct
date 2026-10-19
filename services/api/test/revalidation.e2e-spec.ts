import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { REVALIDATION_REGISTRY } from '../src/revalidation/revalidation.module';
import { createTestApp } from './support/create-test-app';

describe('Revalidation (e2e)', () => {
  let app: INestApplication;
  const secret = 'fake-secret';
  const http = () => request(app.getHttpServer());
  const registry = () => app.get(REVALIDATION_REGISTRY);

  beforeAll(async () => {
    vi.stubEnv('REVALIDATION_SECRET', secret);
    app = await createTestApp();
  });
  afterAll(async () => {
    await app.close();
    vi.unstubAllEnvs();
  });

  it('AC1: a valid secret marks the page stale', async () => {
    const res = await http().post('/revalidation').set('x-revalidation-secret', secret).send({ tag: 'home-page:1' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ revalidated: true, tag: 'home-page:1' });
    expect(registry().isStale('home-page:1')).toBe(true);
  });

  it('AC2: an absent or wrong secret is refused and nothing is marked stale', async () => {
    expect((await http().post('/revalidation').send({ tag: 'landing-page:1' })).status).toBe(401);
    const wrong = await http().post('/revalidation').set('x-revalidation-secret', 'wrong-value').send({ tag: 'landing-page:1' });
    expect(wrong.status).toBe(401);
    expect(registry().isStale('landing-page:1')).toBe(false);
  });

  it('AC3: each of the five renderers is accepted', async () => {
    for (const tag of ['home-page:1', 'landing-page:1', 'client-work:1', 'partner:1', 'services:1']) {
      expect((await http().post('/revalidation').set('x-revalidation-secret', secret).send({ tag })).status).toBe(200);
    }
  });
});
