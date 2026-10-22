import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { RESOURCE_REGISTRY, REVALIDATION_REGISTRY } from '../drupal/drupal.tokens';
import { createPageCache } from '../drupal/page-cache';
import { resolveResources, type ResourceRegistry } from '../drupal/resource-registry';
import type { RevalidationRegistry } from '../drupal/revalidation-registry';
import { createLandingPageFetcher } from './landing-page-fetcher';
import { registerLandingPageParagraphDispatch } from './landing-page-paragraph-dispatch';

// Placeholder fallback TTL: no value is specified by the story.
export const LANDING_PAGE_CACHE_TTL_MS = 5 * 60 * 1000;

// Short negative-cache window for a transient ('failed') item: long enough to absorb a brief
// Drupal hiccup without hammering it on every request, short enough that the cache isn't
// serving degraded content for anywhere near the full fallback TTL.
export const TRANSIENT_FAILURE_RETRY_MS = 15 * 1000;

export interface LandingPageContent {
  contentType: 'landing_page';
  pageId: string;
  title: string;
  bodyHtml: string;
  images: Array<{ url: string; alt: string }>;
  paragraphs: Awaited<ReturnType<typeof resolveResources>>;
}

@Injectable()
export class PagesService implements OnModuleInit {
  private readonly logger = new Logger(PagesService.name);
  private readonly cache = createPageCache<LandingPageContent>({ ttlMs: LANDING_PAGE_CACHE_TTL_MS });
  private readonly landingPageFetcher = createLandingPageFetcher();

  constructor(
    @Inject(RESOURCE_REGISTRY) private readonly registry: ResourceRegistry,
    @Inject(REVALIDATION_REGISTRY) private readonly revalidation: RevalidationRegistry,
  ) {}

  onModuleInit() {
    registerLandingPageParagraphDispatch(this.registry);
  }

  getLandingPage(pageId: string, env?: NodeJS.ProcessEnv): Promise<LandingPageContent> {
    const tag = `node:${pageId}`;
    return this.cache.get(tag, this.revalidation, async () => {
      const node = await this.landingPageFetcher.fetchById(pageId, env);
      const [images, paragraphs] = await Promise.all([
        resolveResources(this.registry, node.imageRefs, env),
        resolveResources(this.registry, node.paragraphRefs, env),
      ]);
      const unresolved = [...images, ...paragraphs].filter((item) => item.status !== 'resolved');
      for (const item of unresolved) {
        const error = item.status === 'failed' ? ` error=${item.error}` : '';
        this.logger.warn(`landing_page_item_unresolved count=1 pageId=${pageId} jsonApiType=${item.jsonApiType} status=${item.status}${error}`);
      }
      // 'unresolved' (no fetcher registered for that type) is permanent, not a cache-freshness
      // problem: it will look exactly the same on every rebuild, so the normal TTL/on-demand
      // revalidation governs it like any other content. Only a 'failed' item (a fetch that threw,
      // e.g. a transient 5xx) gets a short, bounded retry window -- marking stale on every
      // request here would make the page cache a no-op for any page with a permanently
      // unresolved item, since every rebuild would re-trigger the full Drupal fan-out.
      if (unresolved.some((item) => item.status === 'failed')) {
        setTimeout(() => this.revalidation.markStale(tag), TRANSIENT_FAILURE_RETRY_MS).unref();
      }
      return {
        contentType: 'landing_page',
        pageId,
        title: node.title,
        bodyHtml: node.bodyHtml,
        images: images.flatMap((i) => (i.status === 'resolved' ? [i.data as { url: string; alt: string }] : [])),
        paragraphs,
      };
    });
  }
}
