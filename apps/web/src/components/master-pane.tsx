"use client";

import { useMemo, useState, type ReactElement } from "react";
import { useRouter } from "next/navigation";
import { useContextStore, parseContextFromPath } from "@/lib/state/context-store";
import { WorkspaceSection, type GoalSpaceSummary, type TaskSummary } from "./master-pane/workspace-section";
import { SettingsBar } from "./master-pane/settings-bar";

interface MasterPaneProps {
  readonly goalSpaces: readonly GoalSpaceSummary[];
  readonly tasksByGoalSpace: Readonly<Record<string, readonly TaskSummary[]>>;
  readonly user: { readonly name: string; readonly role: string; readonly workspace: string };
  readonly onOpenSettings: () => void;
}

export function MasterPane({
  goalSpaces,
  tasksByGoalSpace,
  user,
  onOpenSettings,
}: MasterPaneProps): ReactElement {
  const router = useRouter();
  const [filter, setFilter] = useState("");

  const current = useContextStore((s) => s.current);
  const pathname =
    typeof window !== "undefined" ? window.location.pathname : "/goal-spaces";
  // Sync the context store with the URL on every render — `useContextStore.setState` is cheap.
  const urlCtx = parseContextFromPath(pathname);
  if (urlCtx.goalSpaceId !== current.goalSpaceId || urlCtx.taskId !== current.taskId) {
    useContextStore.setState({ current: urlCtx });
  }

  const filteredSpaces = useMemo(() => {
    if (!filter.trim()) return goalSpaces;
    const q = filter.toLowerCase();
    return goalSpaces
      .map((gs) => {
        const tasks = (tasksByGoalSpace[gs.id] ?? []).filter(
          (t) =>
            t.title.toLowerCase().includes(q) ||
            t.display_id.toLowerCase().includes(q),
        );
        return tasks.length > 0 || gs.name.toLowerCase().includes(q)
          ? { gs, tasks }
          : null;
      })
      .filter((x): x is { gs: GoalSpaceSummary; tasks: TaskSummary[] } => x !== null);
  }, [filter, goalSpaces, tasksByGoalSpace]);

  return (
    <div
      style={{
        borderRight: "1px solid var(--color-border)",
        background: "var(--color-bg)",
        display: "flex",
        flexDirection: "column",
        height: "100%",
      }}
    >
      {/* Top: scrollable */}
      <div style={{ flex: 1, overflowY: "auto" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "10px 12px",
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
            WORKSPACES
          </div>
          <button
            type="button"
            style={{
              background: "transparent",
              border: "1px solid var(--color-border)",
              color: "var(--color-text-secondary)",
              padding: "2px 8px",
              fontSize: 10,
              borderRadius: 4,
              cursor: "pointer",
            }}
          >
            + NEW
          </button>
        </div>
        <div style={{ padding: "4px 12px 8px" }}>
          <input
            type="text"
            placeholder="filter tasks…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            style={{
              width: "100%",
              fontFamily: "var(--font-jetbrains-mono,monospace)",
              fontSize: 10,
              padding: "4px 6px",
              background: "var(--color-surface)",
              border: "1px solid var(--color-border)",
              borderRadius: 3,
              color: "var(--color-text-primary)",
            }}
          />
        </div>
        {filteredSpaces.map(({ gs, tasks }) => (
          <WorkspaceSection
            key={gs.id}
            goalSpace={gs}
            tasks={tasks}
            selectedTaskId={current.taskId}
            onSelectTask={(taskId) =>
              router.push(`/goal-spaces/${gs.id}/tasks/${taskId}`)
            }
            onSelectGoalSpace={(goalSpaceId) =>
              router.push(`/goal-spaces/${goalSpaceId}`)
            }
          />
        ))}
      </div>

      {/* Bottom: Settings */}
      <SettingsBar user={user} onOpenSettings={onOpenSettings} />
    </div>
  );
}
