"use client";

import { useCallback, useEffect, useMemo, useState, type ReactElement } from "react";
import { useRouter } from "next/navigation";
import { useContextStore, parseContextFromPath } from "@/lib/state/context-store";
import {
  WorkspaceSection,
  type GoalSpaceSummary,
  type TaskSummary,
} from "./master-pane/workspace-section";
import { SettingsBar } from "./master-pane/settings-bar";

interface MasterPaneProps {
  readonly goalSpaces: readonly GoalSpaceSummary[];
  readonly tasksByGoalSpace: Readonly<Record<string, readonly TaskSummary[]>>;
  readonly user: { readonly name: string; readonly role: string; readonly workspace: string };
  readonly onOpenSettings: () => void;
}

function storageKey(goalSpaceId: string): string {
  return `keplar.master.expanded.${goalSpaceId}`;
}

const STATE_PRIORITY = [
  "dev",
  "review",
  "todo",
  "backlog",
  "done",
  "blocked",
  "cancelled",
] as const;

export function sortTasksByPriority(
  tasks: readonly TaskSummary[],
): readonly TaskSummary[] {
  const priorityIndex = (state: TaskSummary["state"]): number => {
    const idx = STATE_PRIORITY.indexOf(state);
    return idx === -1 ? STATE_PRIORITY.length : idx;
  };
  return [...tasks].sort((a, b) => {
    const pa = priorityIndex(a.state);
    const pb = priorityIndex(b.state);
    if (pa !== pb) return pa - pb;
    // Same priority: most recently updated first.
    return b.updated_at.localeCompare(a.updated_at);
  });
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
  const pathname = typeof window !== "undefined" ? window.location.pathname : "/goal-spaces";
  // Sync the context store with the URL on every render — `useContextStore.setState` is cheap.
  const urlCtx = parseContextFromPath(pathname);
  if (urlCtx.goalSpaceId !== current.goalSpaceId || urlCtx.taskId !== current.taskId) {
    useContextStore.setState({ current: urlCtx });
  }

  const filteredSpaces: ReadonlyArray<{ gs: GoalSpaceSummary; tasks: readonly TaskSummary[] }> =
    useMemo(() => {
      const baseList = goalSpaces.map((gs) => ({
        gs,
        tasks: sortTasksByPriority(tasksByGoalSpace[gs.id] ?? []),
      }));
      if (!filter.trim()) return baseList;
      const q = filter.toLowerCase();
      return baseList.filter(
        ({ gs, tasks }) => tasks.length > 0 || gs.name.toLowerCase().includes(q),
      );
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
          <MasterPaneSection
            key={gs.id}
            goalSpace={gs}
            tasks={tasks}
            selectedTaskId={current.taskId}
            onSelectTask={(taskId) => router.push(`/goal-spaces/${gs.id}/tasks/${taskId}`)}
            onSelectGoalSpace={(goalSpaceId) => router.push(`/goal-spaces/${goalSpaceId}`)}
          />
        ))}
      </div>

      {/* Bottom: Settings */}
      <SettingsBar user={user} onOpenSettings={onOpenSettings} />
    </div>
  );
}

interface MasterPaneSectionProps {
  readonly goalSpace: GoalSpaceSummary;
  readonly tasks: readonly TaskSummary[];
  readonly selectedTaskId: string | null;
  readonly onSelectTask: (taskId: string) => void;
  readonly onSelectGoalSpace: (goalSpaceId: string) => void;
}

function MasterPaneSection({
  goalSpace,
  tasks,
  selectedTaskId,
  onSelectTask,
  onSelectGoalSpace,
}: MasterPaneSectionProps): ReactElement {
  // Default to expanded for SSR; persist actual state in localStorage once mounted.
  const [collapsed, setCollapsed] = useState<boolean>(false);

  useEffect(() => {
    // Mirror the persisted expanded value into local `collapsed` state.
    const stored = window.localStorage.getItem(storageKey(goalSpace.id));
    if (stored === null) {
      // First visit: persist the default expanded state.
      window.localStorage.setItem(storageKey(goalSpace.id), "true");
      setCollapsed(false);
    } else {
      setCollapsed(stored !== "true");
    }
  }, [goalSpace.id]);

  const onToggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      if (typeof window !== "undefined") {
        window.localStorage.setItem(storageKey(goalSpace.id), String(!next));
      }
      return next;
    });
  }, [goalSpace.id]);

  return (
    <WorkspaceSection
      goalSpace={goalSpace}
      tasks={tasks}
      selectedTaskId={selectedTaskId}
      onSelectTask={onSelectTask}
      onSelectGoalSpace={onSelectGoalSpace}
      collapsed={collapsed}
      onToggleCollapsed={onToggleCollapsed}
    />
  );
}