import { Inject, Injectable } from '@nestjs/common';
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

export interface ComposedClientWorkPage {
  pageId: string;
  title: string;
  body: string;
  heroImage: { url: string; alt: string } | null;
  paragraphs: ComposedParagraph[];
}

@Injectable()
export class PagesService {
  constructor(@Inject(CLIENT_WORK_RESOURCE_REGISTRY) private readonly registry: ResourceRegistry) {}

  async composeClientWorkPage(id: string, env?: NodeJS.ProcessEnv): Promise<ComposedClientWorkPage> {
    let node;
    try {
      node = await clientWorkPageFetcher.fetchById(id, env);
    } catch (error) {
      if (error instanceof DrupalFetchError && error.status === 404) throw new PageNotFoundError(id);
      throw error;
    }
    const resolved = await resolveResources(this.registry, node.paragraphRefs, env);
    const paragraphs = resolved.map((item): ComposedParagraph => {
      if (item.status !== 'resolved') return { status: item.status };
      if (item.componentKey) return { status: 'component', componentKey: item.componentKey, data: item.data };
      return { status: 'html-fragment', html: (item.data as { html: string }).html };
    });
    return { pageId: id, title: node.title, body: node.body, heroImage: node.heroImage, paragraphs };
  }
}
