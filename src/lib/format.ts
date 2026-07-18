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
