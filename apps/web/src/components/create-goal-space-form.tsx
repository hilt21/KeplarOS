"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Draft = Record<string, unknown>;

export function CreateGoalSpaceForm(): React.ReactElement {
  const router = useRouter();
  const [goal, setGoal] = useState("");
  const [draftText, setDraftText] = useState("");
  const [applicationId, setApplicationId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function generate(): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/v1/story-drafts/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal }),
        credentials: "include",
      });
      const body = (await response.json()) as {
        success: boolean;
        data?: { draft: Draft };
        error?: { message?: string };
      };
      if (!body.success || !body.data)
        throw new Error(body.error?.message ?? "Unable to generate draft.");
      setDraftText(JSON.stringify(body.data.draft, null, 2));
      setApplicationId(crypto.randomUUID());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to generate draft.");
    } finally {
      setBusy(false);
    }
  }

  async function apply(): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      const draft = JSON.parse(draftText) as Draft;
      const response = await fetch("/api/v1/story-drafts/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ story_application_id: applicationId, draft }),
      });
      const body = (await response.json()) as {
        success: boolean;
        data?: { goal_space_id: string };
        error?: { message?: string };
      };
      if (!body.success || !body.data)
        throw new Error(body.error?.message ?? "Unable to apply draft.");
      router.push(`/goal-spaces/${body.data.goal_space_id}`);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Draft must be valid JSON.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="grid gap-[var(--space-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] p-[var(--space-md)]">
      <label
        className="text-[var(--font-micro)] uppercase text-[var(--color-text-muted)]"
        htmlFor="story-goal"
      >
        Business goal
      </label>
      <textarea
        id="story-goal"
        value={goal}
        onChange={(event) => setGoal(event.currentTarget.value)}
        rows={3}
        className="border border-[var(--color-border)] bg-[var(--color-bg)] p-[var(--space-sm)] text-[var(--font-small)]"
      />
      <button
        type="button"
        onClick={() => void generate()}
        disabled={busy || !goal.trim()}
        className="w-fit bg-[var(--color-primary)] px-[var(--space-md)] py-[var(--space-xs)] text-[var(--font-small)] text-[var(--color-bg)] disabled:opacity-70"
      >
        {busy ? "Working…" : "Generate deterministic draft"}
      </button>
      {draftText ? (
        <>
          <label
            className="text-[var(--font-micro)] uppercase text-[var(--color-text-muted)]"
            htmlFor="story-draft"
          >
            Editable Story draft (deterministic demo)
          </label>
          <textarea
            id="story-draft"
            value={draftText}
            onChange={(event) => setDraftText(event.currentTarget.value)}
            rows={18}
            className="font-[var(--font-jetbrains-mono,monospace)] text-[var(--font-micro)] border border-[var(--color-border)] bg-[var(--color-bg)] p-[var(--space-sm)]"
          />
          <button
            type="button"
            onClick={() => void apply()}
            disabled={busy}
            className="w-fit bg-[var(--color-primary)] px-[var(--space-md)] py-[var(--space-xs)] text-[var(--font-small)] text-[var(--color-bg)] disabled:opacity-70"
          >
            Apply draft and create workspace
          </button>
        </>
      ) : null}
      {error ? (
        <p role="alert" className="text-[var(--font-small)] text-[var(--color-error)]">
          {error}
        </p>
      ) : null}
    </section>
  );
}
