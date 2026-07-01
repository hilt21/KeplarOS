"use client";

import type { ReactElement } from "react";

export type TimelineVariant =
  | "user"
  | "agent-thinking"
  | "agent-streaming"
  | "tool"
  | "confirmation"
  | "system";

interface CommonProps {
  readonly variant: TimelineVariant;
  readonly body: string;
  readonly meta?: string;
}

interface ConfirmationProps extends CommonProps {
  readonly variant: "confirmation";
  readonly onApprove: () => void;
  readonly onReject: () => void;
  readonly onComment?: () => void;
}

type Props = CommonProps | ConfirmationProps;

const iconFor = (
  variant: TimelineVariant,
): { glyph: string; label: string; bg: string; border?: string } => {
  switch (variant) {
    case "user":
      return { glyph: "", label: "", bg: "transparent" };
    case "agent-thinking":
      return { glyph: "AI", label: "Agent", bg: "var(--color-info-bg)" };
    case "agent-streaming":
      return {
        glyph: "AI",
        label: "Agent streaming",
        bg: "var(--color-info-bg)",
        border: "1px solid var(--color-info-border)",
      };
    case "tool":
      return { glyph: "⚙", label: "Tool", bg: "var(--color-surface)" };
    case "confirmation":
      return { glyph: "!", label: "Confirmation required", bg: "var(--color-warning-bg)" };
    case "system":
      return { glyph: "", label: "", bg: "transparent" };
  }
};

export function TimelineMessage(props: Props): ReactElement {
  const { variant, body, meta } = props;
  const icon = iconFor(variant);

  if (variant === "user") {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          marginBottom: 14,
          animation: "var(--motion-message-enter)",
        }}
      >
        <div
          style={{
            maxWidth: "80%",
            background: "var(--color-surface-elevated)",
            border: "1px solid var(--color-border)",
            padding: "8px 12px",
            borderRadius: 4,
          }}
        >
          {meta && (
            <div
              style={{
                fontSize: 10,
                color: "var(--color-text-muted)",
                marginBottom: 2,
                fontFamily: "var(--font-jetbrains-mono,monospace)",
              }}
            >
              {meta}
            </div>
          )}
          <div style={{ fontSize: 12, color: "var(--color-text-secondary)", lineHeight: 1.5 }}>
            {body}
          </div>
        </div>
      </div>
    );
  }

  if (variant === "system") {
    return (
      <div style={{ marginBottom: 14, animation: "var(--motion-message-enter)" }}>
        <div
          style={{
            fontSize: 11,
            color: "var(--color-text-muted)",
            fontStyle: "italic",
            lineHeight: 1.5,
          }}
        >
          {body}
        </div>
      </div>
    );
  }

  if (variant === "confirmation" && "onApprove" in props) {
    return (
      <div
        style={{
          display: "flex",
          gap: 8,
          marginBottom: 14,
          animation: "var(--motion-message-enter)",
        }}
      >
        <div
          aria-label={icon.label}
          style={{
            width: 20,
            height: 20,
            background: icon.bg,
            border: "1px solid var(--color-warning-border)",
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 9,
            color: "var(--color-warning)",
            flexShrink: 0,
          }}
        >
          {icon.glyph}
        </div>
        <div
          style={{
            flex: 1,
            minWidth: 0,
            background: "var(--color-warning-bg)",
            border: "1px solid var(--color-warning-border)",
            padding: "10px 12px",
            borderLeft: "3px solid var(--color-warning)",
            borderRadius: 4,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 10,
              color: "var(--color-warning)",
              fontFamily: "var(--font-jetbrains-mono,monospace)",
              marginBottom: 6,
            }}
          >
            HUMAN CONFIRMATION REQUIRED
          </div>
          <div style={{ fontSize: 12, color: "var(--color-text-primary)", marginBottom: 8 }}>
            {body}
          </div>
          {meta && (
            <div
              style={{
                fontFamily: "var(--font-jetbrains-mono,monospace)",
                fontSize: 10,
                color: "var(--color-text-muted)",
                marginBottom: 8,
              }}
            >
              {meta}
            </div>
          )}
          <div style={{ display: "flex", gap: 6 }}>
            <button
              type="button"
              onClick={props.onApprove}
              style={{
                background: "var(--color-success)",
                color: "#FFF",
                padding: "4px 12px",
                fontSize: 11,
                border: "none",
                borderRadius: 3,
                cursor: "pointer",
              }}
            >
              Approve
            </button>
            <button
              type="button"
              onClick={props.onReject}
              style={{
                background: "transparent",
                border: "1px solid var(--color-border)",
                color: "var(--color-text-secondary)",
                padding: "4px 12px",
                fontSize: 11,
                borderRadius: 3,
                cursor: "pointer",
              }}
            >
              Reject
            </button>
          </div>
        </div>
      </div>
    );
  }

  // agent-thinking / agent-streaming / tool
  return (
    <div
      style={{
        display: "flex",
        gap: 8,
        marginBottom: 14,
        animation: "var(--motion-message-enter)",
      }}
    >
      <div
        aria-label={icon.label}
        style={{
          width: 20,
          height: 20,
          background: icon.bg,
          border: icon.border ?? "1px solid var(--color-border)",
          borderRadius: "50%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 9,
          color: variant === "tool" ? "var(--color-text-muted)" : "var(--color-info)",
          flexShrink: 0,
          animation: variant === "agent-streaming" ? "var(--motion-pulse)" : undefined,
        }}
      >
        {icon.glyph}
      </div>
      <div
        style={{
          flex: 1,
          minWidth: 0,
          background: variant === "tool" ? "var(--color-surface)" : "transparent",
          border: variant === "tool" ? "1px solid var(--color-border)" : "none",
          padding: variant === "tool" ? "8px 10px" : 0,
          borderRadius: 4,
          fontFamily: variant === "tool" ? "var(--font-jetbrains-mono,monospace)" : undefined,
          fontSize: variant === "tool" ? 10 : 12,
          lineHeight: 1.5,
          color: "var(--color-text-secondary)",
        }}
      >
        {body}
      </div>
    </div>
  );
}
