// sanitize-html ships no types and @types/sanitize-html is not in the lockfile; declare only what we use.
declare module 'sanitize-html' {
  export default function sanitizeHtml(dirty: string): string;
}
