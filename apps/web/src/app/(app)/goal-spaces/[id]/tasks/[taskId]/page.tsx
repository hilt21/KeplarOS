/**
 * /goal-spaces/[id]/tasks/[taskId] (F4).
 *
 * Server component: renders `<PrimaryPane>` with the goal-space data
 * the page loaded server-side and the per-task data the F5 wiring
 * populates. PrimaryPane uses the shared `useContextStore` (populated
 * by AppShell from the pathname) to decide whether to show
 * `<TaskTimelineView>` or fall through to `<GoalSpaceKanbanView>`.
 */

import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { ApiRequestError } from "@/lib/api/errors";
import { getSessionActor } from "@/lib/auth/session";
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

  // NOTE: card / timeline events fetch is a follow-up (F5). The route
  // exists so the persistent shell can navigate to it; PrimaryPane
  // currently falls through to GoalSpaceKanbanView when taskData is
  // absent. Once F5 wires the F2-05 / F2-08 services, populate
  // `taskData` here and PrimaryPane will render <TaskTimelineView>.
  return (
    <PrimaryPane
      goalSpaceId={id}
      snapshot={snapshot}
      boards={boards.items}
      confirmations={confirmationsResult.items}
      taskId={taskId}
      onSendTaskMessage={async () => {
        "use server";
        // server action stub — implementation deferred
      }}
    />
  );
}