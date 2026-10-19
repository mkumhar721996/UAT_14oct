import { describe, expect, it, vi } from 'vitest';
import { createRevalidationRegistry } from '../drupal/revalidation-registry';
import { createPageCache } from './page-cache';

describe('createPageCache', () => {
  it('AC4: serves the second request from the cache', async () => {
    const compose = vi.fn().mockResolvedValue({ v: 1 });
    const cache = createPageCache(createRevalidationRegistry());
    await cache.getOrCompose('node:1', 60000, compose);
    await expect(cache.getOrCompose('node:1', 60000, compose)).resolves.toEqual({ v: 1 });
    expect(compose).toHaveBeenCalledTimes(1);
  });

  it('AC4: is keyed per tag', async () => {
    const cache = createPageCache(createRevalidationRegistry());
    const a = vi.fn().mockResolvedValue('a');
    const b = vi.fn().mockResolvedValue('b');
    await cache.getOrCompose('node:1', 60000, a);
    await cache.getOrCompose('node:2', 60000, b);
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
  });

  it('AC4: dedupes concurrent misses', async () => {
    const cache = createPageCache(createRevalidationRegistry());
    let resolveCompose!: () => void;
    const compose = vi.fn(() => new Promise((r) => { resolveCompose = () => r({ v: 1 }); }));
    const p1 = cache.getOrCompose('node:1', 60000, compose);
    const p2 = cache.getOrCompose('node:1', 60000, compose);
    resolveCompose();
    await Promise.all([p1, p2]);
    expect(compose).toHaveBeenCalledTimes(1);
  });

  it('AC4: a failed compose is not cached and the next call retries', async () => {
    const cache = createPageCache(createRevalidationRegistry());
    const compose = vi.fn().mockRejectedValueOnce(new Error('drupal down')).mockResolvedValueOnce({ v: 1 });
    await expect(cache.getOrCompose('node:1', 60000, compose)).rejects.toThrow('drupal down');
    await expect(cache.getOrCompose('node:1', 60000, compose)).resolves.toEqual({ v: 1 });
  });

  it('AC5: an explicit stale mark forces recomposition once', async () => {
    const reg = createRevalidationRegistry();
    const cache = createPageCache(reg);
    const compose = vi.fn().mockResolvedValueOnce('v1').mockResolvedValueOnce('v2');
    await cache.getOrCompose('node:1', 60000, compose);
    reg.markStale('node:1');
    await expect(cache.getOrCompose('node:1', 60000, compose)).resolves.toBe('v2');
    await cache.getOrCompose('node:1', 60000, compose);
    expect(compose).toHaveBeenCalledTimes(2);
    expect(reg.isStale('node:1')).toBe(false);
  });

  it('AC6: recomposes once the TTL has elapsed', async () => {
    const now = vi.fn(() => 0);
    const cache = createPageCache(createRevalidationRegistry(), now);
    const compose = vi.fn().mockResolvedValue('x');
    await cache.getOrCompose('node:1', 1000, compose);
    now.mockReturnValue(1500);
    await cache.getOrCompose('node:1', 1000, compose);
    expect(compose).toHaveBeenCalledTimes(2);
  });

  it('AC6: still serves the cached value one millisecond before the TTL', async () => {
    const now = vi.fn(() => 0);
    const cache = createPageCache(createRevalidationRegistry(), now);
    const compose = vi.fn().mockResolvedValue('x');
    await cache.getOrCompose('node:1', 1000, compose);
    now.mockReturnValue(999);
    await cache.getOrCompose('node:1', 1000, compose);
    expect(compose).toHaveBeenCalledTimes(1);
    now.mockReturnValue(1000);
    await cache.getOrCompose('node:1', 1000, compose);
    expect(compose).toHaveBeenCalledTimes(2);
  });

  it('does not cache a value the cacheable predicate rejects', async () => {
    const cache = createPageCache(createRevalidationRegistry());
    const compose = vi.fn().mockResolvedValueOnce('degraded').mockResolvedValueOnce('good');
    const good = (v: string) => v === 'good';
    await expect(cache.getOrCompose('node:1', 60000, compose, good)).resolves.toBe('degraded');
    await expect(cache.getOrCompose('node:1', 60000, compose, good)).resolves.toBe('good');
    await cache.getOrCompose('node:1', 60000, compose, good);
    expect(compose).toHaveBeenCalledTimes(2);
  });
});
