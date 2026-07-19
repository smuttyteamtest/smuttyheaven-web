import { afterEach, describe, expect, it, vi } from "vitest";
import {
  api,
  ApiError,
  clearToken,
  getToken,
  qs,
  setToken,
  setUnauthorizedHandler,
} from "./client";

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

function stubFetch(response: Response | Promise<never>) {
  const mock = vi.fn().mockReturnValue(Promise.resolve(response));
  vi.stubGlobal("fetch", mock);
  return mock;
}

afterEach(() => {
  setUnauthorizedHandler(null);
  clearToken();
});

describe("api()", () => {
  it("parses the JSON body and sends no Authorization header when logged out", async () => {
    const mock = stubFetch(jsonResponse({ genres: [] }));

    await expect(api("/api/genres")).resolves.toEqual({ genres: [] });

    const [url, init] = mock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://localhost:3000/api/genres");
    const headers = init.headers as Record<string, string>;
    expect(headers["Content-Type"]).toBe("application/json");
    expect(headers.Authorization).toBeUndefined();
  });

  it("attaches the stored token as a Bearer header", async () => {
    setToken("tok-123");
    const mock = stubFetch(jsonResponse({ user: { id: 1 } }));

    await api("/api/auth/me");

    const [, init] = mock.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>).Authorization).toBe(
      "Bearer tok-123",
    );
  });

  it("throws an ApiError carrying the server's error envelope", async () => {
    stubFetch(jsonResponse({ error: "Not found" }, 404));

    const err = await api("/api/novels/999999").catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).message).toBe("Not found");
    expect((err as ApiError).status).toBe(404);
  });

  it("falls back to a generic message when the error body isn't JSON", async () => {
    stubFetch({
      ok: false,
      status: 500,
      json: async () => {
        throw new Error("not json");
      },
    } as unknown as Response);

    await expect(api("/api/novels")).rejects.toThrow("Request failed (500)");
  });

  it("clears the token and notifies the unauthorized handler on 401", async () => {
    setToken("expired");
    const onUnauthorized = vi.fn();
    setUnauthorizedHandler(onUnauthorized);
    stubFetch(jsonResponse({ error: "Invalid or expired token" }, 401));

    const err = await api("/api/me/history").catch((e: unknown) => e);

    expect(getToken()).toBeNull();
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
    expect((err as ApiError).status).toBe(401);
    expect((err as ApiError).message).toBe("Invalid or expired token");
  });

  it("still clears the token on 401 when no handler is registered", async () => {
    setToken("expired");
    stubFetch(jsonResponse({ error: "Invalid or expired token" }, 401));

    await expect(api("/api/me/history")).rejects.toThrow();
    expect(getToken()).toBeNull();
  });

  it("wraps network failures in a status-0 ApiError", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new TypeError("Failed to fetch")),
    );

    const err = await api("/api/health").catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).status).toBe(0);
    expect((err as ApiError).message).toMatch(/reach the server/i);
  });

  it("resolves the literal null body of an empty progress response", async () => {
    stubFetch(jsonResponse(null));

    await expect(api("/api/me/progress/8757")).resolves.toBeNull();
  });
});

describe("qs()", () => {
  it("serializes defined params and skips undefined/empty ones", () => {
    expect(
      qs({ page: 2, search: "hero", genre: undefined, sort: "" }),
    ).toBe("?page=2&search=hero");
  });

  it("returns an empty string when nothing survives", () => {
    expect(qs({ search: undefined, genre: "" })).toBe("");
  });

  it("URL-encodes values", () => {
    expect(qs({ search: "sword god" })).toBe("?search=sword+god");
  });
});
