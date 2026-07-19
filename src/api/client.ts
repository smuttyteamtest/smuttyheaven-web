import type { ApiErrorBody } from "./types";

const API_URL: string =
  (import.meta.env.VITE_API_URL as string | undefined) ??
  "http://localhost:3000";

const TOKEN_KEY = "novvels_token";

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

// AuthContext registers a handler so any 401 anywhere logs the user out.
let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(handler: (() => void) | null): void {
  onUnauthorized = handler;
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken();
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...init.headers,
      },
    });
  } catch {
    throw new ApiError("Can't reach the server — is the API running?", 0);
  }

  if (res.status === 401) {
    clearToken();
    onUnauthorized?.();
  }

  // Every response, success or error, is JSON — including the literal `null`
  // body of GET /api/me/progress/:novelId when there is no progress.
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }

  if (!res.ok) {
    const message =
      (body as ApiErrorBody | null)?.error ?? `Request failed (${res.status})`;
    throw new ApiError(message, res.status);
  }

  return body as T;
}

export function qs(
  params: Record<string, string | number | boolean | undefined>,
): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") search.set(key, String(value));
  }
  const out = search.toString();
  return out ? `?${out}` : "";
}
