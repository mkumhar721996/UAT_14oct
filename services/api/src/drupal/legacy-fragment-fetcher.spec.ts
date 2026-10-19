import { afterEach, describe, expect, it, vi } from 'vitest';
import { createLegacyFragmentFetcher } from './legacy-fragment-fetcher';

const ENV = { DRUPAL_BASE_URL: 'http://local.docksal.site', DRUPAL_ACCESS_TOKEN: 'test-token' };

afterEach(() => vi.restoreAllMocks());

describe('createLegacyFragmentFetcher', () => {
  it('fetches the fragment from the endpoint and returns sanitized html', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('<div class="promo">50% off</div><script>alert(1)</script>', { status: 200 }));
    const fetcher = createLegacyFragmentFetcher({ jsonApiType: 'paragraph--legacy_promo', endpoint: '/paragraph/fragment' });
    const result = await fetcher.fetchById('p 1', ENV);
    expect(String(fetchMock.mock.calls[0][0])).toBe('http://local.docksal.site/paragraph/fragment/p%201');
    expect(result.html).toContain('50% off');
    expect(result.html).not.toContain('script');
  });

  it('rejects when Drupal responds with an error status', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('no', { status: 500 }));
    const fetcher = createLegacyFragmentFetcher({ jsonApiType: 'paragraph--legacy_promo', endpoint: '/paragraph/fragment' });
    await expect(fetcher.fetchById('p-1', ENV)).rejects.toThrow('status 500');
  });
});
