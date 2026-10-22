import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { REVALIDATION_REGISTRY } from '../src/revalidation/revalidation.tokens';
import { createTestApp } from './support/create-test-app';

let title = 'Before';

describe('Revalidation (e2e)', () => {
  let app: INestApplication;
  const secret = 'fake-secret';
  const http = () => request(app.getHttpServer());
  const registry = () => app.get(REVALIDATION_REGISTRY);

  beforeAll(async () => {
    process.env.DRUPAL_BASE_URL = 'https://drupal.test';
    process.env.DRUPAL_ACCESS_TOKEN = 'fake-token';
    vi.stubEnv('REVALIDATION_SECRET', secret);
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      (async () =>
        new Response(
          JSON.stringify({ data: { type: 'node--landing_page', id: 'lp-5', attributes: { title }, relationships: {} } }),
          { status: 200 },
        )) as any,
    );
    app = await createTestApp();
  });
  beforeEach(() => {
    title = 'Before';
  });
  afterAll(async () => {
    await app.close();
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it('AC1: a valid secret marks the page stale', async () => {
    const res = await http().post('/revalidation').set('x-revalidation-secret', secret).send({ tag: 'home-page:1' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ revalidated: true, tag: 'home-page:1' });
    expect(registry().isStale('home-page:1')).toBe(true);
  });

  it('AC2: an absent or wrong secret is refused and nothing is marked stale', async () => {
    expect((await http().post('/revalidation').send({ tag: 'landing-page:refused' })).status).toBe(401);
    const wrong = await http().post('/revalidation').set('x-revalidation-secret', 'wrong-value').send({ tag: 'landing-page:refused' });
    expect(wrong.status).toBe(401);
    expect(registry().isStale('landing-page:refused')).toBe(false);
  });

  it('AC3: each of the five renderers is accepted', async () => {
    for (const tag of ['home-page:1', 'landing-page:1', 'client-work:1', 'partner:1', 'services:1']) {
      expect((await http().post('/revalidation').set('x-revalidation-secret', secret).send({ tag })).status).toBe(200);
    }
  });

  it('AC6: revalidation with a valid secret picks up changed Drupal content on the next request', async () => {
    await http().get('/pages/landing-page/lp-5');
    title = 'After';
    expect((await http().get('/pages/landing-page/lp-5')).body.title).toBe('Before');
    await http().post('/revalidation').set('x-revalidation-secret', secret).send({ tag: 'node:lp-5' }).expect(200);
    expect((await http().get('/pages/landing-page/lp-5')).body.title).toBe('After');
  });

  it('AC6: an invalid secret is refused and does not revalidate the landing page cache', async () => {
    await http().post('/revalidation').set('x-revalidation-secret', 'wrong-value').send({ tag: 'node:lp-5' }).expect(401);
    await http().post('/revalidation').send({ tag: 'node:lp-5' }).expect(401);
    expect(registry().isStale('node:lp-5')).toBe(false);
  });

  it('rejects a body without a tag', async () => {
    await http().post('/revalidation').set('x-revalidation-secret', secret).send({}).expect(400);
  });
});
