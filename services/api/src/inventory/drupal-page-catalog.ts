import { fetchDrupalResource } from '../drupal/drupal-client';
import type { JsonApiResource } from '../drupal/jsonapi-types';
import { PAGE_CONTENT_TYPES, TEMPLATE_TYPES, TemplateType } from './template-type';

export interface CatalogPage {
  pageId: string;
  templateType: TemplateType;
  title: string;
  path: string | null;
}

interface CollectionBody {
  data: JsonApiResource[];
  links?: { next?: { href?: string } };
}

// Live query of every published node per template content type, following JSON:API pagination.
export async function fetchPublishedPages(env: NodeJS.ProcessEnv = process.env): Promise<CatalogPage[]> {
  const pages: CatalogPage[] = [];
  for (const templateType of TEMPLATE_TYPES) {
    let next: string | undefined = `/jsonapi/node/${PAGE_CONTENT_TYPES[templateType]}?filter[status]=1`;
    while (next) {
      const body = (await fetchDrupalResource(next, env)) as CollectionBody;
      for (const resource of body.data ?? []) {
        pages.push({
          pageId: resource.id,
          templateType,
          title: (resource.attributes.title as string | undefined) ?? '',
          path: (resource.attributes.path as { alias?: string | null } | undefined)?.alias ?? null,
        });
      }
      next = body.links?.next?.href;
    }
  }
  return pages;
}
