import { afterEach, describe, expect, it, vi } from 'vitest';
import { createPageCache } from './page-cache';
import { createRevalidationRegistry } from './revalidation-registry';

afterEach(() => vi.useRealTimers());

describe('createPageCache', () => {
  it('returns the cached value without rebuilding', async () => {
    const cache = createPageCache<number>({ ttlMs: 1000 });
    const reval = createRevalidationRegistry();
    const build = vi.fn().mockResolvedValueOnce(1).mockResolvedValueOnce(2);
    expect(await cache.get('t', reval, build)).toBe(1);
    expect(await cache.get('t', reval, build)).toBe(1);
    expect(build).toHaveBeenCalledTimes(1);
  });

  it('rebuilds once after the tag is marked stale, then caches again', async () => {
    const cache = createPageCache<number>({ ttlMs: 1000 });
    const reval = createRevalidationRegistry();
    const build = vi.fn().mockResolvedValueOnce(1).mockResolvedValueOnce(2);
    await cache.get('t', reval, build);
    reval.markStale('t');
    expect(await cache.get('t', reval, build)).toBe(2);
    expect(reval.isStale('t')).toBe(false);
    expect(await cache.get('t', reval, build)).toBe(2);
    expect(build).toHaveBeenCalledTimes(2);
  });

  it('rebuilds after the fallback TTL elapses', async () => {
    vi.useFakeTimers();
    const cache = createPageCache<number>({ ttlMs: 1000 });
    const reval = createRevalidationRegistry();
    const build = vi.fn().mockResolvedValueOnce(1).mockResolvedValueOnce(2);
    await cache.get('t', reval, build);
    vi.advanceTimersByTime(1001);
    expect(await cache.get('t', reval, build)).toBe(2);
  });

  it('keeps tags independent', async () => {
    const cache = createPageCache<string>({ ttlMs: 1000 });
    const reval = createRevalidationRegistry();
    await cache.get('a', reval, async () => 'a');
    expect(await cache.get('b', reval, async () => 'b')).toBe('b');
  });
});
