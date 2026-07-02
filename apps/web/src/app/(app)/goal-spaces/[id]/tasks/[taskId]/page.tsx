/**
 * /goal-spaces/[id]/tasks/[taskId] (F4 + F5).
 *
 * Server component: renders `<PrimaryPane>` with the goal-space data
 * the page loaded server-side and the per-task data F5 populates.
 * PrimaryPane uses the shared `useContextStore` (populated by AppShell
 * from the pathname) to decide whether to show `<TaskTimelineView>` or
 * fall through to `<GoalSpaceKanbanView>`.
 *
 * F5 wiring: fetches `getCardDetailService` for the card header fields
 * and `getCardTimelineReplayService` for the initial timeline entries
 * (newest-first replay, single batched query — see service for details).
 * The card detail service already enforces `canReadCard`; the replay
 * service re-uses the same load to avoid duplicating authorization.
 */

import { cookies } from "next/headers";
import { notFound } from "next/navigation";

import { ApiRequestError } from "@/lib/api/errors";
import { getSessionActor } from "@/lib/auth/session";
import { getCardDetailService, getCardTimelineReplayService } from "@/lib/services/cards";
import { getGoalSpaceDetailService } from "@/lib/services/goal-spaces";
import { listNodeBoardsForGoalSpaceService } from "@/lib/services/node-boards";
import { listConfirmationsService } from "@/lib/services/confirmations";
import { PrimaryPane } from "@/components/primary-pane";

interface PageProps {
  params: Promise<{ id: string; taskId: string }>;
}

export default async function TaskPage({ params }: PageProps) {
  const { id, taskId } = await params;
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("keplar_session");
  const cookieHeader = sessionCookie ? `keplar_session=${sessionCookie.value}` : "";
  const internalRequest = new Request(`http://internal/goal-spaces/${id}/tasks/${taskId}`, {
    headers: cookieHeader ? { cookie: cookieHeader } : {},
  });
  const actor = await getSessionActor(internalRequest);
  if (actor === null) notFound();

  let snapshot;
  try {
    snapshot = getGoalSpaceDetailService(id, actor);
  } catch (err) {
    if (err instanceof ApiRequestError && err.code === "NOT_FOUND") {
      notFound();
    }
    throw err;
  }

  const boards = listNodeBoardsForGoalSpaceService(id, actor);
  const confirmationsResult = listConfirmationsService(actor, {
    status: "pending",
    page: 1,
    limit: 50,
  });

  // F5: fetch the card header + initial replay (newest 50 events for
  // this card). `getCardDetailService` throws NOT_FOUND when the card
  // is missing or soft-deleted; redirect to the parent goal space so
  // the persistent shell can recover cleanly.
  let taskData;
  try {
    const card = getCardDetailService(taskId, actor);
    const entries = getCardTimelineReplayService(taskId, actor, 50);
    taskData = {
      displayId: card.display_id,
      title: card.title,
      state: card.state,
      assignee: card.assigned_to ?? "—",
      entries,
    } as const;
  } catch (err) {
    if (err instanceof ApiRequestError && err.code === "NOT_FOUND") {
      notFound();
    }
    throw err;
  }

  return (
    <PrimaryPane
      goalSpaceId={id}
      snapshot={snapshot}
      boards={boards.items}
      confirmations={confirmationsResult.items}
      taskId={taskId}
      taskData={taskData}
      onSendTaskMessage={async () => {
        "use server";
        // server action stub — implementation deferred
      }}
    />
  );
}