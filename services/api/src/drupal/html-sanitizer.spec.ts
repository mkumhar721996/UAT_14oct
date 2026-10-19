import { describe, expect, it } from 'vitest';
import { sanitizeCmsHtml } from './html-sanitizer';

describe('sanitizeCmsHtml', () => {
  it('keeps images, class attributes and trusted iframes', () => {
    const out = sanitizeCmsHtml(
      '<div class="promo"><img src="https://cdn.test/a.jpg" alt="A"><iframe src="https://www.youtube.com/embed/x"></iframe></div>',
    );
    expect(out).toContain('class="promo"');
    expect(out).toContain('<img src="https://cdn.test/a.jpg" alt="A" />');
    expect(out).toContain('youtube.com/embed/x');
  });

  it('drops scripts, handlers, javascript: urls and untrusted iframes', () => {
    const out = sanitizeCmsHtml(
      '<script>x</script><img src="https://cdn.test/a.jpg" onerror="x()"><a href="javascript:x()">l</a><iframe src="https://evil.test/e"></iframe>',
    );
    expect(out).not.toMatch(/script|onerror|javascript:|evil\.test/);
  });
});
