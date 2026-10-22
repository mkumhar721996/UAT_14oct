import { afterEach, describe, expect, it, vi } from 'vitest';
import { createResourceRegistry, resolveResources } from '../drupal/resource-registry';
import { createLandingPageFetcher } from './landing-page-fetcher';
import { LEGACY_HTML_FRAGMENT_KEY, registerLandingPageParagraphDispatch } from './landing-page-paragraph-dispatch';

const ENV = { DRUPAL_BASE_URL: 'http://local.docksal.site', DRUPAL_ACCESS_TOKEN: 'test-token' };

afterEach(() => vi.restoreAllMocks());

const mockJson = (data: unknown) =>
  vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response(JSON.stringify({ data }), { status: 200 }));

describe('createLandingPageFetcher', () => {
  it('parses title, sanitized body and normalized relationships', async () => {
    mockJson({
      type: 'node--landing_page',
      id: 'lp-1',
      attributes: { title: 'Sale', body: { processed: '<p>Hi</p><script>x</script>' } },
      relationships: {
        field_image: { data: { type: 'media--image', id: 'm1' } },
        field_paragraphs: { data: [{ type: 'paragraph--rich_text', id: 'p1' }] },
      },
    });
    const node = await createLandingPageFetcher().fetchById('lp-1', ENV);
    expect(node.title).toBe('Sale');
    expect(node.bodyHtml).toBe('<p>Hi</p>');
    expect(node.imageRefs).toEqual([{ type: 'media--image', id: 'm1' }]);
    expect(node.paragraphRefs).toHaveLength(1);
  });

  it('defaults a missing body and relationships to empty', async () => {
    mockJson({ type: 'node--landing_page', id: 'lp-2', attributes: { title: 'T' } });
    const node = await createLandingPageFetcher().fetchById('lp-2', ENV);
    expect(node).toMatchObject({ bodyHtml: '', imageRefs: [], paragraphRefs: [] });
  });
});

describe('registerLandingPageParagraphDispatch', () => {
  it('AC2: a native paragraph type resolves with its componentKey', async () => {
    const registry = createResourceRegistry();
    registerLandingPageParagraphDispatch(registry);
    mockJson({ type: 'paragraph--rich_text', id: 'p-1', attributes: { text: 'Hello' } });
    const [resolved] = await resolveResources(registry, [{ type: 'paragraph--rich_text', id: 'p-1' }], ENV);
    expect(resolved).toMatchObject({ status: 'resolved', componentKey: 'RichText', data: { text: 'Hello' } });
  });

  it('AC4: each of the six legacy types resolves through its HTML fragment', async () => {
    const registry = createResourceRegistry();
    registerLandingPageParagraphDispatch(registry);
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response('<p>legacy</p>', { status: 200 }));
    const types = ['promo', 'cta', 'testimonial', 'media_embed', 'accordion', 'table'].map((t) => `paragraph--legacy_${t}`);
    const out = await resolveResources(registry, types.map((type) => ({ type, id: 'x' })), ENV);
    expect(out).toHaveLength(6);
    for (const r of out) expect(r).toMatchObject({ status: 'resolved', componentKey: LEGACY_HTML_FRAGMENT_KEY, data: { html: '<p>legacy</p>' } });
  });
});
