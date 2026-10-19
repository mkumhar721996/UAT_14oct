import sanitizeHtml from 'sanitize-html';

// Placeholder allowlist of trusted embed hosts; extend once the real Drupal embeds are confirmed.
const TRUSTED_IFRAME_HOSTNAMES = ['www.youtube.com', 'player.vimeo.com'];

// Single policy for all CMS-authored markup: keeps media and styling hooks, drops scripts,
// event handlers, unsafe URL schemes and iframes from untrusted hosts.
export function sanitizeCmsHtml(raw: string): string {
  return sanitizeHtml(raw, {
    allowedTags: [...sanitizeHtml.defaults.allowedTags, 'img', 'iframe'],
    allowedAttributes: {
      ...sanitizeHtml.defaults.allowedAttributes,
      '*': ['class'],
      img: ['src', 'alt', 'width', 'height'],
      iframe: ['src', 'width', 'height', 'title', 'allowfullscreen'],
    },
    allowedSchemes: ['http', 'https', 'mailto', 'tel'],
    allowedSchemesByTag: { img: ['http', 'https'], iframe: ['https'] },
    allowedIframeHostnames: TRUSTED_IFRAME_HOSTNAMES,
    allowProtocolRelative: false,
  });
}
