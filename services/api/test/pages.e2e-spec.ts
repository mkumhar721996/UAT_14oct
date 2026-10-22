import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { LEGACY_HTML_FRAGMENT_KEY } from '../src/pages/landing-page-paragraph-dispatch';
import { createTestApp } from './support/create-test-app';

type Ref = [string, string];
const responses = new Map<string, { body: string; status?: number }>();

export const mockLandingPageNode = (
  id: string,
  o: { title?: string; body?: string; images?: string[]; paragraphs?: Ref[] } = {},
) =>
  responses.set(`/jsonapi/node/landing_page/${id}`, {
    body: JSON.stringify({
      data: {
        type: 'node--landing_page',
        id,
        attributes: { title: o.title ?? 'Title', body: { processed: o.body ?? '' } },
        relationships: {
          field_image: { data: (o.images ?? []).map((m) => ({ type: 'media--image', id: m })) },
          field_paragraphs: { data: (o.paragraphs ?? []).map(([type, pid]) => ({ type, id: pid })) },
        },
      },
    }),
  });

describe('Pages (e2e)', () => {
  let app: INestApplication;
  let fetchMock: { mock: { calls: unknown[] } };
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    process.env.DRUPAL_BASE_URL = 'https://drupal.test';
    process.env.DRUPAL_ACCESS_TOKEN = 'fake-token';
    fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation((async (url: string) => {
      const hit = responses.get(new URL(url).pathname);
      if (!hit) return new Response('missing', { status: 404 });
      return new Response(hit.body, { status: hit.status ?? 200 });
    }) as any);
    app = await createTestApp();
  });
  afterAll(async () => {
    await app.close();
    vi.restoreAllMocks();
  });
  beforeEach(() => responses.clear());

  const mockMediaImage = (id: string, a: { url: string; alt: string }) =>
    responses.set(`/jsonapi/media/image/${id}`, { body: JSON.stringify({ data: { type: 'media--image', id, attributes: a } }) });

  it('AC1: returns the real Drupal text and images for a published landing page', async () => {
    mockLandingPageNode('lp-1', { title: 'Autumn Sale', body: '<p>Save big</p>', images: ['media-1'] });
    mockMediaImage('media-1', { url: 'https://cdn.test/sale.jpg', alt: 'Sale banner' });
    const res = await http().get('/pages/landing-page/lp-1');
    expect(res.status).toBe(200);
    expect(res.body.contentType).toBe('landing_page');
    expect(res.body.title).toBe('Autumn Sale');
    expect(res.body.bodyHtml).toContain('Save big');
    expect(res.body.images).toEqual([{ url: 'https://cdn.test/sale.jpg', alt: 'Sale banner' }]);
  });

  it('AC2: a native paragraph is returned with its componentKey and content', async () => {
    mockLandingPageNode('lp-n', { paragraphs: [['paragraph--rich_text', 'p-1']] });
    responses.set('/jsonapi/paragraph/rich_text/p-1', {
      body: JSON.stringify({ data: { type: 'paragraph--rich_text', id: 'p-1', attributes: { text: 'Hello' } } }),
    });
    const res = await http().get('/pages/landing-page/lp-n');
    expect(res.body.paragraphs[0]).toMatchObject({ status: 'resolved', componentKey: 'RichText', data: { text: 'Hello' } });
  });

  it('AC3: every paragraph instance on the node is present in the response', async () => {
    mockLandingPageNode('lp-2', { paragraphs: [['paragraph--legacy_cta', 'p-1'], ['paragraph--unregistered', 'p-2']] });
    responses.set('/paragraph/fragment/p-1', { body: '<p>x</p>' });
    const res = await http().get('/pages/landing-page/lp-2');
    expect(res.body.paragraphs).toHaveLength(2);
    expect(res.body.paragraphs.map((p: any) => p.status)).toEqual(['resolved', 'unresolved']);
  });

  it('AC4: a legacy paragraph type resolves via its HTML fragment', async () => {
    mockLandingPageNode('lp-3', { paragraphs: [['paragraph--legacy_promo', 'p-9']] });
    responses.set('/paragraph/fragment/p-9', { body: '<div class="promo">50% off</div>' });
    const res = await http().get('/pages/landing-page/lp-3');
    expect(res.body.paragraphs[0]).toMatchObject({ status: 'resolved', componentKey: LEGACY_HTML_FRAGMENT_KEY });
    expect(res.body.paragraphs[0].data.html).toContain('50% off');
  });

  it('AC5: an unchanged page returns the same result without re-fetching Drupal', async () => {
    mockLandingPageNode('lp-4', { title: 'Original' });
    const first = await http().get('/pages/landing-page/lp-4');
    const callsAfterFirst = fetchMock.mock.calls.length;
    const second = await http().get('/pages/landing-page/lp-4');
    expect(second.body).toEqual(first.body);
    expect(fetchMock.mock.calls.length).toBe(callsAfterFirst);
  });

  it('observability: a page with a permanently unresolved item is still served from cache, not rebuilt on every request', async () => {
    mockLandingPageNode('lp-5', { paragraphs: [['paragraph--unregistered', 'p-1']] });
    const first = await http().get('/pages/landing-page/lp-5');
    expect(first.body.paragraphs[0].status).toBe('unresolved');
    const callsAfterFirst = fetchMock.mock.calls.length;
    const second = await http().get('/pages/landing-page/lp-5');
    expect(second.body).toEqual(first.body);
    expect(fetchMock.mock.calls.length).toBe(callsAfterFirst);
  });
});
