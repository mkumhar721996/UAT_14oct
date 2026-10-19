import { Logger } from '@nestjs/common';
import type { RevalidationRegistry } from './revalidation-registry';

const logger = new Logger('PageCache');

// Serve cached unless explicitly marked stale (on-demand revalidation) or past the fallback TTL.
export function createPageCache<T>(options: { ttlMs: number }) {
  const entries = new Map<string, { data: T; renderedAt: number }>();
  const inFlight = new Map<string, Promise<T>>();
  return {
    async get(tag: string, revalidation: RevalidationRegistry, build: () => Promise<T>): Promise<T> {
      const cached = entries.get(tag);
      const withinTtl = !!cached && Date.now() - cached.renderedAt < options.ttlMs;
      const stale = !!cached && revalidation.isStale(tag);
      if (cached && withinTtl && !stale) {
        logger.log('page_cache_result count=1 result=hit');
        return cached.data;
      }
      // Bounded label set (hit/miss/stale/ttl_expired): safe to log, never derived from the tag itself.
      logger.log(`page_cache_result count=1 result=${!cached ? 'miss' : stale ? 'stale' : 'ttl_expired'}`);
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
