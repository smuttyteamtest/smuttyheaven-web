/** ISO UTC timestamp → local, human-readable date. */
export function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/** 321115 → "321,115" (locale-aware). */
export function formatNumber(n: number): string {
  return n.toLocaleString();
}

/** Reader URL. Slug kept for pretty URLs; lookups are by numeric id. */
export function novelPath(id: number, slug?: string): string {
  return slug ? `/novel/${id}/${slug}` : `/novel/${id}`;
}

export function readerPath(novelId: number, chapterId: number): string {
  return `/novel/${novelId}/read/${chapterId}`;
}

/**
 * Migrated chapter HTML opens with the title and translator/editor credits
 * inline, often with a cramped colon ("Translator:Hellscythe_"). Put a space on
 * each side of the colon — but ONLY on the leading <strong> title and the known
 * credit labels, never on body colons (times like "10:30", "System:" lines,
 * dialogue). Done at render time so the source text is left untouched.
 */
export function formatChapterHtml(html: string): string {
  return html
    // Leading <strong>…</strong> chapter heading: space its colon(s).
    .replace(
      /^(\s*)<strong>(.*?)<\/strong>/i,
      (_m, lead, inner) => `${lead}<strong>${inner.replace(/\s*:\s*/g, " : ")}</strong>`,
    )
    // Credit lines: "Translator:X" or "Translator: X" → "Translator : X".
    .replace(/\b(Translator|Editor|Proofreader|TLC)\s*:\s*/gi, "$1 : ");
}
