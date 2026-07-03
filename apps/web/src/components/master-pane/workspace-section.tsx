"use client";

import type { ReactElement } from "react";

export interface TaskSummary {
  readonly id: string;
  readonly display_id: string;
  readonly title: string;
  readonly state: "backlog" | "todo" | "dev" | "review" | "done" | "blocked" | "cancelled";
  readonly updated_at: string;
}

export interface GoalSpaceSummary {
  readonly id: string;
  readonly name: string;
}

interface WorkspaceSectionProps {
  readonly goalSpace: GoalSpaceSummary;
  readonly tasks: readonly TaskSummary[];
  readonly selectedTaskId: string | null;
  readonly onSelectTask: (taskId: string) => void;
  readonly onSelectGoalSpace: (goalSpaceId: string) => void;
  readonly collapsed: boolean;
  readonly onToggleCollapsed: () => void;
}

const STATE_COLOR: Record<TaskSummary["state"], string> = {
  backlog: "var(--color-text-muted)",
  todo: "var(--color-info)",
  dev: "var(--color-primary)",
  review: "var(--color-warning)",
  done: "var(--color-success)",
  blocked: "var(--color-error)",
  cancelled: "var(--color-text-muted)",
};

function firstLetterIcon(name: string): string {
  return (name.trim().charAt(0) || "?").toUpperCase();
}

export function WorkspaceSection({
  goalSpace,
  tasks,
  selectedTaskId,
  onSelectTask,
  onSelectGoalSpace,
  collapsed,
  onToggleCollapsed,
}: WorkspaceSectionProps): ReactElement {
  return (
    <div>
      {/* Section header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "8px 12px 4px",
          cursor: "pointer",
        }}
      >
        <button
          type="button"
          aria-label={collapsed ? "Expand" : "Collapse"}
          aria-expanded={!collapsed}
          aria-controls={`workspace-section-${goalSpace.id}-tasks`}
          onClick={(e) => {
            e.stopPropagation();
            onToggleCollapsed();
          }}
          style={{
            background: "transparent",
            border: "none",
            color: "var(--color-text-muted)",
            fontSize: 12,
            padding: 0,
            cursor: "pointer",
          }}
        >
          {collapsed ? "▸" : "▾"}
        </button>
        <div
          aria-hidden
          style={{
            width: 16,
            height: 16,
            background: "var(--color-info-bg)",
            border: "1px solid var(--color-info-border)",
            borderRadius: 3,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 8,
            color: "var(--color-primary)",
            fontWeight: 600,
            flexShrink: 0,
          }}
        >
          {firstLetterIcon(goalSpace.name)}
        </div>
        <div
          onClick={() => onSelectGoalSpace(goalSpace.id)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onSelectGoalSpace(goalSpace.id);
            }
          }}
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: "var(--color-text-primary)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            flex: 1,
            minWidth: 0,
            cursor: "pointer",
          }}
          title={goalSpace.name}
        >
          {goalSpace.name}
        </div>
        <div
          style={{
            fontFamily: "var(--font-jetbrains-mono,monospace)",
            fontSize: 9,
            color: "var(--color-text-muted)",
          }}
        >
          {tasks.length}
        </div>
      </div>

      {/* Tasks */}
      {!collapsed && (
        <div id={`workspace-section-${goalSpace.id}-tasks`}>
          {tasks.map((task) => {
            const isSelected = task.id === selectedTaskId;
            return (
              <div
                key={task.id}
                role="button"
                tabIndex={0}
                aria-current={isSelected ? "true" : undefined}
                data-testid="task-row"
                data-task-id={task.id}
                onClick={() => onSelectTask(task.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelectTask(task.id);
                  }
                }}
                style={{
                  padding: isSelected ? "6px 12px 6px 28px" : "4px 12px 4px 28px",
                  fontSize: 12,
                  color: isSelected ? "var(--color-text-primary)" : "var(--color-text-muted)",
                  background: isSelected ? "var(--color-info-bg)" : "transparent",
                  borderLeft: isSelected
                    ? "2px solid var(--color-primary)"
                    : "2px solid transparent",
                  cursor: "pointer",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <span
                    aria-hidden
                    style={{
                      width: 5,
                      height: 5,
                      background: STATE_COLOR[task.state],
                      borderRadius: "50%",
                      flexShrink: 0,
                    }}
                  />
                  <span
                    style={{
                      fontFamily: "var(--font-jetbrains-mono,monospace)",
                      fontSize: 10,
                      color: "var(--color-text-muted)",
                      minWidth: 56,
                    }}
                  >
                    {task.display_id}
                  </span>
                  <span
                    style={{
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      flex: 1,
                      minWidth: 0,
                      fontWeight: isSelected ? 500 : 400,
                    }}
                  >
                    {task.title}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
