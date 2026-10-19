import { afterEach, describe, expect, it, vi } from 'vitest';
import { clientWorkPageFetcher } from './client-work-page.fetcher';

const ENV = { DRUPAL_BASE_URL: 'https://drupal.test', DRUPAL_ACCESS_TOKEN: 'test-token' };
const respond = (resource: unknown) =>
  vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response(JSON.stringify({ data: resource }), { status: 200 }));

afterEach(() => vi.restoreAllMocks());

describe('clientWorkPageFetcher', () => {
  it('AC1: maps title, body, hero image and ordered paragraph refs from Drupal', async () => {
    respond({
      type: 'node--client_work',
      id: 'p1',
      attributes: {
        status: true,
        title: 'Acme Redesign',
        body: { value: '<p>raw</p>', processed: '<p>We helped Acme.</p>' },
        field_hero_image_url: '/h.jpg',
        field_hero_image_alt: 'Acme hero',
      },
      relationships: {
        field_paragraphs: { data: [{ type: 'paragraph--quote', id: 'a' }, { type: 'paragraph--legacy_a', id: 'b' }] },
      },
    });
    await expect(clientWorkPageFetcher.fetchById('p1', ENV)).resolves.toEqual({
      published: true,
      title: 'Acme Redesign',
      body: '<p>We helped Acme.</p>',
      heroImage: { url: '/h.jpg', alt: 'Acme hero' },
      paragraphRefs: [{ type: 'paragraph--quote', id: 'a' }, { type: 'paragraph--legacy_a', id: 'b' }],
    });
  });

  it('AC1: empty fields stay empty, with no placeholder', async () => {
    respond({ type: 'node--client_work', id: 'p1', attributes: { title: null, body: null } });
    await expect(clientWorkPageFetcher.fetchById('p1', ENV)).resolves.toEqual({
      published: false,
      title: '',
      body: '',
      heroImage: null,
      paragraphRefs: [],
    });
  });
});
