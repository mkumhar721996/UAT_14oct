import { Inject, Injectable, Logger } from '@nestjs/common';
import { DrupalFetchError } from '../drupal/drupal-client';
import { resolveResources, type ResourceRegistry } from '../drupal/resource-registry';
import { clientWorkPageFetcher } from './client-work/client-work-page.fetcher';

export const CLIENT_WORK_RESOURCE_REGISTRY = Symbol('CLIENT_WORK_RESOURCE_REGISTRY');

export class PageNotFoundError extends Error {
  constructor(id: string) {
    super(`Page "${id}" was not found`);
    this.name = 'PageNotFoundError';
  }
}

export type ComposedParagraph =
  | { status: 'component'; componentKey: string; data: unknown }
  | { status: 'html-fragment'; html: string }
  | { status: 'unresolved' | 'failed' };

// A degraded page (a paragraph failed to load) is served but must not be cached for the full TTL.
export const isCacheablePage = (page: ComposedClientWorkPage) =>
  page.paragraphs.every((p) => p.status !== 'failed');

export interface ComposedClientWorkPage {
  pageId: string;
  title: string;
  body: string;
  heroImage: { url: string; alt: string } | null;
  paragraphs: ComposedParagraph[];
}

@Injectable()
export class PagesService {
  private readonly logger = new Logger(PagesService.name);

  constructor(@Inject(CLIENT_WORK_RESOURCE_REGISTRY) private readonly registry: ResourceRegistry) {}

  async composeClientWorkPage(id: string, env?: NodeJS.ProcessEnv): Promise<ComposedClientWorkPage> {
    let node;
    try {
      node = await clientWorkPageFetcher.fetchById(id, env);
    } catch (error) {
      if (error instanceof DrupalFetchError && error.status === 404) throw new PageNotFoundError(id);
      throw error;
    }
    // The fetch uses a privileged token, so drafts must never reach the public endpoint.
    if (!node.published) throw new PageNotFoundError(id);
    const resolved = await resolveResources(this.registry, node.paragraphRefs, env);
    for (const item of resolved) {
      if (item.status === 'failed') this.logger.warn(`Paragraph ${item.jsonApiType} on page ${id} failed: ${item.error}`);
    }
    const paragraphs = resolved.map((item): ComposedParagraph => {
      if (item.status !== 'resolved') return { status: item.status };
      if (item.componentKey) return { status: 'component', componentKey: item.componentKey, data: item.data };
      return { status: 'html-fragment', html: (item.data as { html: string }).html };
    });
    return { pageId: id, title: node.title, body: node.body, heroImage: node.heroImage, paragraphs };
  }
}
