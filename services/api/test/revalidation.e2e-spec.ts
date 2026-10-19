import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createTestApp } from './support/create-test-app';

let title = 'Before';

describe('Revalidation (e2e)', () => {
  let app: INestApplication;
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    process.env.DRUPAL_BASE_URL = 'https://drupal.test';
    process.env.DRUPAL_ACCESS_TOKEN = 'fake-token';
    process.env.REVALIDATION_TOKEN = 'test-revalidation-token';
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      (async () =>
        new Response(
          JSON.stringify({ data: { type: 'node--landing_page', id: 'lp-5', attributes: { title }, relationships: {} } }),
          { status: 200 },
        )) as any,
    );
    app = await createTestApp();
  });
  afterAll(async () => {
    await app.close();
    vi.restoreAllMocks();
  });

  it('AC6: revalidation with a valid token picks up changed Drupal content on the next request', async () => {
    await http().get('/pages/landing-page/lp-5');
    title = 'After';
    expect((await http().get('/pages/landing-page/lp-5')).body.title).toBe('Before');
    await http().post('/revalidation').set('Authorization', 'Bearer test-revalidation-token').send({ tag: 'node:lp-5' }).expect(201);
    expect((await http().get('/pages/landing-page/lp-5')).body.title).toBe('After');
  });

  it('AC6: an invalid token is refused and does not revalidate', async () => {
    await http().post('/revalidation').set('Authorization', 'Bearer wrong').send({ tag: 'node:lp-5' }).expect(401);
    await http().post('/revalidation').send({ tag: 'node:lp-5' }).expect(401);
  });

  it('rejects a body without a tag', async () => {
    await http().post('/revalidation').set('Authorization', 'Bearer test-revalidation-token').send({}).expect(400);
  });
});
