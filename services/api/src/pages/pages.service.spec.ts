import { Logger } from '@nestjs/common';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createResourceRegistry } from '../drupal/resource-registry';
import { createRevalidationRegistry } from '../drupal/revalidation-registry';
import { PagesService } from './pages.service';

const ENV = { DRUPAL_BASE_URL: 'http://local.docksal.site', DRUPAL_ACCESS_TOKEN: 'test-token' };

const mockNode = (id: string, paragraphRefs: Array<{ type: string; id: string }> = []) =>
  vi.spyOn(globalThis, 'fetch').mockImplementation(
    async () =>
      new Response(
        JSON.stringify({
          data: {
            type: 'node--landing_page',
            id,
            attributes: { title: 'T', body: { processed: '' } },
            relationships: { field_paragraphs: { data: paragraphRefs } },
          },
        }),
        { status: 200 },
      ),
  );

const buildService = () => {
  const registry = createResourceRegistry();
  const revalidation = createRevalidationRegistry();
  const service = new PagesService(registry, revalidation);
  service.onModuleInit();
  return { service, registry, revalidation };
};

afterEach(() => vi.restoreAllMocks());

describe('PagesService', () => {
  it('logs an unresolved item with its pageId, type and status, and marks the page stale so the next request retries', async () => {
    mockNode('lp-1', [{ type: 'paragraph--unregistered', id: 'p-1' }]);
    const warnSpy = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const { service, revalidation } = buildService();

    const first = await service.getLandingPage('lp-1', ENV);

    expect(first.paragraphs[0]).toMatchObject({ status: 'unresolved' });
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('landing_page_item_unresolved'));
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('pageId=lp-1'));
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('jsonApiType=paragraph--unregistered'));
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('status=unresolved'));
    // A transient/permanent per-item failure shouldn't persist for the whole fallback TTL.
    expect(revalidation.isStale('node:lp-1')).toBe(true);
  });

  it('logs the error message for an item whose fetch failed', async () => {
    mockNode('lp-2', [{ type: 'paragraph--broken', id: 'p-9' }]);
    const warnSpy = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const { service, registry } = buildService();
    registry.register({
      jsonApiType: 'paragraph--broken',
      fetcher: {
        jsonApiType: 'paragraph--broken',
        cacheStrategy: 'per-request',
        fetchById: async () => {
          throw new Error('boom');
        },
      },
    });

    await service.getLandingPage('lp-2', ENV);

    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('status=failed error=boom'));
  });

  it('does not mark the page stale when every item resolves', async () => {
    mockNode('lp-3', []);
    const { service, revalidation } = buildService();

    await service.getLandingPage('lp-3', ENV);

    expect(revalidation.isStale('node:lp-3')).toBe(false);
  });
});
