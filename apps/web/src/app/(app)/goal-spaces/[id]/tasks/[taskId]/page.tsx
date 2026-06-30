import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { getSessionActor } from "@/lib/auth/session";
import { PrimaryPane } from "@/components/primary-pane";

interface PageProps {
  params: Promise<{ id: string; taskId: string }>;
}

export default async function TaskPage({ params }: PageProps) {
  const { id, taskId } = await params;
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("keplar_session");
  const cookieHeader = sessionCookie ? `keplar_session=${sessionCookie.value}` : "";
  const internalRequest = new Request(
    `http://internal/goal-spaces/${id}/tasks/${taskId}`,
    { headers: cookieHeader ? { cookie: cookieHeader } : {} },
  );
  const actor = await getSessionActor(internalRequest);
  if (actor === null) notFound();

  // NOTE: card / timeline events fetch is a follow-up. The route
  // exists so the persistent shell can navigate to it. A later
  // change wires up the F2-05 / F2-08 services to populate
  // taskData with the actual card + timeline entries.
  return (
    <PrimaryPane
      goalSpaceId={id}
      taskId={taskId}
      onSendTaskMessage={async () => {
        "use server";
        // server action stub — implementation deferred
      }}
    />
  );
}
