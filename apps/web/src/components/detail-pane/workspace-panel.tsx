"use client";

import type { ReactElement } from "react";
import { useTokensStore } from "@/lib/state/tokens-store";

interface WorkspaceInfo {
  readonly goalSpaceName: string;
  readonly boardName: string;
  readonly userName: string;
  readonly userRole: string;
  readonly runtime: string;
  readonly apiBase: string;
  readonly tokensUsed: number;
  readonly tokensCap: number;
}

interface WorkspacePanelProps {
  readonly info: WorkspaceInfo;
  readonly env: "dev" | "prod";
}

export function WorkspacePanel({ info, env }: WorkspacePanelProps): ReactElement {
  const tokensUsed = useTokensStore((s) => s.used);
  const tokensCap = useTokensStore((s) => s.cap);

  // `info.tokensUsed` / `info.tokensCap` remain on the API for forward-compat
  // with non-AppShell call sites (tests). The store is owned by AppShell.
  void info.tokensUsed;
  void info.tokensCap;

  const safeCap = tokensCap > 0 ? tokensCap : 1;
  const pct = Math.min(100, Math.round((tokensUsed / safeCap) * 100));
  const row = (key: string, value: ReactElement | string) => (
    <div style={{ display: "flex", gap: 6 }}>
      <span style={{ color: "var(--color-text-muted)", minWidth: 64 }}>{key}</span>
      <span
        style={{
          color: "var(--color-text-primary)",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          flex: 1,
          minWidth: 0,
        }}
      >
        {value}
      </span>
    </div>
  );
  return (
    <div style={{ padding: "12px 14px", borderBottom: "1px solid var(--color-border)" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 8,
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
          WORKSPACE
        </div>
        <div
          style={{
            fontSize: 9,
            color: "var(--color-text-muted)",
            fontFamily: "var(--font-jetbrains-mono,monospace)",
          }}
        >
          {env}
        </div>
      </div>
      <div
        style={{
          fontFamily: "var(--font-jetbrains-mono,monospace)",
          fontSize: 10,
          lineHeight: 1.7,
        }}
      >
        {row("goal", info.goalSpaceName)}
        {row("board", info.boardName)}
        {row("user", `${info.userName} · ${info.userRole}`)}
        {row("runtime", info.runtime)}
        {row("api", info.apiBase)}
        <div style={{ display: "flex", gap: 6 }}>
          <span style={{ color: "var(--color-text-muted)", minWidth: 64 }}>tokens</span>
          <span style={{ color: "var(--color-text-primary)" }}>
            {tokensUsed.toLocaleString()} / {tokensCap.toLocaleString()}
          </span>
        </div>
        <div
          style={{
            height: 4,
            width: 120,
            background: "var(--color-surface-elevated)",
            borderRadius: 2,
            marginTop: 4,
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${pct}%`,
              background: "var(--color-info)",
              borderRadius: 2,
            }}
          />
        </div>
      </div>
    </div>
  );
}
