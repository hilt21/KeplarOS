import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { LoginForm } from "@/components/login-form";
import { getSessionActor } from "@/lib/auth/session";

export default async function LoginPage(): Promise<React.ReactElement> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("keplar_session");
  const cookieHeader = sessionCookie ? `keplar_session=${sessionCookie.value}` : "";
  const internalRequest = new Request("http://internal/login", {
    headers: cookieHeader ? { cookie: cookieHeader } : {},
  });
  const actor = await getSessionActor(internalRequest);

  if (actor !== null) {
    redirect("/goal-spaces");
  }

  return (
    <main className="min-h-screen bg-[var(--color-bg)] px-[var(--space-lg)] py-[var(--space-2xl)] text-[var(--color-text-primary)]">
      <section className="mx-auto grid w-full max-w-[420px] gap-[var(--space-lg)]">
        <header className="grid gap-[var(--space-xs)] border-b border-[var(--color-border)] pb-[var(--space-md)]">
          <p className="font-[var(--font-jetbrains-mono,monospace)] text-[var(--font-micro)] uppercase text-[var(--color-primary)]">
            KEPLAR Session
          </p>
          <h1 className="text-[var(--font-h2)] font-semibold text-[var(--color-text-primary)]">
            Sign in
          </h1>
          <p className="text-[var(--font-small)] leading-6 text-[var(--color-text-secondary)]">
            Access governed goal spaces and visible execution traces.
          </p>
        </header>
        <LoginForm />
      </section>
    </main>
  );
}
