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
      const wasStale = revalidation.isStale(tag);
      if (cached && withinTtl && !wasStale) {
        logger.log('page_cache_result count=1 result=hit');
        return cached.data;
      }
      // Bounded label set (hit/miss/stale/ttl_expired): safe to log, never derived from the tag itself.
      logger.log(`page_cache_result count=1 result=${!cached ? 'miss' : wasStale ? 'stale' : 'ttl_expired'}`);
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
          // A failing build only gets to (re-)mark the tag stale if there's something worth
          // retrying for: an existing cache entry (so a transient failure can't silently freeze
          // a page at its old content past an explicit ask to revalidate it), or a revalidation
          // that was already pending before this attempt. A tag that's never been cached and was
          // never explicitly asked to revalidate doesn't get to originate a brand-new stale mark
          // from a failure alone -- the public, unauthenticated route this cache sits behind could
          // otherwise be used to grow the stale set with tags that never had a real cache entry.
          if (entries.has(tag) || wasStale) revalidation.markStale(tag);
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
