import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Cover from "./Cover";

describe("Cover", () => {
  it("renders the image when a cover URL exists", () => {
    render(
      <Cover src="https://example.com/cover.jpg" title="Solo Leveling" seed={1} />,
    );

    const img = screen.getByAltText("Cover of Solo Leveling");
    expect(img).toHaveAttribute("src", "https://example.com/cover.jpg");
  });

  it("renders the gradient fallback when cover is null", () => {
    render(<Cover src={null} title="Solo Leveling" seed={1} />);

    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    const fallback = screen.getByLabelText("Cover of Solo Leveling");
    expect(fallback).toHaveClass("cover-fallback");
    expect(fallback).toHaveTextContent("S"); // initial
  });

  it("swaps to the fallback when the image fails to load", () => {
    render(
      <Cover
        src="https://lightnovelheaven.com/dead-link.jpg"
        title="Godly Empress Doctor"
        seed={236921}
      />,
    );

    fireEvent.error(screen.getByAltText("Cover of Godly Empress Doctor"));

    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Cover of Godly Empress Doctor")).toHaveClass(
      "cover-fallback",
    );
  });

  it("keeps the same fallback gradient for the same seed", () => {
    const { container: a } = render(<Cover src={null} title="A" seed={42} />);
    const { container: b } = render(<Cover src={null} title="B" seed={42} />);

    const bgA = (a.querySelector(".cover-fallback") as HTMLElement).style
      .background;
    const bgB = (b.querySelector(".cover-fallback") as HTMLElement).style
      .background;
    expect(bgA).toBe(bgB);
  });
});
