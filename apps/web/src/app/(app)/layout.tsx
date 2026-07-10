/**
 * Authenticated three-column shell (F2-09 / F2 server-side fetcher).
 *
 * Server component wrapper. Reads the `keplar_session` cookie via
 * Next.js' `cookies()` and gates the (app) route group on a valid
 * session. Renders a single client `<AppShellWrapper>` containing the
 * header (logo, breadcrumb, theme switcher, connection status) and the
 * CSS grid (left 280px / center / right 360px collapsible).
 *
 * F2 responsibilities:
 *   - Resolve the authenticated actor.
 *   - Fetch the actor's goal spaces together with task summaries
 *     (single batch fetch via `listGoalSpacesWithTasksService` — no N+1).
 *   - Build the F3 props for `<AppShell>`: user info, goal spaces,
 *     tasks by goal space, plus placeholders for per-page context that
 *     F3/F4/F5 derive client-side from `usePathname()`.
 *
 * Auth: redirects to `/login` when no session is present.
 */

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { users } from "@db/schema";

import { getSessionActor } from "@/lib/auth/session";
import { AppShellWrapper } from "@/components/app-shell-wrapper";
import type { AppShellTaskSummary } from "@/components/app-shell";
import { getDb } from "@/lib/db/client";
import { listGoalSpacesWithTasksService } from "@/lib/services/goal-spaces";
import { TOKENS_PLACEHOLDER_USED, TOKENS_PLACEHOLDER_CAP } from "@/lib/constants/tokens";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}): Promise<React.ReactElement> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("keplar_session");
  const cookieHeader = sessionCookie ? `keplar_session=${sessionCookie.value}` : "";
  const internalRequest = new Request("http://internal/app", {
    headers: cookieHeader ? { cookie: cookieHeader } : {},
  });
  const actor = await getSessionActor(internalRequest);
  if (actor === null) {
    redirect("/login");
  }

  // Look up the actor's display name (used by `SettingsBar`/`MasterPane`).
  // We only need `name` for the F2 contract; the actor role is already on
  // the Actor type. Workspace is left blank — the front end treats it as
  // derived state from the URL until a dedicated workspace endpoint ships.
  const db = getDb();
  const actorRow = db.select({ name: users.name }).from(users).where(eq(users.id, actor.id)).get();

  const goalSpacesWithTasks = listGoalSpacesWithTasksService(actor, db);
  const goalSpaceList = goalSpacesWithTasks.map((entry) => entry.goalSpace);
  const tasksByGoalSpace: Readonly<Record<string, readonly AppShellTaskSummary[]>> =
    Object.fromEntries(goalSpacesWithTasks.map((entry) => [entry.goalSpace.id, entry.tasks]));

  return (
    <AppShellWrapper
      user={{
        name: actorRow?.name ?? "",
        role: actor.role,
        workspace: "",
      }}
      goalSpaces={goalSpaceList}
      tasksByGoalSpace={tasksByGoalSpace}
      nodeBoardsByGoalSpace={
        // TODO(F11/F12): replace with real boards data from listGoalSpacesWithTasksService or a new listNodeBoardsService.
        {}
      }
      currentGoalSpaceHeader={null}
      goalSpaceId={null}
      card={null}
      tokensUsed={TOKENS_PLACEHOLDER_USED}
      tokensCap={TOKENS_PLACEHOLDER_CAP}
      env={process.env.NODE_ENV === "production" ? "prod" : "dev"}
    >
      {children}
    </AppShellWrapper>
  );
}
