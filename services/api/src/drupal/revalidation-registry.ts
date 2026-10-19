// Explicit, caller-driven invalidation only: there is deliberately no time-based expiry.
export function createRevalidationRegistry() {
  const stale = new Set<string>();
  return {
    markStale(tag: string): void {
      stale.add(tag);
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
