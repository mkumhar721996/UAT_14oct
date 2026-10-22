import { Logger } from '@nestjs/common';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createResourceRegistry } from '../drupal/resource-registry';
import { createRevalidationRegistry } from '../drupal/revalidation-registry';
import { PagesService, TRANSIENT_FAILURE_RETRY_MS } from './pages.service';

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

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

const registerThrowingFetcher = (registry: ReturnType<typeof createResourceRegistry>, jsonApiType: string, message: string) =>
  registry.register({
    jsonApiType,
    fetcher: {
      jsonApiType,
      cacheStrategy: 'per-request',
      fetchById: async () => {
        throw new Error(message);
      },
    },
  });

describe('PagesService', () => {
  it('logs an unresolved item with its pageId, type and status, but does not mark the page stale (permanent, not a freshness problem)', async () => {
    mockNode('lp-1', [{ type: 'paragraph--unregistered', id: 'p-1' }]);
    const warnSpy = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const { service, revalidation } = buildService();

    const first = await service.getLandingPage('lp-1', ENV);

    expect(first.paragraphs[0]).toMatchObject({ status: 'unresolved' });
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('landing_page_item_unresolved'));
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('pageId=lp-1'));
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('jsonApiType=paragraph--unregistered'));
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('status=unresolved'));
    // Marking stale here would make the cache a no-op for this page on every request.
    expect(revalidation.isStale('node:lp-1')).toBe(false);
  });

  it('logs the error message for an item whose fetch failed, and marks the page stale only after a short retry window', async () => {
    vi.useFakeTimers();
    mockNode('lp-2', [{ type: 'paragraph--broken', id: 'p-9' }]);
    const warnSpy = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const { service, registry, revalidation } = buildService();
    registerThrowingFetcher(registry, 'paragraph--broken', 'boom');

    await service.getLandingPage('lp-2', ENV);

    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('status=failed error=boom'));
    // Served from cache immediately after: a transient failure shouldn't retry on every request.
    expect(revalidation.isStale('node:lp-2')).toBe(false);
    await vi.advanceTimersByTimeAsync(TRANSIENT_FAILURE_RETRY_MS);
    expect(revalidation.isStale('node:lp-2')).toBe(true);
  });

  it('does not mark the page stale when every item resolves', async () => {
    mockNode('lp-3', []);
    const { service, revalidation } = buildService();

    await service.getLandingPage('lp-3', ENV);

    expect(revalidation.isStale('node:lp-3')).toBe(false);
  });
});
