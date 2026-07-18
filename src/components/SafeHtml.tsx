import { useMemo } from "react";
import { sanitizeHtml } from "../lib/sanitize";

interface SafeHtmlProps {
  html: string;
  className?: string;
}

/** Renders migrated WordPress HTML after DOMPurify sanitization. */
export default function SafeHtml({ html, className }: SafeHtmlProps) {
  const clean = useMemo(() => sanitizeHtml(html), [html]);
  // eslint-disable-next-line react/no-danger
  return <div className={className} dangerouslySetInnerHTML={{ __html: clean }} />;
}
