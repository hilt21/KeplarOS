"use client";

/**
 * GoalSpaceList (F2-09).
 *
 * Table-style list of goal spaces. Each row is mono-id + sans-name +
 * status dot + last-updated relative time.
 */

import Link from "next/link";
import { StatusDot } from "./empty-state";
import type { GoalSpaceListResponse } from "@/lib/api/types";

export interface GoalSpaceListProps {
  readonly snapshot: GoalSpaceListResponse;
}

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diff = Math.max(0, now - then);
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  return `${day}d ago`;
}

export function GoalSpaceList({ snapshot }: GoalSpaceListProps): React.ReactElement {
  return (
    <table className="w-full table-fixed border-collapse text-left">
      <thead>
        <tr className="border-b border-[var(--color-border)] text-[var(--font-micro)] uppercase tracking-wider text-[var(--color-text-muted)]">
          <th className="w-[6px] py-[var(--space-xs)] font-[var(--font-jetbrains-mono,monospace)] font-normal">
            ·
          </th>
          <th className="py-[var(--space-xs)] pl-[var(--space-2xs)] font-[var(--font-jetbrains-mono,monospace)] font-normal">
            id
          </th>
          <th className="py-[var(--space-xs)] font-[var(--font-instrument-sans,system-ui,sans-serif)] font-normal">
            name
          </th>
          <th className="py-[var(--space-xs)] font-[var(--font-jetbrains-mono,monospace)] font-normal">
            status
          </th>
          <th className="py-[var(--space-xs)] text-right font-[var(--font-jetbrains-mono,monospace)] font-normal">
            updated
          </th>
        </tr>
      </thead>
      <tbody>
        {snapshot.items.map((gs) => (
          <tr
            key={gs.id}
            className="border-b border-[var(--color-border)] hover:bg-[var(--color-surface)]"
            style={{ transitionDuration: "var(--motion-hover)" }}
          >
            <td className="py-[var(--space-sm)]">
              <StatusDot status={gs.status} />
            </td>
            <td className="py-[var(--space-sm)] pl-[var(--space-2xs)] font-[var(--font-jetbrains-mono,monospace)] text-[var(--font-small)] text-[var(--color-text-secondary)]">
              <Link href={`/goal-spaces/${gs.id}`} className="hover:text-[var(--color-primary)]">
                {gs.id.slice(0, 8)}
              </Link>
            </td>
            <td className="py-[var(--space-sm)] font-[var(--font-instrument-sans,system-ui,sans-serif)] text-[var(--font-body)] text-[var(--color-text-primary)]">
              <Link href={`/goal-spaces/${gs.id}`} className="hover:text-[var(--color-primary)]">
                {gs.name}
              </Link>
            </td>
            <td className="py-[var(--space-sm)] font-[var(--font-jetbrains-mono,monospace)] text-[var(--font-micro)] uppercase text-[var(--color-text-muted)]">
              {gs.status}
            </td>
            <td className="py-[var(--space-sm)] text-right font-[var(--font-jetbrains-mono,monospace)] text-[var(--font-micro)] text-[var(--color-text-muted)]">
              {relativeTime(gs.updated_at)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
