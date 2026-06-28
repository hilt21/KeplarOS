"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";

interface NodeBoardEnvelope {
  readonly success: boolean;
  readonly error?: {
    readonly message?: string;
  };
}

interface CreateNodeBoardFormProps {
  readonly goalSpaceId: string;
}

export function CreateNodeBoardForm({ goalSpaceId }: CreateNodeBoardFormProps): React.ReactElement {
  const router = useRouter();
  const [key, setKey] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Hydration marker — see LoginForm for rationale.
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    setHydrated(true);
  }, []);

  async function handleSubmit(event?: FormEvent<HTMLFormElement>): Promise<void> {
    event?.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/v1/goal-spaces/${goalSpaceId}/node-boards`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          key,
          name,
          description,
        }),
      });
      const envelope = (await response.json()) as NodeBoardEnvelope;

      if (!envelope.success) {
        setError(envelope.error?.message ?? "Unable to create node board.");
        return;
      }

      setKey("");
      setName("");
      setDescription("");
      router.refresh();
    } catch {
      setError("Unable to create node board.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="grid gap-[var(--space-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] p-[var(--space-md)]"
    >
      <div className="grid gap-[var(--space-sm)] md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_minmax(0,2fr)_auto] md:items-end">
        <div className="grid gap-[var(--space-2xs)]">
          <label
            htmlFor="node-board-key"
            className="text-[var(--font-micro)] font-medium uppercase text-[var(--color-text-muted)]"
          >
            Board key
          </label>
          <input
            id="node-board-key"
            name="key"
            type="text"
            required
            value={key}
            onChange={(event) => setKey(event.currentTarget.value)}
            className="min-h-10 border border-[var(--color-border)] bg-[var(--color-bg)] px-[var(--space-sm)] py-[var(--space-xs)] text-[var(--font-small)] text-[var(--color-text-primary)] outline-none transition-colors focus:border-[var(--color-primary)]"
          />
        </div>

        <div className="grid gap-[var(--space-2xs)]">
          <label
            htmlFor="node-board-name"
            className="text-[var(--font-micro)] font-medium uppercase text-[var(--color-text-muted)]"
          >
            Board name
          </label>
          <input
            id="node-board-name"
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
            htmlFor="node-board-description"
            className="text-[var(--font-micro)] font-medium uppercase text-[var(--color-text-muted)]"
          >
            Description
          </label>
          <input
            id="node-board-description"
            name="description"
            type="text"
            value={description}
            onChange={(event) => setDescription(event.currentTarget.value)}
            className="min-h-10 border border-[var(--color-border)] bg-[var(--color-bg)] px-[var(--space-sm)] py-[var(--space-xs)] text-[var(--font-small)] text-[var(--color-text-primary)] outline-none transition-colors focus:border-[var(--color-primary)]"
          />
        </div>

        <button
          type="button"
          onClick={() => void handleSubmit()}
          disabled={!hydrated || isSubmitting}
          data-hydrated={hydrated ? "true" : "false"}
          className="min-h-10 bg-[var(--color-primary)] px-[var(--space-md)] py-[var(--space-xs)] text-[var(--font-small)] font-semibold text-[var(--color-bg)] transition-colors hover:bg-[var(--color-primary-hover)] disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isSubmitting ? "Creating node board" : "Create node board"}
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
