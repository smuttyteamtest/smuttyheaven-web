import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useDebounce } from "./useDebounce";

describe("useDebounce", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns the initial value immediately", () => {
    const { result } = renderHook(() => useDebounce("sword", 400));
    expect(result.current).toBe("sword");
  });

  it("only emits the new value after the delay", () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, 400),
      { initialProps: { value: "s" } },
    );

    rerender({ value: "sw" });
    expect(result.current).toBe("s");

    act(() => vi.advanceTimersByTime(399));
    expect(result.current).toBe("s");

    act(() => vi.advanceTimersByTime(1));
    expect(result.current).toBe("sw");
  });

  it("restarts the timer on every keystroke (trailing debounce)", () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, 400),
      { initialProps: { value: "s" } },
    );

    rerender({ value: "sw" });
    act(() => vi.advanceTimersByTime(300));
    rerender({ value: "swo" });
    act(() => vi.advanceTimersByTime(300));
    expect(result.current).toBe("s"); // no quiet window of 400ms yet

    act(() => vi.advanceTimersByTime(100));
    expect(result.current).toBe("swo");
  });
});
