import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { usePageMeta } from "./usePageMeta";

const meta = (selector: string) =>
  document.head.querySelector(`meta[${selector}]`)?.getAttribute("content");

describe("usePageMeta", () => {
  it("sets the title with the site suffix and mirrors it into og:title", () => {
    renderHook(() => usePageMeta({ title: "Solo Leveling" }));
    expect(document.title).toBe("Solo Leveling — SmuttyHeaven");
    expect(meta('property="og:title"')).toBe("Solo Leveling — SmuttyHeaven");
  });

  it("falls back to the site defaults without arguments", () => {
    renderHook(() => usePageMeta());
    expect(document.title).toBe("SmuttyHeaven — Read web novels");
    expect(meta('name="description"')).toContain("read web novels");
  });

  it("sets a custom description on both description tags", () => {
    renderHook(() => usePageMeta({ title: "A", description: "A synopsis." }));
    expect(meta('name="description"')).toBe("A synopsis.");
    expect(meta('property="og:description"')).toBe("A synopsis.");
  });

  it("updates existing tags in place instead of duplicating them", () => {
    renderHook(() => usePageMeta({ title: "First", description: "One" }));
    renderHook(() => usePageMeta({ title: "Second", description: "Two" }));
    expect(
      document.head.querySelectorAll('meta[name="description"]'),
    ).toHaveLength(1);
    expect(meta('name="description"')).toBe("Two");
    expect(document.title).toBe("Second — SmuttyHeaven");
  });
});
