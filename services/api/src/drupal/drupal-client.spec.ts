import { describe, expect, it, vi } from 'vitest';
import { createDrupalClient } from './drupal-client';
import { DrupalRequestError, MissingDrupalBaseUrlError, MissingDrupalCredentialError } from './errors';

const ok = (body: unknown = {}) => new Response(JSON.stringify(body), { status: 200 });

describe('createDrupalClient', () => {
  it('requests the path from the configured base URL and returns parsed JSON', async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok({ data: ['x'] }));
    const client = createDrupalClient({ baseUrl: 'https://dev.example-remote.test', bearerToken: 'test-token' }, fetchMock);
    await expect(client.getJson('/jsonapi/node/article')).resolves.toEqual({ data: ['x'] });
    expect(fetchMock).toHaveBeenCalledWith('https://dev.example-remote.test/jsonapi/node/article', expect.any(Object));
  });

  it('AC4: sends the credential as an OAuth2 bearer token', async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok());
    const client = createDrupalClient({ baseUrl: 'http://drupal.docksal.site', bearerToken: 'test-token' }, fetchMock);
    await client.getJson('/jsonapi/node/article');
    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers.Authorization).toBe('Bearer test-token');
    expect(init.headers.Accept).toBe('application/vnd.api+json');
  });

  it('AC3: throws MissingDrupalBaseUrlError and makes no request when base URL is unset', async () => {
    const fetchMock = vi.fn();
    const client = createDrupalClient({ bearerToken: 'test-token' }, fetchMock);
    await expect(client.getJson('/x')).rejects.toBeInstanceOf(MissingDrupalBaseUrlError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('AC6: throws MissingDrupalCredentialError and makes no request when credential is unset', async () => {
    const fetchMock = vi.fn();
    const client = createDrupalClient({ baseUrl: 'http://drupal.docksal.site' }, fetchMock);
    await expect(client.getJson('/x')).rejects.toBeInstanceOf(MissingDrupalCredentialError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('throws DrupalRequestError when Drupal responds non-2xx', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('Forbidden', { status: 403, statusText: 'Forbidden' }));
    const client = createDrupalClient({ baseUrl: 'http://drupal.docksal.site', bearerToken: 'test-token' }, fetchMock);
    const err = await client.getJson('/x').catch((e) => e);
    expect(err).toBeInstanceOf(DrupalRequestError);
    expect(err).toMatchObject({ status: 403, statusText: 'Forbidden' });
  });

  it('joins a base URL with a trailing slash without a doubled slash', async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok());
    const client = createDrupalClient({ baseUrl: 'http://drupal.docksal.site/', bearerToken: 'test-token' }, fetchMock);
    await client.getJson('/jsonapi/node/article');
    expect(fetchMock).toHaveBeenCalledWith('http://drupal.docksal.site/jsonapi/node/article', expect.any(Object));
  });
});
