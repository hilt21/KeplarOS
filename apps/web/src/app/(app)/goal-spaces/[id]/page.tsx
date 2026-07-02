/**
 * /goal-spaces/[id] (F2-09 + F4).
 *
 * Server component: fetches goal space detail, node boards, and pending
 * confirmations server-side via the F2-03 / F2-04 / F2-07 services and
 * hands them to the `<PrimaryPane>` client component. PrimaryPane uses
 * the shared `useContextStore` (populated by AppShell from the pathname)
 * to route between `<GoalSpaceKanbanView>` and `<TaskTimelineView>`.
 */

import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { ApiRequestError } from "@/lib/api/errors";
import { getSessionActor } from "@/lib/auth/session";
import { getGoalSpaceDetailService } from "@/lib/services/goal-spaces";
import { listNodeBoardsForGoalSpaceService } from "@/lib/services/node-boards";
import { listConfirmationsService } from "@/lib/services/confirmations";
import { PrimaryPane } from "@/components/primary-pane";

interface GoalSpaceDetailPageProps {
  readonly params: Promise<{ id: string }>;
}

export default async function GoalSpaceDetailPage({
  params,
}: GoalSpaceDetailPageProps): Promise<React.ReactElement> {
  const { id } = await params;

  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("keplar_session");
  const cookieHeader = sessionCookie ? `keplar_session=${sessionCookie.value}` : "";
  const internalRequest = new Request(`http://internal/goal-spaces/${id}`, {
    headers: cookieHeader ? { cookie: cookieHeader } : {},
  });
  const actor = await getSessionActor(internalRequest);
  if (actor === null) {
    redirect("/login");
  }

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

  // F2-09 wire shape does not carry goal_space_id on
  // HumanConfirmationResponse. The shell renders the pending list
  // as-is; per-card filtering is the drawer's responsibility.
  const confirmationsResult = listConfirmationsService(actor, {
    status: "pending",
    page: 1,
    limit: 50,
  });
  const confirmations = confirmationsResult.items;

  return (
    <PrimaryPane
      goalSpaceId={id}
      snapshot={snapshot}
      boards={boards.items}
      confirmations={confirmations}
      onSendTaskMessage={async () => {
        "use server";
        // server action stub — implementation deferred
      }}
    />
  );
}