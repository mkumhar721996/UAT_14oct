import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestApp } from './support/create-test-app';

const SECRET = 'test-secret';

describe('Pages (e2e)', () => {
  let app: INestApplication;
  let bodyText = 'v1';
  let missing = true;
  let published = true;
  let withBroken = false;
  const http = () => request(app.getHttpServer());
  const fetchMock = vi.fn();

  beforeAll(async () => {
    process.env.DRUPAL_BASE_URL = 'https://drupal.test';
    process.env.DRUPAL_ACCESS_TOKEN = 'fake-token';
    process.env.REVALIDATION_SHARED_SECRET = SECRET;
    app = await createTestApp();
  });
  afterAll(async () => {
    await app.close();
  });
  beforeEach(() => {
    bodyText = 'v1';
    missing = true;
    published = true;
    withBroken = false;
    fetchMock.mockReset();
    fetchMock.mockImplementation(async (url: string) => {
      const { pathname } = new URL(url);
      if (pathname.endsWith('/missing-id') && missing) return new Response('nf', { status: 404 });
      if (pathname.startsWith('/jsonapi/node/client_work/')) {
        return new Response(
          JSON.stringify({
            data: {
              type: 'node--client_work',
              id: 'x',
              attributes: { status: published, title: 'T', body: { processed: `<p>${bodyText}</p>` } },
              relationships: {
                field_paragraphs: {
                  data: [
                    { type: 'paragraph--quote', id: 'q1' },
                    { type: 'paragraph--legacy_quote', id: 'l1' },
                    ...(withBroken ? [{ type: 'paragraph--legacy_cta', id: 'broken' }] : []),
                  ],
                },
              },
            },
          }),
          { status: 200 },
        );
      }
      if (pathname.endsWith('/broken')) return new Response('err', { status: 500 });
      if (pathname.startsWith('/fragments/')) return new Response('<p>legacy</p>', { status: 200 });
      return new Response(JSON.stringify({ data: { type: 'paragraph--quote', id: 'q1', attributes: { text: 'hi' } } }), { status: 200 });
    });
    vi.spyOn(globalThis, 'fetch').mockImplementation(fetchMock as any);
  });

  afterEach(() => vi.restoreAllMocks());

  const nodeCalls = () => fetchMock.mock.calls.filter(([u]) => String(u).includes('/jsonapi/node/client_work/')).length;
  const revalidate = (id: string, tag: unknown, secret: string | undefined = SECRET) => {
    const req = http().post('/pages/revalidate');
    if (secret) req.set('x-revalidate-secret', secret);
    return req.send(tag === undefined ? {} : { tag });
  };

  it('AC1-3: composes real content with native, fragment and failed paragraphs isolated', async () => {
    withBroken = true;
    const res = await http().get('/pages/client-work/page-0');
    expect(res.status).toBe(200);
    expect(res.body.title).toBe('T');
    expect(res.body.paragraphs).toEqual([
      { status: 'component', componentKey: 'Quote', data: { text: 'hi' } },
      { status: 'html-fragment', html: '<p>legacy</p>' },
      { status: 'failed' },
    ]);
  });

  it('AC4/AC5: serves from cache until revalidated with the secret', async () => {
    expect((await http().get('/pages/client-work/page-1')).body.body).toContain('v1');
    expect((await http().get('/pages/client-work/page-1')).body.body).toContain('v1');
    expect(nodeCalls()).toBe(1);

    expect((await revalidate('page-1', 'node:page-1', 'wrong')).status).toBe(401);
    expect((await revalidate('page-1', 'node:page-1', '')).status).toBe(401);
    bodyText = 'v2';
    expect((await http().get('/pages/client-work/page-1')).body.body).toContain('v1');

    expect((await revalidate('page-1', 'node:page-1')).status).toBe(200);
    expect((await http().get('/pages/client-work/page-1')).body.body).toContain('v2');
  });

  it('AC5: rejects a missing tag with 400 and accepts a never-cached tag with 200', async () => {
    expect((await revalidate('x', undefined)).status).toBe(400);
    expect((await revalidate('x', '  ')).status).toBe(400);
    expect((await revalidate('x', 'node:never-requested')).status).toBe(200);
  });

  it('AC1: an unknown id is a 404 that is never cached', async () => {
    expect((await http().get('/pages/client-work/missing-id')).status).toBe(404);
    missing = false;
    const res = await http().get('/pages/client-work/missing-id');
    expect(res.status).toBe(200);
    expect(res.body.title).toBe('T');
  });

  it('never serves an unpublished node, and does not cache that 404', async () => {
    published = false;
    expect((await http().get('/pages/client-work/draft-1')).status).toBe(404);
    published = true;
    expect((await http().get('/pages/client-work/draft-1')).status).toBe(200);
  });

  it('does not cache a page with a failed paragraph', async () => {
    withBroken = true;
    await http().get('/pages/client-work/page-degraded');
    await http().get('/pages/client-work/page-degraded');
    expect(nodeCalls()).toBe(2);
  });

  it('AC6: recomposes after the fallback TTL', async () => {
    process.env.PAGE_CACHE_TTL_MS = '20';
    try {
      await http().get('/pages/client-work/page-ttl');
      bodyText = 'v2';
      await new Promise((r) => setTimeout(r, 40));
      expect((await http().get('/pages/client-work/page-ttl')).body.body).toContain('v2');
    } finally {
      delete process.env.PAGE_CACHE_TTL_MS;
    }
  });
});
