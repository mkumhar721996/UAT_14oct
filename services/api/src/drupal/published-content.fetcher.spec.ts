import { describe, expect, it, vi } from 'vitest';
import { createDrupalClient } from './drupal-client';
import { MissingDrupalBaseUrlError, MissingDrupalCredentialError } from './errors';
import { fetchPublishedContent } from './published-content.fetcher';

const ok = (body: unknown = {}) => new Response(JSON.stringify(body), { status: 200 });

describe('fetchPublishedContent', () => {
  it('AC1: requests published content from the configured local Docksal base URL', async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok({ data: ['local-article'] }));
    const client = createDrupalClient({ baseUrl: 'http://drupal.docksal.site', bearerToken: 'test-token' }, fetchMock);
    const result = await fetchPublishedContent('article', client);
    expect(fetchMock).toHaveBeenCalledWith(
      'http://drupal.docksal.site/jsonapi/node/article?filter[status]=1',
      expect.any(Object),
    );
    expect(result).toEqual({ data: ['local-article'] });
  });

  it('AC2: the same fetcher targets whichever base URL the client was built with', async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok());
    await fetchPublishedContent('article', createDrupalClient({ baseUrl: 'https://dev.example-remote.test', bearerToken: 'test-token' }, fetchMock));
    expect(fetchMock.mock.calls[0][0]).toBe('https://dev.example-remote.test/jsonapi/node/article?filter[status]=1');
  });

  it('AC3: rejects and makes no request when base URL is unset', async () => {
    const fetchMock = vi.fn();
    const client = createDrupalClient({ bearerToken: 'test-token' }, fetchMock);
    await expect(fetchPublishedContent('article', client)).rejects.toBeInstanceOf(MissingDrupalBaseUrlError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('AC4: sends the credential as a bearer token', async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok());
    await fetchPublishedContent('article', createDrupalClient({ baseUrl: 'http://drupal.docksal.site', bearerToken: 'test-token' }, fetchMock));
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer test-token');
  });

  it('AC6: rejects and makes no request when the credential is unset', async () => {
    const fetchMock = vi.fn();
    const client = createDrupalClient({ baseUrl: 'http://drupal.docksal.site' }, fetchMock);
    await expect(fetchPublishedContent('article', client)).rejects.toBeInstanceOf(MissingDrupalCredentialError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sends whichever credential is current between calls', async () => {
    const fetchMock = vi.fn().mockImplementation(async () => ok());
    await fetchPublishedContent('article', createDrupalClient({ baseUrl: 'http://drupal.docksal.site', bearerToken: 'token-a' }, fetchMock));
    await fetchPublishedContent('article', createDrupalClient({ baseUrl: 'http://drupal.docksal.site', bearerToken: 'token-b' }, fetchMock));
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer token-a');
    expect(fetchMock.mock.calls[1][1].headers.Authorization).toBe('Bearer token-b');
  });
});
