/**
 * The API's JSON body parser rejects requests over ~100 KB (surfaces as a
 * 500 — handoff §4.9), so chapter uploads are size-checked client-side with
 * some headroom.
 */
export const BODY_BYTE_LIMIT = 100 * 1024;
export const BODY_BYTE_SAFE = 95 * 1024;

export function jsonBytes(body: unknown): number {
  return new TextEncoder().encode(JSON.stringify(body)).length;
}

export function formatKb(bytes: number): string {
  return `${(bytes / 1024).toFixed(1)} KB`;
}
