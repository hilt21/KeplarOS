"use client";

import { usePathname } from "next/navigation";
import type { ReactElement } from "react";
import { TaskTimelineView, type TimelineEntry } from "./timeline/task-timeline-view";

interface PrimaryPaneProps {
  readonly goalSpaceId: string;
  readonly taskId?: string;
  readonly taskData?: {
    readonly displayId: string;
    readonly title: string;
    readonly state: "backlog" | "todo" | "dev" | "review" | "done" | "blocked" | "cancelled";
    readonly assignee: string;
    readonly entries: readonly TimelineEntry[];
  };
  readonly onSendTaskMessage: (text: string) => void;
}

export function PrimaryPane({
  taskId,
  taskData,
  onSendTaskMessage,
}: PrimaryPaneProps): ReactElement {
  usePathname();

  if (taskId && taskData) {
    return (
      <TaskTimelineView
        cardId={taskId}
        displayId={taskData.displayId}
        title={taskData.title}
        state={taskData.state}
        assignee={taskData.assignee}
        entries={taskData.entries}
        onSend={onSendTaskMessage}
      />
    );
  }

  // The Goal Space view is currently rendered by the existing
  // `(app)/goal-spaces/[id]/page.tsx` which uses GoalSpaceShell
  // directly with its own props (snapshot / boards / confirmations).
  // A future refactor wires the AppShell to route-switch through
  // PrimaryPane and threads the F2-05 / F2-08 data here.
  return (
    <div style={{ padding: 16, color: "var(--color-text-muted)" }}>
      Primary pane: Goal Space view is rendered by the existing page
      directly. The persistent shell integration is a follow-up.
    </div>
  );
}
