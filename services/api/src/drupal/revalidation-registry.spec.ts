import { describe, expect, it } from 'vitest';
import { createRevalidationRegistry } from './revalidation-registry';

describe('revalidation registry', () => {
  it('reports a marked tag as stale and clears it (AC11)', () => {
    const registry = createRevalidationRegistry();
    expect(registry.isStale('node:42')).toBe(false);
    registry.markStale('node:42');
    expect(registry.isStale('node:42')).toBe(true);
    registry.clearStale('node:42');
    expect(registry.isStale('node:42')).toBe(false);
  });

  it('keeps untargeted tags fresh even after time passes (AC12)', () => {
    const registry = createRevalidationRegistry();
    registry.markStale('node:99');
    expect(registry.isStale('node:42')).toBe(false);
  });

  it('evicts the oldest stale tag once the bound is exceeded', () => {
    const registry = createRevalidationRegistry({ maxStaleTags: 2 });
    registry.markStale('node:1');
    registry.markStale('node:2');
    registry.markStale('node:3');
    expect(registry.isStale('node:1')).toBe(false);
    expect(registry.isStale('node:2')).toBe(true);
    expect(registry.isStale('node:3')).toBe(true);
  });
});
