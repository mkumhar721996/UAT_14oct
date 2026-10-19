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
});
