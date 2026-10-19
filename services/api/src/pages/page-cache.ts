import type { RevalidationRegistry } from '../drupal/revalidation-registry';

export interface PageCache {
  getOrCompose<T>(tag: string, ttlMs: number, compose: () => Promise<T>): Promise<T>;
}

// Tag-keyed composed-page cache: recomposes on a missing entry, an explicit stale mark, or an
// elapsed TTL. Concurrent misses for one tag share a single compose() (single-process only).
export function createPageCache(revalidation: RevalidationRegistry, now: () => number = Date.now): PageCache {
  const entries = new Map<string, { value: unknown; cachedAt: number }>();
  const inFlight = new Map<string, Promise<unknown>>();

  return {
    async getOrCompose<T>(tag: string, ttlMs: number, compose: () => Promise<T>): Promise<T> {
      const entry = entries.get(tag);
      if (entry && !revalidation.isStale(tag) && now() - entry.cachedAt < ttlMs) {
        return entry.value as T;
      }
      const pending = inFlight.get(tag);
      if (pending) return pending as Promise<T>;

      const run = (async () => {
        try {
          // Clear before composing so a stale mark set mid-compose is not lost.
          revalidation.clearStale(tag);
          const value = await compose();
          entries.set(tag, { value, cachedAt: now() });
          return value;
        } finally {
          inFlight.delete(tag);
        }
      })();
      inFlight.set(tag, run);
      return run;
    },
  };
}
