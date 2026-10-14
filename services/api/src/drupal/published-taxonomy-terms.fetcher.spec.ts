import { describe, expect, it, vi } from 'vitest';
import { createDrupalClient } from './drupal-client';
import { MissingDrupalBaseUrlError } from './errors';
import { fetchPublishedTaxonomyTerms } from './published-taxonomy-terms.fetcher';

describe('fetchPublishedTaxonomyTerms', () => {
  it('requests published terms with the bearer credential', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: ['t'] }), { status: 200 }));
    const client = createDrupalClient({ baseUrl: 'http://drupal.docksal.site', bearerToken: 'test-token' }, fetchMock);
    await expect(fetchPublishedTaxonomyTerms('tags', client)).resolves.toEqual({ data: ['t'] });
    expect(fetchMock.mock.calls[0][0]).toBe('http://drupal.docksal.site/jsonapi/taxonomy_term/tags?filter[status]=1');
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer test-token');
  });

  it('throws the same typed error as the content fetcher when config is missing', async () => {
    const client = createDrupalClient({}, vi.fn());
    await expect(fetchPublishedTaxonomyTerms('tags', client)).rejects.toBeInstanceOf(MissingDrupalBaseUrlError);
  });
});
