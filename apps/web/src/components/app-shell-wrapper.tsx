/**
 * AppShellWrapper (F2). Thin server-component-compatible pass-through
 * between the (app) layout's data fetches and the client `<AppShell>`.
 *
 * Why this exists:
 * - `(app)/layout.tsx` is an async server component. It cannot pass
 *   props to a `"use client"` boundary without going through a JSX
 *   boundary; this wrapper is that boundary.
 * - AppShell already declares the F2 data props on its props interface
 *   (see `apps/web/src/components/app-shell.tsx`), but F3 owns the
 *   actual rendering of those props. Today the wrapper just forwards
 *   them and the client shell ignores them.
 *
 * F3 will replace the AppShell internals (left rail, right rail,
 * current header). The wrapper's job is purely to keep the data
 * contract stable.
 */

import type { ReactElement, ReactNode } from "react";
import {
  AppShell,
  type AppShellCardRuntimeInfo,
  type AppShellGoalSpaceSummary,
  type AppShellTaskSummary,
  type AppShellUser,
} from "./app-shell";

export interface AppShellWrapperProps {
  readonly user: AppShellUser;
  readonly goalSpaces: readonly AppShellGoalSpaceSummary[];
  readonly tasksByGoalSpace: Readonly<Record<string, readonly AppShellTaskSummary[]>>;
  readonly nodeBoardsByGoalSpace?: Readonly<Record<string, readonly { name: string }[]>> | undefined;
  readonly goalSpaceId: string | null;
  readonly card: AppShellCardRuntimeInfo | null;
  readonly tokensUsed: number;
  readonly tokensCap: number;
  readonly env: "dev" | "prod";
  readonly children: ReactNode;
}

export function AppShellWrapper(props: AppShellWrapperProps): ReactElement {
  return (
    <AppShell
      user={props.user}
      goalSpaces={props.goalSpaces}
      tasksByGoalSpace={props.tasksByGoalSpace}
      nodeBoardsByGoalSpace={props.nodeBoardsByGoalSpace}
      goalSpaceId={props.goalSpaceId}
      card={props.card}
      tokensUsed={props.tokensUsed}
      tokensCap={props.tokensCap}
      env={props.env}
    >
      {props.children}
    </AppShell>
  );
}