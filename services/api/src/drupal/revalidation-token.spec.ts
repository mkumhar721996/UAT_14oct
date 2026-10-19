import { describe, expect, it } from 'vitest';
import { isValidRevalidationToken } from './revalidation-token';

describe('isValidRevalidationToken', () => {
  it('accepts only the exact configured token', () => {
    expect(isValidRevalidationToken('fake-token', { REVALIDATION_TOKEN: 'fake-token' })).toBe(true);
    expect(isValidRevalidationToken('wrong', { REVALIDATION_TOKEN: 'fake-token' })).toBe(false);
  });
  it('rejects everything when no token is configured, even an empty one', () => {
    expect(isValidRevalidationToken('', {})).toBe(false);
    expect(isValidRevalidationToken(undefined, {})).toBe(false);
  });
});
