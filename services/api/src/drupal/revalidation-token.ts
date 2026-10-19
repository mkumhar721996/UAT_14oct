import { createHash, timingSafeEqual } from 'node:crypto';

const digest = (value: string) => createHash('sha256').update(value).digest();

// Hashing first gives equal-length buffers, so the comparison is constant-time for any input.
export function isValidRevalidationToken(token: string | undefined, env: NodeJS.ProcessEnv = process.env): boolean {
  const expected = env.REVALIDATION_TOKEN ?? '';
  if (expected.length === 0 || token === undefined) return false;
  return timingSafeEqual(digest(token), digest(expected));
}
