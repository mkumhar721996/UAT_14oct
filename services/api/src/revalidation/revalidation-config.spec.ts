import { describe, expect, it } from 'vitest';
import { loadRevalidationConfig } from './revalidation-config';

describe('loadRevalidationConfig', () => {
  it('reads the shared secret', () => {
    expect(loadRevalidationConfig({ REVALIDATION_SECRET: 'fake-secret' })).toEqual({ secret: 'fake-secret' });
  });

  it('throws when the secret is missing', () => {
    expect(() => loadRevalidationConfig({})).toThrow(/REVALIDATION_SECRET/);
  });
});
