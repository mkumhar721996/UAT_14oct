import { describe, expect, it } from 'vitest';
import { createResourceRegistry, resolveResources } from './resource-registry';
import type { TypedFetcher } from './typed-fetcher';

const fixtureFetcher = <T>(jsonApiType: string, data: T): TypedFetcher<T> => ({
  jsonApiType,
  cacheStrategy: 'static-revalidatable',
  fetchById: async () => data,
});

describe('resource registry', () => {
  it('dispatches a content resource to its fetcher (AC1)', async () => {
    const registry = createResourceRegistry();
    registry.register({ jsonApiType: 'example--article', fetcher: fixtureFetcher('example--article', { title: 'Hi' }) });
    const [resolved] = await resolveResources(registry, [{ type: 'example--article', id: '1' }]);
    expect(resolved).toEqual({
      status: 'resolved',
      jsonApiType: 'example--article',
      componentKey: undefined,
      data: { title: 'Hi' },
    });
  });

  it('dispatches a paragraph to its fetcher and component key (AC2)', async () => {
    const registry = createResourceRegistry();
    registry.register({
      jsonApiType: 'example--quote',
      fetcher: fixtureFetcher('example--quote', { text: 'quoted' }),
      componentKey: 'QuoteParagraph',
    });
    const [resolved] = await resolveResources(registry, [{ type: 'example--quote', id: '2' }]);
    expect(resolved).toEqual({
      status: 'resolved',
      jsonApiType: 'example--quote',
      componentKey: 'QuoteParagraph',
      data: { text: 'quoted' },
    });
  });

  it('rejects a duplicate registration (AC4)', () => {
    const registry = createResourceRegistry();
    registry.register({ jsonApiType: 'example--quote', fetcher: fixtureFetcher('example--quote', {}), componentKey: 'QuoteParagraph' });
    expect(() =>
      registry.register({ jsonApiType: 'example--quote', fetcher: fixtureFetcher('example--quote', {}), componentKey: 'OtherParagraph' }),
    ).toThrow(/already registered/);
  });

  it('marks an unregistered type as unresolved without throwing (AC9)', async () => {
    const [resolved] = await resolveResources(createResourceRegistry(), [{ type: 'example--unregistered', id: '1' }]);
    expect(resolved).toEqual({ status: 'unresolved', jsonApiType: 'example--unregistered' });
  });

  it('still resolves siblings of an unregistered type (AC10)', async () => {
    const registry = createResourceRegistry();
    registry.register({
      jsonApiType: 'example--quote',
      fetcher: fixtureFetcher('example--quote', { text: 'quoted' }),
      componentKey: 'QuoteParagraph',
    });
    const resolved = await resolveResources(registry, [
      { type: 'example--unregistered', id: '1' },
      { type: 'example--quote', id: '2' },
    ]);
    expect(resolved).toEqual([
      { status: 'unresolved', jsonApiType: 'example--unregistered' },
      { status: 'resolved', jsonApiType: 'example--quote', componentKey: 'QuoteParagraph', data: { text: 'quoted' } },
    ]);
  });

  it('isolates a rejecting fetcher so siblings still resolve (AC10)', async () => {
    const registry = createResourceRegistry();
    registry.register({
      jsonApiType: 'example--broken',
      fetcher: { jsonApiType: 'example--broken', cacheStrategy: 'per-request', fetchById: async () => { throw new Error('boom'); } },
    });
    registry.register({ jsonApiType: 'example--quote', fetcher: fixtureFetcher('example--quote', { text: 'q' }), componentKey: 'QuoteParagraph' });
    const resolved = await resolveResources(registry, [
      { type: 'example--broken', id: '1' },
      { type: 'example--quote', id: '2' },
    ]);
    expect(resolved).toEqual([
      { status: 'failed', jsonApiType: 'example--broken', error: 'boom' },
      { status: 'resolved', jsonApiType: 'example--quote', componentKey: 'QuoteParagraph', data: { text: 'q' } },
    ]);
  });
});
