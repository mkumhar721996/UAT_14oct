import type { RevalidationRegistry } from './revalidation-registry';

// Serve cached unless explicitly marked stale (on-demand revalidation) or past the fallback TTL.
export function createPageCache<T>(options: { ttlMs: number }) {
  const entries = new Map<string, { data: T; renderedAt: number }>();
  const inFlight = new Map<string, Promise<T>>();
  return {
    async get(tag: string, revalidation: RevalidationRegistry, build: () => Promise<T>): Promise<T> {
      const cached = entries.get(tag);
      const withinTtl = !!cached && Date.now() - cached.renderedAt < options.ttlMs;
      if (cached && withinTtl && !revalidation.isStale(tag)) return cached.data;
      // Concurrent cold requests share one build, unless a revalidation landed since it started.
      const pending = inFlight.get(tag);
      if (pending && !revalidation.isStale(tag)) return pending;
      // Clear before building: a revalidation arriving mid-build re-marks the tag and is not lost.
      revalidation.clearStale(tag);
      const promise = build().then(
        (data) => {
          entries.set(tag, { data, renderedAt: Date.now() });
          return data;
        },
        (error) => {
          revalidation.markStale(tag);
          throw error;
        },
      );
      inFlight.set(tag, promise);
      const done = () => {
        if (inFlight.get(tag) === promise) inFlight.delete(tag);
      };
      promise.then(done, done);
      return promise;
    },
  };
}
