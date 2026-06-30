"use client";

import { useState, type ReactElement } from "react";

export interface CardRuntimeInfo {
  readonly cardId: string;
  readonly displayId: string;
  readonly state: "backlog" | "todo" | "dev" | "review" | "done" | "blocked" | "cancelled";
  readonly assignee: string | null;
  readonly modifiedFiles: readonly { readonly path: string; readonly op: "M" | "+" | "-"; readonly lines: string }[];
  readonly planSteps: number;
  readonly auditEvents: number;
}

interface CardRuntimeProps {
  readonly info: CardRuntimeInfo;
}

const STATE_COLOR: Record<CardRuntimeInfo["state"], string> = {
  backlog: "var(--color-text-muted)",
  todo: "var(--color-info)",
  dev: "var(--color-primary)",
  review: "var(--color-warning)",
  done: "var(--color-success)",
  blocked: "var(--color-error)",
  cancelled: "var(--color-text-muted)",
};

function AccordionSection({
  title,
  count,
  defaultOpen,
  children,
}: {
  title: string;
  count: number;
  defaultOpen: boolean;
  children: ReactElement;
}): ReactElement {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ borderBottom: "1px solid var(--color-border)" }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "8px 14px",
          cursor: "pointer",
          background: open ? "rgba(255,255,255,0.02)" : "transparent",
          border: "none",
          width: "100%",
          textAlign: "left",
          color: "var(--color-text-secondary)",
        }}
      >
        <div
          style={{
            fontSize: 10,
            fontWeight: 500,
            letterSpacing: "0.05em",
            textTransform: "uppercase",
            color: "var(--color-text-muted)",
          }}
        >
          {title} · {count}
        </div>
        <div style={{ fontSize: 10, color: "var(--color-text-muted)" }}>{open ? "▾" : "▸"}</div>
      </button>
      {open && <div>{children}</div>}
    </div>
  );
}

export function CardRuntime({ info }: CardRuntimeProps): ReactElement {
  return (
    <div>
      <div style={{ padding: "10px 14px", borderBottom: "1px solid var(--color-border)" }}>
        <div
          style={{
            fontSize: 10,
            fontWeight: 500,
            letterSpacing: "0.05em",
            textTransform: "uppercase",
            color: "var(--color-text-muted)",
            marginBottom: 6,
          }}
        >
          CARD RUNTIME
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, padding: "2px 0" }}>
          <div
            style={{
              fontFamily: "var(--font-jetbrains-mono,monospace)",
              fontSize: 10,
              color: "var(--color-info)",
              minWidth: 56,
            }}
          >
            {info.displayId}
          </div>
          <div
            style={{
              background: `${STATE_COLOR[info.state]}22`,
              color: STATE_COLOR[info.state],
              padding: "1px 6px",
              borderRadius: 2,
              fontFamily: "var(--font-jetbrains-mono,monospace)",
              fontSize: 9,
            }}
          >
            {info.state}
          </div>
          {info.assignee && (
            <div
              style={{
                color: "var(--color-text-muted)",
                fontFamily: "var(--font-jetbrains-mono,monospace)",
                fontSize: 9,
              }}
            >
              {info.assignee}
            </div>
          )}
        </div>
      </div>

      <AccordionSection title="MODIFIED FILES" count={info.modifiedFiles.length} defaultOpen={true}>
        <div style={{ padding: "4px 14px 8px" }}>
          {info.modifiedFiles.map((f) => (
            <div
              key={f.path}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "3px 0",
                fontSize: 11,
              }}
            >
              <span
                style={{
                  fontSize: 10,
                  color:
                    f.op === "M"
                      ? "var(--color-warning)"
                      : f.op === "+"
                      ? "var(--color-success)"
                      : "var(--color-error)",
                  fontFamily: "var(--font-jetbrains-mono,monospace)",
                }}
              >
                {f.op}
              </span>
              <span
                style={{
                  fontFamily: "var(--font-jetbrains-mono,monospace)",
                  fontSize: 10,
                  color: "var(--color-text-primary)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  flex: 1,
                  minWidth: 0,
                }}
                title={f.path}
              >
                {f.path}
              </span>
              <span
                style={{
                  fontFamily: "var(--font-jetbrains-mono,monospace)",
                  fontSize: 9,
                  color: "var(--color-text-muted)",
                  flexShrink: 0,
                }}
              >
                {f.lines}
              </span>
            </div>
          ))}
        </div>
      </AccordionSection>

      <AccordionSection title="PLAN" count={info.planSteps} defaultOpen={false}>
        <div style={{ padding: "8px 14px", fontSize: 10, color: "var(--color-text-muted)", fontFamily: "var(--font-jetbrains-mono,monospace)" }}>
          // see plan panel
        </div>
      </AccordionSection>

      <AccordionSection title="AUDIT" count={info.auditEvents} defaultOpen={false}>
        <div style={{ padding: "8px 14px", fontSize: 10, color: "var(--color-text-muted)", fontFamily: "var(--font-jetbrains-mono,monospace)" }}>
          // see audit panel
        </div>
      </AccordionSection>
    </div>
  );
}
