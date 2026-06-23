/**
 * Authenticated three-column shell (F2-09).
 *
 * Server component wrapper. Reads the `keplar_session` cookie via
 * Next.js' `cookies()` and gates the (app) route group on a valid
 * session. Renders a single client `<AppShell>` containing the header
 * (logo, breadcrumb, theme switcher, connection status) and the CSS
 * grid (left 280px / center / right 360px collapsible).
 *
 * Auth: redirects to `/login` when no session is present.
 */

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSessionActor } from "@/lib/auth/session";
import { AppShell } from "@/components/app-shell";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}): Promise<React.ReactElement> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("keplar_session");
  const cookieHeader = sessionCookie
    ? `keplar_session=${sessionCookie.value}`
    : "";
  const internalRequest = new Request("http://internal/app", {
    headers: cookieHeader ? { cookie: cookieHeader } : {},
  });
  const actor = await getSessionActor(internalRequest);
  if (actor === null) {
    redirect("/login");
  }
  return <AppShell>{children}</AppShell>;
}