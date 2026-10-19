import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMediaImageFetcher } from './media-fetcher';

const ENV = { DRUPAL_BASE_URL: 'http://local.docksal.site', DRUPAL_ACCESS_TOKEN: 'test-token' };

afterEach(() => vi.restoreAllMocks());

describe('createMediaImageFetcher', () => {
  it('parses url and alt, defaulting a missing alt to empty', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      async () =>
        new Response(JSON.stringify({ data: { type: 'media--image', id: 'm1', attributes: { url: 'https://cdn.test/a.jpg' } } }), {
          status: 200,
        }),
    );
    expect(await createMediaImageFetcher().fetchById('m1', ENV)).toEqual({ url: 'https://cdn.test/a.jpg', alt: '' });
  });
});
