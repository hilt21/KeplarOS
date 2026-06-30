"use client";

import type { ReactElement } from "react";

interface SettingsBarProps {
  readonly user: {
    readonly name: string;
    readonly role: string;
    readonly workspace: string;
  };
  readonly onOpenSettings: () => void;
}

export function SettingsBar({ user, onOpenSettings }: SettingsBarProps): ReactElement {
  const initial = user.name.charAt(0).toUpperCase();
  return (
    <div
      style={{
        borderTop: "1px solid var(--color-border)",
        padding: "8px 12px",
        display: "flex",
        alignItems: "center",
        gap: 8,
        cursor: "pointer",
      }}
      onClick={onOpenSettings}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpenSettings();
        }
      }}
    >
      <div
        aria-hidden
        style={{
          width: 18,
          height: 18,
          background: "rgba(14,165,233,0.15)",
          borderRadius: "50%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 9,
          color: "var(--color-primary)",
          fontWeight: 600,
          flexShrink: 0,
        }}
      >
        {initial}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 11,
            color: "var(--color-text-primary)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {user.name}
        </div>
        <div
          style={{
            fontSize: 9,
            color: "var(--color-text-muted)",
            fontFamily: "var(--font-jetbrains-mono,monospace)",
          }}
        >
          {user.role} · {user.workspace}
        </div>
      </div>
      <div
        aria-label="Open settings"
        style={{ fontSize: 12, color: "var(--color-text-muted)" }}
      >
        ⚙
      </div>
    </div>
  );
}
