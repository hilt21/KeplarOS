/**
 * /goal-spaces (F2-09).
 *
 * Server component: lists goal spaces via the F2-03 service. The
 * `<GoalSpaceList>` client component renders rows for the snapshot.
 * Auth is enforced by the parent (app)/layout.tsx.
 */

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSessionActor } from "@/lib/auth/session";
import { listGoalSpacesService } from "@/lib/services/goal-spaces";
import { GoalSpaceList } from "@/components/goal-space-list";
import { EmptyState } from "@/components/empty-state";

export default async function GoalSpacesPage(): Promise<React.ReactElement> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("keplar_session");
  const cookieHeader = sessionCookie ? `keplar_session=${sessionCookie.value}` : "";
  const internalRequest = new Request("http://internal/goal-spaces", {
    headers: cookieHeader ? { cookie: cookieHeader } : {},
  });
  const actor = await getSessionActor(internalRequest);
  if (actor === null) {
    redirect("/login");
  }

  const snapshot = listGoalSpacesService({ page: 1, limit: 50 }, actor);

  return (
    <div className="flex flex-col gap-[var(--space-md)] p-[var(--space-xl)]">
      <header className="flex items-baseline justify-between">
        <h1 className="font-[var(--font-instrument-sans,system-ui,sans-serif)] text-[var(--font-h2)] text-[var(--color-text-primary)]">
          goal spaces
        </h1>
        <span className="font-[var(--font-jetbrains-mono,monospace)] text-[var(--font-micro)] uppercase text-[var(--color-text-muted)]">
          {String(snapshot.total)} total
        </span>
      </header>
      {snapshot.items.length === 0 ? (
        <EmptyState kind="empty" caption="// no goal spaces yet — start one to begin." />
      ) : (
        <GoalSpaceList snapshot={snapshot} />
      )}
    </div>
  );
}