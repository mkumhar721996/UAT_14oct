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

  it('coalesces concurrent cold requests into one build', async () => {
    const cache = createPageCache<number>({ ttlMs: 1000 });
    const reval = createRevalidationRegistry();
    const build = vi.fn(async () => 1);
    await Promise.all([cache.get('t', reval, build), cache.get('t', reval, build)]);
    expect(build).toHaveBeenCalledTimes(1);
  });

  it('keeps a revalidation that arrives mid-build so the next request rebuilds', async () => {
    const cache = createPageCache<string>({ ttlMs: 1000 });
    const reval = createRevalidationRegistry();
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const first = cache.get('t', reval, async () => {
      await gate;
      return 'old';
    });
    reval.markStale('t');
    release();
    expect(await first).toBe('old');
    expect(await cache.get('t', reval, async () => 'new')).toBe('new');
  });

  it('re-marks the tag stale when the build fails, if it was already explicitly marked stale', async () => {
    const cache = createPageCache<number>({ ttlMs: 1000 });
    const reval = createRevalidationRegistry();
    reval.markStale('t');
    await expect(cache.get('t', reval, async () => Promise.reject(new Error('boom')))).rejects.toThrow('boom');
    expect(reval.isStale('t')).toBe(true);
  });

  it('re-marks the tag stale when a rebuild of an existing cache entry fails', async () => {
    const cache = createPageCache<number>({ ttlMs: 1000 });
    const reval = createRevalidationRegistry();
    await cache.get('t', reval, async () => 1);
    reval.markStale('t');
    await expect(cache.get('t', reval, async () => Promise.reject(new Error('boom')))).rejects.toThrow('boom');
    expect(reval.isStale('t')).toBe(true);
  });

  it('does not originate a stale mark from a failed build for a tag that was never cached and never explicitly revalidated', async () => {
    const cache = createPageCache<number>({ ttlMs: 1000 });
    const reval = createRevalidationRegistry();
    await expect(cache.get('t', reval, async () => Promise.reject(new Error('boom')))).rejects.toThrow('boom');
    expect(reval.isStale('t')).toBe(false);
  });
});
