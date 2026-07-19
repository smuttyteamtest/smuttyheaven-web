import { useEffect } from "react";

const SITE = "Novvels";
const DEFAULT_TITLE = "Novvels — Read web novels";
// Keep in sync with the defaults in index.html.
const DEFAULT_DESCRIPTION =
  "Novvels — read web novels. Discover, read and collect hundreds of novels.";

function setMeta(attr: "name" | "property", key: string, content: string) {
  let tag = document.head.querySelector<HTMLMetaElement>(
    `meta[${attr}="${key}"]`,
  );
  if (!tag) {
    tag = document.createElement("meta");
    tag.setAttribute(attr, key);
    document.head.append(tag);
  }
  tag.setAttribute("content", content);
}

export interface PageMeta {
  /** Rendered as "<title> — Novvels". Omit for the site default. */
  title?: string;
  /** Plain text only — run HTML through htmlToText first. */
  description?: string;
}

/**
 * Per-page document.title + description/OG tags. Client-side only: enough
 * for the tab bar, history, and crawlers that execute JS; link unfurlers see
 * the index.html defaults (no SSR/prerender — the trade-off is documented in
 * DEPLOY.md).
 */
export function usePageMeta({ title, description }: PageMeta = {}): void {
  useEffect(() => {
    const fullTitle = title ? `${title} — ${SITE}` : DEFAULT_TITLE;
    document.title = fullTitle;
    setMeta("name", "description", description ?? DEFAULT_DESCRIPTION);
    setMeta("property", "og:title", fullTitle);
    setMeta("property", "og:description", description ?? DEFAULT_DESCRIPTION);
    setMeta("property", "og:url", window.location.href);
  }, [title, description]);
}
