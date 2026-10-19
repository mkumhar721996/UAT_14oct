import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { RESOURCE_REGISTRY, REVALIDATION_REGISTRY } from '../drupal/drupal.tokens';
import { createPageCache } from '../drupal/page-cache';
import { resolveResources, type ResourceRegistry } from '../drupal/resource-registry';
import type { RevalidationRegistry } from '../drupal/revalidation-registry';
import { createLandingPageFetcher } from './landing-page-fetcher';
import { registerLandingPageParagraphDispatch } from './landing-page-paragraph-dispatch';

// Placeholder fallback TTL: no value is specified by the story.
export const LANDING_PAGE_CACHE_TTL_MS = 5 * 60 * 1000;

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
    return this.cache.get(`node:${pageId}`, this.revalidation, async () => {
      const node = await this.landingPageFetcher.fetchById(pageId, env);
      const [images, paragraphs] = await Promise.all([
        resolveResources(this.registry, node.imageRefs, env),
        resolveResources(this.registry, node.paragraphRefs, env),
      ]);
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
