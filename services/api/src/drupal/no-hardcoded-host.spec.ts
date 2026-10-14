import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('fetch layer source', () => {
  it('AC5: contains no literal host or credential value', () => {
    const files = readdirSync(__dirname).filter((f) => f.endsWith('.ts') && !f.endsWith('.spec.ts'));
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const content = readFileSync(join(__dirname, file), 'utf8');
      expect(content, file).not.toMatch(/https?:\/\/[^'"`\s]+/);
      expect(content, file).not.toContain('test-token');
      expect(content, file).not.toContain('docksal');
    }
  });
});
