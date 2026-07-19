import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import type { ChapterSummary } from "../api/types";
import ChapterList from "./ChapterList";

function makeChapters(count: number): ChapterSummary[] {
  const chapters = Array.from({ length: count }, (_, i) => ({
    id: 1000 + i,
    name: `Chapter ${i + 1}`,
    slug: `chapter-${i + 1}`,
    index: i,
    date: "2021-01-20T11:52:22.000Z",
  }));
  // Deterministic shuffle — the component must sort by `index`, not rely on
  // the array order the API happened to return.
  return [...chapters].sort((a, b) => (a.id % 7) - (b.id % 7));
}

function renderList(chapters: ChapterSummary[], currentChapterId?: number) {
  return render(
    <MemoryRouter>
      <ChapterList
        novelId={8757}
        chapters={chapters}
        currentChapterId={currentChapterId}
      />
    </MemoryRouter>,
  );
}

const rows = () => screen.getAllByRole("listitem");

describe("ChapterList", () => {
  it("windows to 100 chapters per page, sorted by index", () => {
    renderList(makeChapters(250));

    const items = rows();
    expect(items).toHaveLength(100);
    expect(items[0]).toHaveTextContent("Chapter 1");
    expect(items[99]).toHaveTextContent("Chapter 100");
    expect(screen.getByText("(250)")).toBeInTheDocument();
  });

  it("offers page ranges and jumps to the selected window", async () => {
    const user = userEvent.setup();
    renderList(makeChapters(250));

    const select = screen.getByLabelText("Chapter page");
    expect(
      within(select).getAllByRole("option").map((o) => o.textContent),
    ).toEqual(["1–100", "101–200", "201–250"]);

    await user.selectOptions(select, "3");
    const items = rows();
    expect(items).toHaveLength(50);
    expect(items[0]).toHaveTextContent("Chapter 201");
  });

  it("hides the page selector when everything fits on one page", () => {
    renderList(makeChapters(60));
    expect(screen.queryByLabelText("Chapter page")).not.toBeInTheDocument();
  });

  it("filters by name (case-insensitive) and resets to page 1", async () => {
    const user = userEvent.setup();
    renderList(makeChapters(250));

    const select = screen.getByLabelText("Chapter page");
    await user.selectOptions(select, "3");

    await user.type(
      screen.getByLabelText("Filter chapters by name"),
      "chapter 250",
    );
    const items = rows();
    expect(items).toHaveLength(1);
    expect(items[0]).toHaveTextContent("Chapter 250");
  });

  it("shows an empty state when nothing matches the filter", async () => {
    const user = userEvent.setup();
    renderList(makeChapters(5));

    await user.type(
      screen.getByLabelText("Filter chapters by name"),
      "no such chapter",
    );
    expect(screen.getByText("No chapters match.")).toBeInTheDocument();
    expect(screen.queryByRole("listitem")).not.toBeInTheDocument();
  });

  it("toggles between oldest-first and newest-first", async () => {
    const user = userEvent.setup();
    renderList(makeChapters(250));

    await user.click(screen.getByRole("button", { name: /oldest first/i }));
    expect(rows()[0]).toHaveTextContent("Chapter 250");

    await user.click(screen.getByRole("button", { name: /newest first/i }));
    expect(rows()[0]).toHaveTextContent("Chapter 1");
  });

  it("marks the chapter the user is currently reading", () => {
    renderList(makeChapters(10), 1004); // id of "Chapter 5"

    const current = screen.getByText("Chapter 5").closest("li")!;
    expect(within(current).getByText("Reading")).toBeInTheDocument();
    expect(current).toHaveClass("is-current");
  });

  it("links each row to the reader route", () => {
    renderList(makeChapters(3));

    const link = within(rows()[0]).getByRole("link");
    expect(link).toHaveAttribute("href", "/novel/8757/read/1000");
  });
});
