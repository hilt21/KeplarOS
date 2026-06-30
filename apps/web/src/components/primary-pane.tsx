"use client";

import { usePathname } from "next/navigation";
import type { ReactElement } from "react";
import { GoalSpaceKanbanView } from "./primary-pane/goal-space-kanban-view";
import { TaskTimelineView, type TimelineEntry } from "./timeline/task-timeline-view";

interface PrimaryPaneProps {
  readonly goalSpaceId: string;
  readonly taskId?: string;
  readonly goalSpaceData: {
    readonly goalSpaceId: string;
    readonly goalSpaceName: string;
    readonly boardName: string;
    readonly tasks: ReadonlyArray<{ id: string; displayId: string; title: string; state: "backlog" | "todo" | "dev" | "review" | "done" | "blocked" | "cancelled"; assignee: string | null }>;
    readonly liveCards: ReadonlyArray<{ id: string; displayId: string; title: string; state: "backlog" | "todo" | "dev" | "review" | "done" | "blocked" | "cancelled"; nodeBoardId: string | null }>;
  };
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
  goalSpaceId,
  taskId,
  goalSpaceData,
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

  return (
    <GoalSpaceKanbanView
      goalSpaceId={goalSpaceData.goalSpaceId}
      goalSpaceName={goalSpaceData.goalSpaceName}
      boardName={goalSpaceData.boardName}
      tasks={[...goalSpaceData.tasks]}
      liveCards={[...goalSpaceData.liveCards]}
    />
  );
}
