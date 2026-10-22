// Explicit, caller-driven invalidation only: there is deliberately no time-based expiry.
// Bounded (oldest-first eviction) because markStale is reachable from the public,
// unauthenticated landing-page route on every build failure: without a cap, requests for
// arbitrary pageIds would grow this Set without limit.
const DEFAULT_MAX_STALE_TAGS = 1000;

export function createRevalidationRegistry(options?: { maxStaleTags?: number }) {
  const maxStaleTags = options?.maxStaleTags ?? DEFAULT_MAX_STALE_TAGS;
  const stale = new Set<string>();
  return {
    markStale(tag: string): void {
      stale.delete(tag);
      stale.add(tag);
      while (stale.size > maxStaleTags) {
        const oldest = stale.values().next().value;
        if (oldest === undefined) break;
        stale.delete(oldest);
      }
    },
    isStale(tag: string): boolean {
      return stale.has(tag);
    },
    clearStale(tag: string): void {
      stale.delete(tag);
    },
  };
}

export type RevalidationRegistry = ReturnType<typeof createRevalidationRegistry>;
