"use client";

import { useRef, useState, type ReactElement, type KeyboardEvent } from "react";

interface MessageInputProps {
  readonly onSend: (text: string) => void;
  readonly disabled?: boolean;
}

export function MessageInput({ onSend, disabled = false }: MessageInputProps): ReactElement {
  const [text, setText] = useState("");
  const ref = useRef<HTMLTextAreaElement | null>(null);

  function send(): void {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setText("");
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>): void {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  return (
    <div
      style={{
        padding: "12px 20px",
        borderTop: "1px solid var(--color-border)",
        background: "var(--color-bg)",
        display: "flex",
        alignItems: "flex-end",
        gap: 8,
      }}
    >
      <textarea
        ref={ref}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={onKeyDown}
        rows={2}
        placeholder="Reply or /command…"
        disabled={disabled}
        style={{
          flex: 1,
          resize: "none",
          fontFamily: "var(--font-instrument-sans,system-ui,sans-serif)",
          fontSize: 12,
          padding: "6px 8px",
          background: "var(--color-surface)",
          border: "1px solid var(--color-border)",
          borderRadius: 3,
          color: "var(--color-text-primary)",
          minHeight: 36,
        }}
      />
      <button
        type="button"
        onClick={send}
        disabled={disabled || !text.trim()}
        style={{
          background: "var(--color-primary)",
          color: "#FFF",
          padding: "8px 16px",
          fontSize: 12,
          border: "none",
          borderRadius: 3,
          cursor: disabled || !text.trim() ? "not-allowed" : "pointer",
          opacity: disabled || !text.trim() ? 0.5 : 1,
        }}
      >
        Send
      </button>
    </div>
  );
}
