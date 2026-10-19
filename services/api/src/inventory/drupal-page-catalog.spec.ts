import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchPublishedPages } from './drupal-page-catalog';

const env = { DRUPAL_BASE_URL: 'https://drupal.test', DRUPAL_ACCESS_TOKEN: 'fake-token' };
const node = (type: string, id: string, title = id, alias?: string) => ({
  type: `node--${type}`,
  id,
  attributes: { title, ...(alias ? { path: { alias } } : {}) },
});
const ok = (body: unknown) => ({ ok: true, status: 200, json: async () => body });

describe('fetchPublishedPages', () => {
  afterEach(() => vi.restoreAllMocks());

  it('AC1/AC2: queries each content type with the published filter and follows pagination', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation((async (url: string) => {
      const u = new URL(url);
      if (u.pathname === '/jsonapi/node/home_page' && !u.searchParams.has('page[offset]')) {
        return ok({ data: [node('home_page', 'h1'), node('home_page', 'h2')], links: { next: { href: 'https://drupal.test/jsonapi/node/home_page?filter[status]=1&page[offset]=50' } } });
      }
      if (u.pathname === '/jsonapi/node/home_page') return ok({ data: [node('home_page', 'h3')] });
      return ok({ data: [] });
    }) as any);
    const pages = await fetchPublishedPages(env);
    const first = new URL(fetchMock.mock.calls[0][0] as string);
    expect(first.pathname).toBe('/jsonapi/node/home_page');
    expect(first.searchParams.get('filter[status]')).toBe('1');
    expect(pages.filter((p) => p.templateType === 'HomePage')).toHaveLength(3);
    expect(fetchMock).toHaveBeenCalledTimes(6);
  });

  it('AC3: tags each page with its template and maps title/path', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation((async (url: string) => {
      const type = new URL(url).pathname.split('/').pop()!;
      return ok({ data: [node(type, `id-${type}`, `T ${type}`, type === 'partner' ? '/p' : undefined)] });
    }) as any);
    const pages = await fetchPublishedPages(env);
    const expected: Record<string, string> = { home_page: 'HomePage', landing_page: 'LandingPage', client_work: 'ClientWork', partner: 'Partner', services: 'Services' };
    for (const [type, template] of Object.entries(expected)) {
      expect(pages.find((p) => p.pageId === `id-${type}`)).toMatchObject({ templateType: template, title: `T ${type}` });
    }
    expect(pages.find((p) => p.pageId === 'id-partner')?.path).toBe('/p');
    expect(pages.find((p) => p.pageId === 'id-services')?.path).toBeNull();
  });
});
