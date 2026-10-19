import { afterEach, describe, expect, it, vi } from 'vitest';
import { DrupalFetchError } from './drupal-client';
import { createHtmlFragmentFetcher } from './html-fragment-fetcher';

const ENV = { DRUPAL_BASE_URL: 'https://drupal.test', DRUPAL_ACCESS_TOKEN: 'test-token' };
const fetcher = createHtmlFragmentFetcher({
  jsonApiType: 'paragraph--legacy_quote',
  endpoint: '/fragments/legacy_quote',
  cacheStrategy: 'static-revalidatable',
});

afterEach(() => vi.restoreAllMocks());

describe('createHtmlFragmentFetcher', () => {
  it('wraps the fetched markup as { html }', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async () => new Response('<p>legacy</p>', { status: 200 }));
    await expect(fetcher.fetchById('a b', ENV)).resolves.toEqual({ html: '<p>legacy</p>' });
    expect(fetchMock.mock.calls[0][0]).toBe('https://drupal.test/fragments/legacy_quote/a%20b');
  });

  it('rejects with DrupalFetchError on a 404', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response('Not Found', { status: 404 }));
    await expect(fetcher.fetchById('1', ENV)).rejects.toBeInstanceOf(DrupalFetchError);
  });
});
