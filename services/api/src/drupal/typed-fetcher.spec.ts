import { afterEach, describe, expect, it, vi } from 'vitest';
import { DrupalFetchError } from './drupal-client';
import { createTypedFetcher } from './typed-fetcher';

const ENV = { DRUPAL_BASE_URL: 'http://local.docksal.site', DRUPAL_ACCESS_TOKEN: 'test-token' };

const mockFetch = () =>
  vi.spyOn(globalThis, 'fetch').mockImplementation(
    async () =>
      new Response(
        JSON.stringify({ data: { type: 'example--article', id: '1', attributes: { title: 'Hi', body: 'unused' } } }),
        { status: 200 },
      ),
  );

afterEach(() => {
  vi.restoreAllMocks();
});

describe('createTypedFetcher', () => {
  it('requests exactly the configured include set (AC3)', async () => {
    const fetchMock = mockFetch();
    const fetcher = createTypedFetcher<{ title: string }>({
      jsonApiType: 'example--article',
      endpoint: '/jsonapi/example/article',
      include: ['field_image', 'field_author'],
      cacheStrategy: 'static-revalidatable',
      parse: (r) => ({ title: r.attributes.title as string }),
    });
    await fetcher.fetchById('1', ENV);
    expect(new URL(fetchMock.mock.calls[0][0] as string).searchParams.get('include')).toBe('field_image,field_author');
  });

  it('omits include when none configured', async () => {
    const fetchMock = mockFetch();
    const fetcher = createTypedFetcher({
      jsonApiType: 'example--article',
      endpoint: '/jsonapi/example/article',
      include: [],
      cacheStrategy: 'static-revalidatable',
      parse: (r) => r,
    });
    await fetcher.fetchById('1', ENV);
    expect(new URL(fetchMock.mock.calls[0][0] as string).searchParams.has('include')).toBe(false);
  });

  it('returns the parsed typed shape (AC5)', async () => {
    mockFetch();
    const fetcher = createTypedFetcher<{ title: string }>({
      jsonApiType: 'example--article',
      endpoint: '/jsonapi/example/article',
      include: [],
      cacheStrategy: 'static-revalidatable',
      parse: (r) => ({ title: r.attributes.title as string }),
    });
    await expect(fetcher.fetchById('1', ENV)).resolves.toEqual({ title: 'Hi' });
  });

  it('per-request strategy issues a live request every call (AC6, AC7)', async () => {
    const fetchMock = mockFetch();
    const fetcher = createTypedFetcher({
      jsonApiType: 'example--search-result',
      endpoint: '/jsonapi/example/search-result',
      include: [],
      cacheStrategy: 'per-request',
      parse: (r) => r,
    });
    expect(fetcher.cacheStrategy).toBe('per-request');
    await fetcher.fetchById('1', ENV);
    await fetcher.fetchById('1', ENV);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('exposes static-revalidatable strategy (AC8)', () => {
    const fetcher = createTypedFetcher({
      jsonApiType: 'example--landing-page',
      endpoint: '/jsonapi/example/landing-page',
      include: [],
      cacheStrategy: 'static-revalidatable',
      parse: (r) => r,
    });
    expect(fetcher.cacheStrategy).toBe('static-revalidatable');
  });

  it('encodes the id and include values in the request', async () => {
    const fetchMock = mockFetch();
    const fetcher = createTypedFetcher({
      jsonApiType: 'example--article',
      endpoint: '/jsonapi/example/article',
      include: ['field_a'],
      cacheStrategy: 'static-revalidatable',
      parse: (r) => r,
    });
    await fetcher.fetchById('a/b?c#d', ENV);
    const url = new URL(fetchMock.mock.calls[0][0] as string);
    expect(url.pathname).toBe('/jsonapi/example/article/a%2Fb%3Fc%23d');
    expect(url.searchParams.get('include')).toBe('field_a');
  });

  it('throws DrupalFetchError when the body has no resource object', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response('{"data":[]}', { status: 200 }));
    const fetcher = createTypedFetcher({
      jsonApiType: 'example--article',
      endpoint: '/jsonapi/example/article',
      include: [],
      cacheStrategy: 'static-revalidatable',
      parse: (r) => r,
    });
    await expect(fetcher.fetchById('1', ENV)).rejects.toBeInstanceOf(DrupalFetchError);
  });
});
