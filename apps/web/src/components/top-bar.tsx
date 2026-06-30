"use client";

import type { ReactElement } from "react";
import { useRouter } from "next/navigation";

export interface TopBarSegment {
  readonly label: string;
  readonly href?: string;
}

interface TopBarProps {
  readonly segments: readonly TopBarSegment[];
  readonly tokensUsed: number;
  readonly tokensCap: number;
  readonly onOpenCommandPalette: () => void;
}

function formatK(n: number): string {
  return `${(n / 1000).toFixed(1)}k`;
}

export function TopBar({
  segments,
  tokensUsed,
  tokensCap,
  onOpenCommandPalette,
}: TopBarProps): ReactElement {
  const router = useRouter();
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "10px 16px",
        borderBottom: "1px solid var(--color-border)",
        background: "var(--color-bg)",
        height: 48,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 500,
            letterSpacing: "0.05em",
            textTransform: "uppercase",
            color: "var(--color-text-muted)",
          }}
        >
          KEPLAR
        </div>
        {segments.map((seg, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ fontSize: 11, color: "var(--color-border)" }}>/</div>
            {seg.href ? (
              <a
                role="link"
                onClick={(e) => {
                  e.preventDefault();
                  router.push(seg.href!);
                }}
                href={seg.href}
                style={{
                  fontSize: 13,
                  color: "var(--color-text-secondary)",
                  padding: "2px 6px",
                  borderRadius: 3,
                  cursor: "pointer",
                  textDecoration: "none",
                }}
              >
                {seg.label}
              </a>
            ) : (
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: "var(--color-text-primary)",
                  padding: "2px 6px",
                }}
              >
                {seg.label}
              </div>
            )}
          </div>
        ))}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div
          style={{
            fontFamily: "var(--font-jetbrains-mono,monospace)",
            fontSize: 10,
            color: "var(--color-text-muted)",
          }}
        >
          {formatK(tokensUsed)}
        </div>
        <button
          type="button"
          aria-label="Open command palette"
          onClick={onOpenCommandPalette}
          style={{
            background: "transparent",
            border: "1px solid var(--color-border)",
            color: "var(--color-text-secondary)",
            padding: "4px 10px",
            fontSize: 11,
            borderRadius: 4,
            cursor: "pointer",
          }}
        >
          CMD K
        </button>
      </div>
    </div>
  );
}
