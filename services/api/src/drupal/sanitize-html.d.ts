// sanitize-html ships no types and @types/sanitize-html is not in the lockfile; declare only what we use.
declare module 'sanitize-html' {
  interface SanitizeOptions {
    allowedTags?: string[];
    allowedAttributes?: Record<string, string[]>;
    allowedSchemes?: string[];
    allowedSchemesByTag?: Record<string, string[]>;
    allowedIframeHostnames?: string[];
    allowProtocolRelative?: boolean;
  }
  interface SanitizeHtml {
    (dirty: string, options?: SanitizeOptions): string;
    defaults: { allowedTags: string[]; allowedAttributes: Record<string, string[]> };
  }
  const sanitizeHtml: SanitizeHtml;
  export default sanitizeHtml;
}
