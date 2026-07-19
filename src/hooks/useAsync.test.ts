import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useAsync } from "./useAsync";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("useAsync", () => {
  it("starts loading and lands on data", async () => {
    const { result } = renderHook(() => useAsync(() => Promise.resolve(42), []));

    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toBe(42);
    expect(result.current.error).toBeUndefined();
  });

  it("captures the rejection message as error", async () => {
    const { result } = renderHook(() =>
      useAsync(() => Promise.reject(new Error("Not found")), []),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe("Not found");
    expect(result.current.data).toBeUndefined();
  });

  it("uses a generic message for non-Error rejections", async () => {
    const { result } = renderHook(() =>
      useAsync(() => Promise.reject("boom"), []),
    );

    await waitFor(() =>
      expect(result.current.error).toBe("Something went wrong"),
    );
  });

  it("skips the fetch entirely when enabled is false", async () => {
    const fn = vi.fn().mockResolvedValue(1);
    const { result } = renderHook(() => useAsync(fn, [], false));

    expect(result.current.loading).toBe(false);
    expect(result.current.data).toBeUndefined();
    expect(fn).not.toHaveBeenCalled();
  });

  it("ignores a stale result when deps change mid-flight", async () => {
    const first = deferred<string>();
    const second = deferred<string>();
    const responses = [first.promise, second.promise];
    const fn = vi.fn(() => responses.shift()!);

    const { result, rerender } = renderHook(
      ({ novelId }) => useAsync(fn, [novelId]),
      { initialProps: { novelId: 1 } },
    );

    rerender({ novelId: 2 }); // first request is now stale
    second.resolve("novel-2");
    await waitFor(() => expect(result.current.data).toBe("novel-2"));

    first.resolve("novel-1"); // arrives late — must not clobber
    await new Promise((r) => setTimeout(r, 0));
    expect(result.current.data).toBe("novel-2");
  });

  it("re-runs the function when reload() is called", async () => {
    let calls = 0;
    const { result } = renderHook(() =>
      useAsync(() => Promise.resolve(++calls), []),
    );

    await waitFor(() => expect(result.current.data).toBe(1));
    result.current.reload();
    await waitFor(() => expect(result.current.data).toBe(2));
  });
});
