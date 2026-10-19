import type { RevalidationRegistry } from './revalidation-registry';

// Serve cached unless explicitly marked stale (on-demand revalidation) or past the fallback TTL.
export function createPageCache<T>(options: { ttlMs: number }) {
  const entries = new Map<string, { data: T; renderedAt: number }>();
  return {
    async get(tag: string, revalidation: RevalidationRegistry, build: () => Promise<T>): Promise<T> {
      const cached = entries.get(tag);
      const withinTtl = !!cached && Date.now() - cached.renderedAt < options.ttlMs;
      if (cached && withinTtl && !revalidation.isStale(tag)) return cached.data;
      const data = await build();
      entries.set(tag, { data, renderedAt: Date.now() });
      revalidation.clearStale(tag);
      return data;
    },
  };
}
