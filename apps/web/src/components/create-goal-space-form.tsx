"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";

interface GoalSpaceEnvelope {
  readonly success: boolean;
  readonly error?: {
    readonly message?: string;
  };
}

export function CreateGoalSpaceForm(): React.ReactElement {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/v1/goal-spaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name,
          description,
          constraints: [],
          acceptance_criteria: [],
        }),
      });
      const envelope = (await response.json()) as GoalSpaceEnvelope;

      if (!envelope.success) {
        setError(envelope.error?.message ?? "Unable to create goal space.");
        return;
      }

      setName("");
      setDescription("");
      router.refresh();
    } catch {
      setError("Unable to create goal space.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="grid gap-[var(--space-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] p-[var(--space-md)]"
    >
      <div className="grid gap-[var(--space-sm)] md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_auto] md:items-end">
        <div className="grid gap-[var(--space-2xs)]">
          <label
            htmlFor="goal-space-name"
            className="text-[var(--font-micro)] font-medium uppercase text-[var(--color-text-muted)]"
          >
            Goal name
          </label>
          <input
            id="goal-space-name"
            name="name"
            type="text"
            required
            value={name}
            onChange={(event) => setName(event.currentTarget.value)}
            className="min-h-10 border border-[var(--color-border)] bg-[var(--color-bg)] px-[var(--space-sm)] py-[var(--space-xs)] text-[var(--font-small)] text-[var(--color-text-primary)] outline-none transition-colors focus:border-[var(--color-primary)]"
          />
        </div>

        <div className="grid gap-[var(--space-2xs)]">
          <label
            htmlFor="goal-space-description"
            className="text-[var(--font-micro)] font-medium uppercase text-[var(--color-text-muted)]"
          >
            Description
          </label>
          <input
            id="goal-space-description"
            name="description"
            type="text"
            required
            value={description}
            onChange={(event) => setDescription(event.currentTarget.value)}
            className="min-h-10 border border-[var(--color-border)] bg-[var(--color-bg)] px-[var(--space-sm)] py-[var(--space-xs)] text-[var(--font-small)] text-[var(--color-text-primary)] outline-none transition-colors focus:border-[var(--color-primary)]"
          />
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="min-h-10 bg-[var(--color-primary)] px-[var(--space-md)] py-[var(--space-xs)] text-[var(--font-small)] font-semibold text-[var(--color-bg)] transition-colors hover:bg-[var(--color-primary-hover)] disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isSubmitting ? "Creating goal space" : "Create goal space"}
        </button>
      </div>

      {error ? (
        <p role="alert" className="text-[var(--font-small)] text-[var(--color-error)]">
          {error}
        </p>
      ) : null}
    </form>
  );
}
