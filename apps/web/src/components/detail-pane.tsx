"use client";

import type { ReactElement } from "react";
import { WorkspacePanel } from "./detail-pane/workspace-panel";
import { AIPanel } from "./detail-pane/ai-panel";
import { CardRuntime, type CardRuntimeInfo } from "./detail-pane/card-runtime";

interface DetailPaneProps {
  readonly workspace: {
    readonly goalSpaceName: string;
    readonly boardName: string;
    readonly userName: string;
    readonly userRole: string;
    readonly runtime: string;
    readonly apiBase: string;
    readonly tokensUsed: number;
    readonly tokensCap: number;
  };
  readonly env: "dev" | "prod";
  readonly card: CardRuntimeInfo | null;
}

export function DetailPane({ workspace, env, card }: DetailPaneProps): ReactElement {
  return (
    <div
      style={{
        borderLeft: "1px solid var(--color-border)",
        background: "var(--color-bg)",
        overflowY: "auto",
        height: "100%",
      }}
    >
      <WorkspacePanel info={workspace} env={env} />
      <AIPanel />
      {card && <CardRuntime info={card} />}
    </div>
  );
}
