import DOMPurify from "dompurify";

/**
 * All novel descriptions and chapter text are raw HTML migrated from
 * WordPress and may contain <iframe> embeds — strip anything active.
 */
export function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    FORBID_TAGS: ["iframe", "script", "style", "form", "input"],
    FORBID_ATTR: ["style"],
  });
}
