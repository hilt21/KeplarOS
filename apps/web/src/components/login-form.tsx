"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";

interface LoginEnvelope {
  readonly success: boolean;
  readonly error?: {
    readonly message?: string;
  };
}

export function LoginForm(): React.ReactElement {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Hydration marker — the form is server-rendered without React event
  // listeners; flipping this in useEffect signals that React has
  // mounted and the form is interactive. P3-04b's E2E waits on this.
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    setHydrated(true);
  }, []);

  async function handleSubmit(event?: FormEvent<HTMLFormElement>): Promise<void> {
    event?.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });
      const envelope = (await response.json()) as LoginEnvelope;

      if (!envelope.success) {
        setError(envelope.error?.message ?? "Unable to sign in.");
        return;
      }

      router.refresh();
      router.push("/goal-spaces");
    } catch {
      setError("Unable to sign in.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="grid gap-[var(--space-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-[var(--space-lg)]"
    >
      <div className="grid gap-[var(--space-2xs)]">
        <label
          htmlFor="email"
          className="text-[var(--font-micro)] font-medium uppercase text-[var(--color-text-muted)]"
        >
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.currentTarget.value)}
          className="min-h-10 border border-[var(--color-border)] bg-[var(--color-bg)] px-[var(--space-sm)] py-[var(--space-xs)] text-[var(--font-small)] text-[var(--color-text-primary)] outline-none transition-colors focus:border-[var(--color-primary)]"
        />
      </div>

      <div className="grid gap-[var(--space-2xs)]">
        <label
          htmlFor="password"
          className="text-[var(--font-micro)] font-medium uppercase text-[var(--color-text-muted)]"
        >
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.currentTarget.value)}
          className="min-h-10 border border-[var(--color-border)] bg-[var(--color-bg)] px-[var(--space-sm)] py-[var(--space-xs)] text-[var(--font-small)] text-[var(--color-text-primary)] outline-none transition-colors focus:border-[var(--color-primary)]"
        />
      </div>

      {error ? (
        <p role="alert" className="text-[var(--font-small)] text-[var(--color-error)]">
          {error}
        </p>
      ) : null}

      <button
        type="button"
        onClick={() => void handleSubmit()}
        disabled={!hydrated || isSubmitting}
        data-hydrated={hydrated ? "true" : "false"}
        className="min-h-10 bg-[var(--color-primary)] px-[var(--space-md)] py-[var(--space-xs)] text-[var(--font-small)] font-semibold text-[var(--color-bg)] transition-colors hover:bg-[var(--color-primary-hover)] disabled:cursor-not-allowed disabled:opacity-70"
      >
        {isSubmitting ? "Signing in" : "Sign in"}
      </button>
    </form>
  );
}
