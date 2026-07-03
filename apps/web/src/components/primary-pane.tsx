/**
 * PrimaryPane (F4).
 *
 * Client component that routes between the goal-space kanban view and
 * the per-task timeline view. The route decision is driven by the
 * shared `useContextStore` (AppShell pushes the parsed pathname into
 * it on every navigation). When `current.taskId` is set AND the
 * caller provides `taskData`, we render the task timeline; otherwise
 * we render the goal-space kanban (forwarding the F2-03 / F2-04 /
 * F2-07 data the page already loaded server-side).
 */

"use client";

import type { ReactElement } from "react";
import { useContextStore } from "@/lib/state/context-store";
import type {
  GoalSpaceDetailResponse,
  HumanConfirmationResponse,
  NodeBoardResponse,
} from "@/lib/api/types";
import { TaskTimelineView, type TimelineEntry } from "./timeline/task-timeline-view";
import { GoalSpaceKanbanView } from "./primary-pane/goal-space-kanban-view";

type TaskState = "backlog" | "todo" | "dev" | "review" | "done" | "blocked" | "cancelled";

export interface PrimaryPaneTaskData {
  readonly displayId: string;
  readonly title: string;
  readonly state: TaskState;
  readonly assignee: string;
  readonly entries: readonly TimelineEntry[];
}

export interface PrimaryPaneProps {
  readonly goalSpaceId: string;
  // GoalSpace props (forwarded to GoalSpaceKanbanView)
  readonly snapshot: GoalSpaceDetailResponse;
  readonly boards: readonly NodeBoardResponse[];
  readonly confirmations: readonly HumanConfirmationResponse[];
  // Task props (forwarded to TaskTimelineView when current.taskId is set)
  readonly taskId?: string;
  readonly taskData?: PrimaryPaneTaskData;
  readonly onSendTaskMessage: (text: string) => void;
}

export function PrimaryPane({
  snapshot,
  boards,
  confirmations,
  taskId,
  taskData,
  onSendTaskMessage,
}: PrimaryPaneProps): ReactElement {
  const current = useContextStore((s) => s.current);

  if (current.taskId !== null && taskId !== undefined && taskData !== undefined) {
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

  return <GoalSpaceKanbanView snapshot={snapshot} boards={boards} confirmations={confirmations} />;
}
