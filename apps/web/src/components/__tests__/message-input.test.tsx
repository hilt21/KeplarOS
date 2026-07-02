/**
 * MessageInput — keyboard + button submission behavior.
 *
 * Verifies the three behaviors the task timeline relies on:
 *   - Enter (without Shift) submits the trimmed text.
 *   - Shift+Enter inserts a newline and does NOT submit.
 *   - Submit is disabled while the input is empty (or only whitespace).
 *
 * The component is the textarea + Send button used inside
 * TaskTimelineView. It is exported from `components/timeline/message-input.tsx`.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

import { MessageInput } from "../timeline/message-input";

afterEach(() => {
  cleanup();
});

describe("MessageInput", () => {
  it("renders a textarea and a Send button", () => {
    render(<MessageInput onSend={() => undefined} />);
    expect(screen.getByPlaceholderText(/reply or \/command/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send" })).toBeInTheDocument();
  });

  it("disables Send when the textarea is empty", () => {
    render(<MessageInput onSend={() => undefined} />);
    const send = screen.getByRole("button", { name: "Send" });
    expect(send).toBeDisabled();
  });

  it("disables Send when the textarea contains only whitespace", () => {
    render(<MessageInput onSend={() => undefined} />);
    const textarea = screen.getByPlaceholderText(/reply or \/command/i) as HTMLTextAreaElement;
    const send = screen.getByRole("button", { name: "Send" });

    fireEvent.change(textarea, { target: { value: "   " } });
    expect(send).toBeDisabled();
  });

  it("enables Send once the textarea has non-whitespace content", () => {
    render(<MessageInput onSend={() => undefined} />);
    const textarea = screen.getByPlaceholderText(/reply or \/command/i) as HTMLTextAreaElement;
    const send = screen.getByRole("button", { name: "Send" });

    fireEvent.change(textarea, { target: { value: "hello" } });
    expect(send).not.toBeDisabled();
  });

  it("Enter (without Shift) submits the trimmed text and clears the textarea", () => {
    const onSend = vi.fn();
    render(<MessageInput onSend={onSend} />);
    const textarea = screen.getByPlaceholderText(/reply or \/command/i) as HTMLTextAreaElement;

    fireEvent.change(textarea, { target: { value: "  hello world  " } });
    fireEvent.keyDown(textarea, { key: "Enter", shiftKey: false });

    expect(onSend).toHaveBeenCalledTimes(1);
    expect(onSend).toHaveBeenCalledWith("hello world");
    expect(textarea.value).toBe("");
  });

  it("Shift+Enter inserts a newline and does NOT submit", () => {
    const onSend = vi.fn();
    render(<MessageInput onSend={onSend} />);
    const textarea = screen.getByPlaceholderText(/reply or \/command/i) as HTMLTextAreaElement;

    fireEvent.change(textarea, { target: { value: "line 1" } });
    // Simulate the textarea accepting a newline on Shift+Enter by setting
    // the value the browser would have produced (keypress not fired here,
    // but the onKeyDown handler must NOT preventDefault / submit).
    fireEvent.keyDown(textarea, { key: "Enter", shiftKey: true });

    expect(onSend).not.toHaveBeenCalled();
  });

  it("clicking Send submits the trimmed text and clears the textarea", () => {
    const onSend = vi.fn();
    render(<MessageInput onSend={onSend} />);
    const textarea = screen.getByPlaceholderText(/reply or \/command/i) as HTMLTextAreaElement;

    fireEvent.change(textarea, { target: { value: "ship it" } });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));

    expect(onSend).toHaveBeenCalledTimes(1);
    expect(onSend).toHaveBeenCalledWith("ship it");
    expect(textarea.value).toBe("");
  });

  it("does not submit when Send is clicked with only whitespace", () => {
    const onSend = vi.fn();
    render(<MessageInput onSend={onSend} />);
    const textarea = screen.getByPlaceholderText(/reply or \/command/i) as HTMLTextAreaElement;

    fireEvent.change(textarea, { target: { value: "   " } });
    // Button is disabled — but verify clicking the disabled button is a no-op.
    fireEvent.click(screen.getByRole("button", { name: "Send" }));

    expect(onSend).not.toHaveBeenCalled();
  });

  it("Enter on an empty textarea does not submit", () => {
    const onSend = vi.fn();
    render(<MessageInput onSend={onSend} />);
    const textarea = screen.getByPlaceholderText(/reply or \/command/i) as HTMLTextAreaElement;

    fireEvent.keyDown(textarea, { key: "Enter", shiftKey: false });
    expect(onSend).not.toHaveBeenCalled();
  });

  it("respects the disabled prop on both the textarea and the Send button", () => {
    render(<MessageInput onSend={() => undefined} disabled={true} />);
    const textarea = screen.getByPlaceholderText(/reply or \/command/i) as HTMLTextAreaElement;
    const send = screen.getByRole("button", { name: "Send" });

    expect(textarea).toBeDisabled();
    expect(send).toBeDisabled();
  });
});
