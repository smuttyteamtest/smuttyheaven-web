import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider, useToast } from "./Toasts";

function Trigger({ message }: { message: string }) {
  const toast = useToast();
  return <button onClick={() => toast(message)}>fire</button>;
}

function renderWithToasts(message = "Couldn't save your reading progress") {
  render(
    <ToastProvider>
      <Trigger message={message} />
    </ToastProvider>,
  );
  return message;
}

describe("Toasts", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows a toast in an aria-live region", () => {
    const message = renderWithToasts();
    fireEvent.click(screen.getByText("fire"));
    const stack = screen.getByRole("status");
    expect(stack).toHaveAttribute("aria-live", "polite");
    expect(screen.getByText(message)).toBeInTheDocument();
  });

  it("does not stack identical messages", () => {
    const message = renderWithToasts();
    fireEvent.click(screen.getByText("fire"));
    fireEvent.click(screen.getByText("fire"));
    expect(screen.getAllByText(message)).toHaveLength(1);
  });

  it("auto-dismisses after the timeout", () => {
    const message = renderWithToasts();
    fireEvent.click(screen.getByText("fire"));
    expect(screen.getByText(message)).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(5000));
    expect(screen.queryByText(message)).not.toBeInTheDocument();
  });

  it("dismisses on the close button", () => {
    const message = renderWithToasts();
    fireEvent.click(screen.getByText("fire"));
    fireEvent.click(screen.getByLabelText("Dismiss notification"));
    expect(screen.queryByText(message)).not.toBeInTheDocument();
  });

  it("can show the same message again after dismissal", () => {
    const message = renderWithToasts();
    fireEvent.click(screen.getByText("fire"));
    act(() => vi.advanceTimersByTime(5000));
    fireEvent.click(screen.getByText("fire"));
    expect(screen.getByText(message)).toBeInTheDocument();
  });
});
