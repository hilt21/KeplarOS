/**
 * useCurrentGoalSpaceHeader — derive current GS name + board from URL.
 *
 * Replaces the hardcoded `currentGoalSpaceHeader={null}` that caused
 * the right-rail goal/board fields to always render "—".
 *
 * Two inputs:
 *   - `goalSpaces` — the list of goal spaces the actor can see
 *     (already fetched server-side by `(app)/layout.tsx`).
 *   - `nodeBoardsByGs` — the list of node boards per goal space.
 *
 * Resolution priority: the explicit `goalSpaceId` prop (when set by
 * a server layout that already resolved the id) wins over the URL.
 * Falling back to URL parsing keeps the hook usable in pages where
 * only `usePathname()` is available.
 */

import { useMemo } from "react";
import { usePathname } from "next/navigation";
import type { AppShellGoalSpaceSummary } from "@/components/app-shell";
import { parseContextFromPath } from "./context-store";

export interface CurrentGoalSpaceHeader {
  readonly name: string;
  readonly boardName: string;
}

interface UseCurrentGoalSpaceHeaderOptions {
  readonly goalSpaces: readonly AppShellGoalSpaceSummary[];
  readonly nodeBoardsByGs?: Readonly<Record<string, readonly { name: string }[]>>;
  readonly goalSpaceId: string | null;
}

export function useCurrentGoalSpaceHeader(
  options: UseCurrentGoalSpaceHeaderOptions,
): CurrentGoalSpaceHeader | null {
  const pathname = usePathname();
  return useMemo(() => {
    const effectiveId = (options.goalSpaceId ?? parseContextFromPath(pathname).goalSpaceId) || null;
    if (!effectiveId) return null;

    const goalSpace = options.goalSpaces.find((gs) => gs.id === effectiveId);
    if (!goalSpace) return null;

    const boards = options.nodeBoardsByGs?.[effectiveId] ?? [];
    const firstBoard = boards[0];

    return {
      name: goalSpace.name,
      boardName: firstBoard?.name ?? "",
    };
  }, [options.goalSpaces, options.nodeBoardsByGs, options.goalSpaceId, pathname]);
}
