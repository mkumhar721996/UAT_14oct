import { afterEach, describe, expect, it, vi } from 'vitest';
import { createResourceRegistry, resolveResources } from '../../drupal/resource-registry';
import { registerClientWorkParagraphs } from './client-work-paragraphs';

const ENV = { DRUPAL_BASE_URL: 'https://drupal.test', DRUPAL_ACCESS_TOKEN: 'test-token' };
afterEach(() => vi.restoreAllMocks());

describe('registerClientWorkParagraphs', () => {
  it('AC2: a native paragraph resolves with its component key', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      async () =>
        new Response(JSON.stringify({ data: { type: 'paragraph--quote', id: '1', attributes: { text: 'hi' } } }), { status: 200 }),
    );
    const registry = createResourceRegistry();
    registerClientWorkParagraphs(registry);
    const [resolved] = await resolveResources(registry, [{ type: 'paragraph--quote', id: '1' }], ENV);
    expect(resolved).toMatchObject({ status: 'resolved', componentKey: 'Quote', data: { text: 'hi' } });
  });

  it('AC3: a legacy paragraph resolves to its fetched HTML fragment, with no component key', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response('<p>legacy</p>', { status: 200 }));
    const registry = createResourceRegistry();
    registerClientWorkParagraphs(registry);
    const [resolved] = await resolveResources(registry, [{ type: 'paragraph--legacy_quote', id: '1' }], ENV);
    expect(resolved).toEqual({
      status: 'resolved',
      jsonApiType: 'paragraph--legacy_quote',
      componentKey: undefined,
      data: { html: '<p>legacy</p>' },
    });
  });

  it('registers six legacy types without a component key', () => {
    const registry = createResourceRegistry();
    registerClientWorkParagraphs(registry);
    const legacy = ['quote', 'stats', 'video', 'cta', 'carousel', 'accordion'].map((n) =>
      registry.resolve(`paragraph--legacy_${n}`),
    );
    expect(legacy.every((r) => r && r.componentKey === undefined)).toBe(true);
  });

  it('throws when called twice on the same registry', () => {
    const registry = createResourceRegistry();
    registerClientWorkParagraphs(registry);
    expect(() => registerClientWorkParagraphs(registry)).toThrow(/already registered/);
  });
});
