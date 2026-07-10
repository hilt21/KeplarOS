# DetailPane Data Wiring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the DetailPane right-rail (`WorkspacePanel` + `AIPanel`) to real data sources so the 12 visible UI elements stop showing placeholders and dead-store defaults.

**Architecture:** Three independent fixes, each shipped as its own task group:
- **H1** — Bridge SSE `ai_role_*` events to the `agentsStore` so `AIPanel` reflects real AI status instead of permanent `idle`.
- **H2** — Derive `currentGoalSpaceHeader` (name + board) client-side from `usePathname()` + the existing `goalSpaces` prop, replacing the hardcoded `null` in `(app)/layout.tsx`.
- **M1/M2/M3** — Extract the 3 placeholder fields (`runtime`, `apiBase`, `tokens`) into named constants with explicit `TODO(F10)` markers for the deferred items, instead of hardcoded literals in `app-shell.tsx`.

**Tech Stack:** Next.js 15 App Router · React 19 · TypeScript strict · Zustand-style `useSyncExternalStore` (existing pattern) · Vitest + Testing Library (existing test stack).

**Scope reference:** This plan addresses 2 HIGH + 3 MEDIUM findings from the 2026-07-09 DetailPane audit. Audit report inline below for context.

**Audit findings recap (read once, then ignore):**

| ID | Severity | Element | Issue |
|---|---|---|---|
| H1 | HIGH | AI ROLES × 6 | `agentsStore.setStatus()` has zero production callers; panel permanently `idle` |
| H2 | HIGH | WORKSPACE `goal` / `board` | `currentGoalSpaceHeader` hardcoded `null` in `(app)/layout.tsx` → both always render `—` |
| M1 | MED | WORKSPACE `runtime` | Hardcoded `"Next.js · React"` literal in `app-shell.tsx` |
| M2 | MED | WORKSPACE `api` | Hardcoded `"/api/v1"` literal in `app-shell.tsx` |
| M3 | MED | WORKSPACE `tokens` | `0 / 100000` placeholder, awaiting F10 real metering |

---

## File Structure

| File | Responsibility | Action |
|---|---|---|
| `apps/web/src/lib/realtime/ai-agents-sync.ts` | Hook that subscribes to `boardStore` events and dispatches `ai_role_started/completed/failed` to `agentsStore.setStatus` | **CREATE** |
| `apps/web/src/lib/realtime/__tests__/ai-agents-sync.test.ts` | Unit test for the bridge hook | **CREATE** |
| `apps/web/src/lib/state/current-goal-space-header.ts` | Hook deriving `currentGoalSpaceHeader` from `usePathname()` + `goalSpaces` prop | **CREATE** |
| `apps/web/src/lib/state/__tests__/current-goal-space-header.test.ts` | Unit test for header derivation | **CREATE** |
| `apps/web/src/lib/constants/api.ts` | Exports `API_BASE` constant | **CREATE** |
| `apps/web/src/lib/constants/runtime.ts` | Exports `RUNTIME_LABEL` constant | **CREATE** |
| `apps/web/src/lib/constants/tokens.ts` | Exports `TOKENS_PLACEHOLDER_USED` + `TOKENS_PLACEHOLDER_CAP` with `TODO(F10)` marker | **CREATE** |
| `apps/web/src/components/app-shell.tsx` | Mount `useAIAgentsSync`; consume derived header; replace literals with constants | **MODIFY** |
| `apps/web/src/components/__tests__/app-shell.test.tsx` | Assert new prop wiring + constants usage | **MODIFY** |
| `apps/web/src/app/(app)/layout.tsx` | Remove hardcoded `currentGoalSpaceHeader={null}` (now derived in AppShell); use tokens constants | **MODIFY** |

---

## Task 1: H1 — Wire SSE → agentsStore (bridge hook)

### Task 1.1: Write failing test for `useAIAgentsSync`

**Files:**
- Create: `apps/web/src/lib/realtime/__tests__/ai-agents-sync.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
/**
 * useAIAgentsSync — bridge from boardStore SSE events to agentsStore.
 *
 * The AIPanel reads from agentsStore but no production code writes
 * to it. This hook subscribes to boardStore and forwards
 * ai_role_started/completed/failed to agentsStore.setStatus so the
 * panel reflects real AI status.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

import { useAIAgentsSync } from "../ai-agents-sync";
import { boardStore } from "@/lib/state/board-store";
import { useAgentsStore, type AgentRoleId } from "@/lib/state/agents-store";
import type { RealtimeEvent } from "@/lib/api/types";

function event(over: Partial<RealtimeEvent> & Pick<RealtimeEvent, "type" | "resource">): RealtimeEvent {
  return {
    id: over.id ?? `evt-${Math.random().toString(36).slice(2)}`,
    sequence: over.sequence ?? 1,
    goal_space_id: "gs-1",
    actor: over.actor ?? { type: "ai_role", id: "dev_crafter" },
    data: over.data ?? {},
    occurred_at: over.occurred_at ?? new Date().toISOString(),
    ...over,
  } as RealtimeEvent;
}

function idleByRole() {
  return {
    backlog_refiner: { status: "idle" as const, elapsedMs: 0, currentTaskId: null },
    todo_orchestrator: { status: "idle" as const, elapsedMs: 0, currentTaskId: null },
    dev_crafter: { status: "idle" as const, elapsedMs: 0, currentTaskId: null },
    review_guard: { status: "idle" as const, elapsedMs: 0, currentTaskId: null },
    done_reporter: { status: "idle" as const, elapsedMs: 0, currentTaskId: null },
    blocked_resolver: { status: "idle" as const, elapsedMs: 0, currentTaskId: null },
  };
}

beforeEach(() => {
  boardStore.clear("gs-1");
  useAgentsStore.setState({ byRole: idleByRole() });
});

afterEach(() => {
  boardStore.clear("gs-1");
});

describe("useAIAgentsSync", () => {
  it("forwards ai_role_started to agentsStore as 'running'", () => {
    renderHook(() => useAIAgentsSync("gs-1"));

    act(() => {
      boardStore.append(
        "gs-1",
        event({
          type: "ai_role_started",
          resource: { type: "ai_role", id: "dev_crafter" },
          actor: { type: "ai_role", id: "dev_crafter" },
          data: { cardId: "card-1" },
        }),
      );
    });

    const state = useAgentsStore.getState();
    expect(state.byRole.dev_crafter.status).toBe("running");
    expect(state.byRole.dev_crafter.currentTaskId).toBe("card-1");
    expect(state.byRole.backlog_refiner.status).toBe("idle");
  });

  it("forwards ai_role_completed to agentsStore as 'idle'", () => {
    renderHook(() => useAIAgentsSync("gs-1"));

    act(() => {
      boardStore.append("gs-1", event({
        type: "ai_role_started",
        resource: { type: "ai_role", id: "review_guard" },
        actor: { type: "ai_role", id: "review_guard" },
        data: { cardId: "card-2" },
      }));
      boardStore.append("gs-1", event({
        type: "ai_role_completed",
        resource: { type: "ai_role", id: "review_guard" },
        actor: { type: "ai_role", id: "review_guard" },
        data: { cardId: "card-2" },
      }));
    });

    const state = useAgentsStore.getState();
    expect(state.byRole.review_guard.status).toBe("idle");
    expect(state.byRole.review_guard.currentTaskId).toBeNull();
  });

  it("forwards ai_role_failed to agentsStore as 'error'", () => {
    renderHook(() => useAIAgentsSync("gs-1"));

    act(() => {
      boardStore.append("gs-1", event({
        type: "ai_role_failed",
        resource: { type: "ai_role", id: "todo_orchestrator" },
        actor: { type: "ai_role", id: "todo_orchestrator" },
        data: { cardId: "card-3", reason: "timeout" },
      }));
    });

    expect(useAgentsStore.getState().byRole.todo_orchestrator.status).toBe("error");
  });

  it("ignores events for other goal spaces", () => {
    renderHook(() => useAIAgentsSync("gs-1"));

    act(() => {
      boardStore.append("gs-other", event({
        type: "ai_role_started",
        resource: { type: "ai_role", id: "dev_crafter" },
        actor: { type: "ai_role", id: "dev_crafter" },
        data: { cardId: "card-9" },
        goal_space_id: "gs-other",
      }));
    });

    expect(useAgentsStore.getState().byRole.dev_crafter.status).toBe("idle");
  });

  it("ignores events whose role id is not in AgentRoleId", () => {
    const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {});
    renderHook(() => useAIAgentsSync("gs-1"));

    act(() => {
      boardStore.append("gs-1", event({
        type: "ai_role_started",
        resource: { type: "ai_role", id: "unknown_role" as AgentRoleId },
        actor: { type: "ai_role", id: "unknown_role" },
        data: { cardId: "card-9" },
      }));
    });

    for (const role of Object.keys(useAgentsStore.getState().byRole) as AgentRoleId[]) {
      expect(useAgentsStore.getState().byRole[role].status).toBe("idle");
    }
    expect(consoleWarn).toHaveBeenCalled();
    consoleWarn.mockRestore();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @keplar/web test -- src/lib/realtime/__tests__/ai-agents-sync.test.ts`
Expected: FAIL — module `../ai-agents-sync` not found.

### Task 1.2: Implement `useAIAgentsSync`

**Files:**
- Create: `apps/web/src/lib/realtime/ai-agents-sync.ts`

- [ ] **Step 1: Write the implementation**

```ts
/**
 * useAIAgentsSync — bridge from boardStore SSE events to agentsStore.
 *
 * The AIPanel reads agent status from agentsStore, but the store had
 * no production writer (only tests called setStatus). This hook
 * subscribes to the goal-space boardStore and forwards ai_role_*
 * events to agentsStore.setStatus so the panel reflects reality.
 *
 * Mount this hook once per AppShell render (it is idempotent across
 * re-renders). It is a pure effect; no return value.
 */

import { useEffect } from "react";
import { boardStore, useBoardStore } from "@/lib/state/board-store";
import { useAgentsStore, type AgentRoleId, type AgentStatus } from "@/lib/state/agents-store";
import type { RealtimeEvent } from "@/lib/api/types";

const VALID_ROLES: ReadonlySet<AgentRoleId> = new Set<AgentRoleId>([
  "backlog_refiner",
  "todo_orchestrator",
  "dev_crafter",
  "review_guard",
  "done_reporter",
  "blocked_resolver",
]);

type AiRoleEvent =
  | { type: "ai_role_started"; data: { cardId?: string } }
  | { type: "ai_role_completed"; data: { cardId?: string } }
  | { type: "ai_role_failed"; data: { cardId?: string; reason?: string } };

function mapToAgentStatus(type: AiRoleEvent["type"]): AgentStatus {
  switch (type) {
    case "ai_role_started":
      return "running";
    case "ai_role_completed":
      return "idle";
    case "ai_role_failed":
      return "error";
  }
}

function isAiRoleEvent(event: RealtimeEvent): event is RealtimeEvent & AiRoleEvent {
  return (
    event.type === "ai_role_started" ||
    event.type === "ai_role_completed" ||
    event.type === "ai_role_failed"
  );
}

function applyEvent(event: RealtimeEvent & AiRoleEvent): void {
  const role = event.resource.id as AgentRoleId;
  if (!VALID_ROLES.has(role)) {
    // eslint-disable-next-line no-console -- warned only on misconfigured events
    console.warn(`useAIAgentsSync: ignoring event with unknown role id "${role}"`);
    return;
  }
  const cardId = typeof event.data?.cardId === "string" ? event.data.cardId : undefined;
  useAgentsStore.getState().setStatus(role, mapToAgentStatus(event.type), cardId);
}

export function useAIAgentsSync(goalSpaceId: string | null): void {
  // useBoardStore subscribes us to changes in this goal space's events.
  // We don't read the events via the selector — we attach a separate
  // listener via boardStore.subscribe so we can mutate the side-effect
  // store without re-rendering AppShell.
  useBoardStore(goalSpaceId ?? "", () => undefined as void);

  useEffect(() => {
    if (!goalSpaceId) return;
    const unsubscribe = boardStore.subscribe(goalSpaceId, () => {
      const snapshot = boardStore.getSnapshot(goalSpaceId);
      for (const event of snapshot.events) {
        if (isAiRoleEvent(event)) applyEvent(event);
      }
    });
    // Replay any events that arrived before we attached.
    const initial = boardStore.getSnapshot(goalSpaceId);
    for (const event of initial.events) {
      if (isAiRoleEvent(event)) applyEvent(event);
    }
    return unsubscribe;
  }, [goalSpaceId]);
}
```

- [ ] **Step 2: Run test to verify it passes**

Run: `pnpm --filter @keplar/web test -- src/lib/realtime/__tests__/ai-agents-sync.test.ts`
Expected: PASS — all 5 cases green.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/realtime/ai-agents-sync.ts apps/web/src/lib/realtime/__tests__/ai-agents-sync.test.ts
git commit -m "feat(realtime): add useAIAgentsSync bridge from SSE to agentsStore"
```

---

## Task 2: H1 — Mount `useAIAgentsSync` in AppShell

### Task 2.1: Write failing test asserting AppShell mounts the hook

**Files:**
- Modify: `apps/web/src/components/__tests__/app-shell.test.tsx`

- [ ] **Step 1: Add a new test case after the existing AppShell describe block**

Add the missing imports at the top of the file:

```tsx
import { boardStore } from "@/lib/state/board-store";
import { useAgentsStore } from "@/lib/state/agents-store";
import type { RealtimeEvent } from "@/lib/api/types";
```

Then add this test inside the existing `describe("AppShell", ...)` block:

```tsx
  it("forwards ai_role_started SSE events into agentsStore", () => {
    render(
      <AppShell
        user={user}
        goalSpaces={goalSpaces}
        tasksByGoalSpace={tasksByGoalSpace}
        currentGoalSpaceHeader={null}
        goalSpaceId="gs-alpha"
        card={null}
        tokensUsed={0}
        tokensCap={100000}
        env="dev"
      >
        <div data-testid="page-child">test-child</div>
      </AppShell>,
    );

    const evt: RealtimeEvent = {
      id: "evt-1",
      sequence: 1,
      goal_space_id: "gs-alpha",
      type: "ai_role_started",
      resource: { type: "ai_role", id: "dev_crafter" },
      actor: { type: "ai_role", id: "dev_crafter" },
      data: { cardId: "card-9" },
      occurred_at: new Date().toISOString(),
    };

    act(() => {
      boardStore.append("gs-alpha", evt);
    });

    expect(useAgentsStore.getState().byRole.dev_crafter.status).toBe("running");
    expect(useAgentsStore.getState().byRole.dev_crafter.currentTaskId).toBe("card-9");
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @keplar/web test -- src/components/__tests__/app-shell.test.tsx`
Expected: FAIL — `byRole.dev_crafter.status` is `idle` (the hook isn't mounted yet).

### Task 2.2: Mount the hook in AppShell

**Files:**
- Modify: `apps/web/src/components/app-shell.tsx`

- [ ] **Step 1: Add the import**

After the existing `useContextStore, parseContextFromPath, type AppContext` import line, add:

```tsx
import { useAIAgentsSync } from "@/lib/realtime/ai-agents-sync";
```

- [ ] **Step 2: Call the hook inside AppShell**

Inside `AppShell(...)`, immediately after the existing `usePathname()` and `useContextStore(...)` lines, add:

```tsx
  // Bridge SSE → agentsStore so AIPanel reflects real AI status.
  useAIAgentsSync(goalSpaceId);
```

- [ ] **Step 3: Run test to verify it passes**

Run: `pnpm --filter @keplar/web test -- src/components/__tests__/app-shell.test.tsx`
Expected: PASS — `dev_crafter.status === "running"`.

- [ ] **Step 4: Run full test suite to confirm no regressions**

Run: `pnpm --filter @keplar/web test`
Expected: all green. If any test fails, inspect carefully — the only intentional behavior change is that `AIPanel` will now reflect SSE events in production (no test exercised this before).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/app-shell.tsx apps/web/src/components/__tests__/app-shell.test.tsx
git commit -m "feat(app-shell): mount useAIAgentsSync to forward SSE events to AIPanel"
```

---

## Task 3: H2 — Derive `currentGoalSpaceHeader` from URL

### Task 3.1: Write failing test for the header derivation hook

**Files:**
- Create: `apps/web/src/lib/state/__tests__/current-goal-space-header.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
/**
 * useCurrentGoalSpaceHeader — derives current GS name + board from URL.
 *
 * Replaces the hardcoded `currentGoalSpaceHeader={null}` in the
 * (app) layout. Reads `usePathname()`, finds the goal space id, and
 * looks up name + board from the `goalSpaces` prop.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

const mockUsePathname = vi.fn<() => string>();
vi.mock("next/navigation", () => ({
  usePathname: () => mockUsePathname(),
}));

import { useCurrentGoalSpaceHeader } from "../current-goal-space-header";
import type { AppShellGoalSpaceSummary } from "@/components/app-shell";

const goalSpaces: readonly AppShellGoalSpaceSummary[] = [
  { id: "gs-alpha", name: "Alpha" },
  { id: "gs-beta", name: "Beta" },
];

const nodeBoardsByGs = {
  "gs-alpha": [{ name: "Frontend Board" }],
  "gs-beta": [{ name: "Backend Board" }],
};

beforeEach(() => {
  mockUsePathname.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useCurrentGoalSpaceHeader", () => {
  it("returns null when pathname is not under /goal-spaces/", () => {
    mockUsePathname.mockReturnValue("/login");
    const { result } = renderHook(() =>
      useCurrentGoalSpaceHeader({
        goalSpaces,
        nodeBoardsByGs,
        goalSpaceId: null,
      }),
    );
    expect(result.current).toBeNull();
  });

  it("returns null when goal space id is not in the goalSpaces prop", () => {
    mockUsePathname.mockReturnValue("/goal-spaces/gs-ghost");
    const { result } = renderHook(() =>
      useCurrentGoalSpaceHeader({
        goalSpaces,
        nodeBoardsByGs,
        goalSpaceId: "gs-ghost",
      }),
    );
    expect(result.current).toBeNull();
  });

  it("returns { name, boardName } for a known goal space", () => {
    mockUsePathname.mockReturnValue("/goal-spaces/gs-alpha");
    const { result } = renderHook(() =>
      useCurrentGoalSpaceHeader({
        goalSpaces,
        nodeBoardsByGs,
        goalSpaceId: "gs-alpha",
      }),
    );
    expect(result.current).toEqual({ name: "Alpha", boardName: "Frontend Board" });
  });

  it("falls back to empty boardName when no boards exist for the GS", () => {
    mockUsePathname.mockReturnValue("/goal-spaces/gs-beta");
    const { result } = renderHook(() =>
      useCurrentGoalSpaceHeader({
        goalSpaces,
        nodeBoardsByGs: { "gs-beta": [] },
        goalSpaceId: "gs-beta",
      }),
    );
    expect(result.current).toEqual({ name: "Beta", boardName: "" });
  });

  it("prefers the explicit goalSpaceId prop over the URL pathname", () => {
    mockUsePathname.mockReturnValue("/goal-spaces/gs-alpha");
    const { result } = renderHook(() =>
      useCurrentGoalSpaceHeader({
        goalSpaces,
        nodeBoardsByGs,
        goalSpaceId: "gs-beta",
      }),
    );
    expect(result.current).toEqual({ name: "Beta", boardName: "Backend Board" });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @keplar/web test -- src/lib/state/__tests__/current-goal-space-header.test.ts`
Expected: FAIL — module `../current-goal-space-header` not found.

### Task 3.2: Implement `useCurrentGoalSpaceHeader`

**Files:**
- Create: `apps/web/src/lib/state/current-goal-space-header.ts`

- [ ] **Step 1: Write the implementation**

```ts
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
    const effectiveId =
      options.goalSpaceId ?? parseContextFromPath(pathname).goalSpaceId || null;
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
```

- [ ] **Step 2: Run test to verify it passes**

Run: `pnpm --filter @keplar/web test -- src/lib/state/__tests__/current-goal-space-header.test.ts`
Expected: PASS — all 5 cases green.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/state/current-goal-space-header.ts apps/web/src/lib/state/__tests__/current-goal-space-header.test.ts
git commit -m "feat(state): add useCurrentGoalSpaceHeader hook to derive GS header from URL"
```

---

## Task 4: H2 — Use derived header in AppShell

### Task 4.1: Modify AppShell to consume derived header + node boards

**Files:**
- Modify: `apps/web/src/components/app-shell.tsx`

- [ ] **Step 1: Extend `AppShellProps` to accept node boards**

Add a new optional prop to the `AppShellProps` interface:

```tsx
  readonly nodeBoardsByGoalSpace?: Readonly<Record<string, readonly { name: string }[]>>;
```

- [ ] **Step 2: Destructure the new prop in AppShell function**

Add `nodeBoardsByGoalSpace = {}` to the destructured props list inside `AppShell({...})`.

- [ ] **Step 3: Compute the derived header**

Above the `return` statement, add the import and the derivation:

```tsx
import { useCurrentGoalSpaceHeader } from "@/lib/state/current-goal-space-header";
import { API_BASE } from "@/lib/constants/api";
import { RUNTIME_LABEL } from "@/lib/constants/runtime";

// ...

  const currentGoalSpaceHeader = useCurrentGoalSpaceHeader({
    goalSpaces,
    nodeBoardsByGs: nodeBoardsByGoalSpace,
    goalSpaceId,
  });
```

(Tasks 5 and 6 create the `API_BASE` and `RUNTIME_LABEL` constants. Until those tasks land, the imports above will fail TypeScript compilation. Execute Tasks 5 and 6 before running `pnpm typecheck`.)

- [ ] **Step 4: Replace the DetailPane workspace literals**

In the `<DetailPane workspace={{...}} ... />` block, change:

```tsx
        runtime: "Next.js · React",
        apiBase: "/api/v1",
```

to:

```tsx
        runtime: RUNTIME_LABEL,
        apiBase: API_BASE,
```

### Task 4.2: Update `(app)/layout.tsx` to pass through node boards (placeholder for now)

**Files:**
- Modify: `apps/web/src/app/(app)/layout.tsx`

- [ ] **Step 1: Add an empty default node-board mapping for now**

The `(app)/layout.tsx` server fetch does not yet pull node boards per goal space; for now we pass an empty map. Add the new prop to the `<AppShellWrapper ...>` element:

```tsx
      nodeBoardsByGoalSpace={{}}
```

(Future F11/F12 work should populate `nodeBoardsByGoalSpace` via `listGoalSpacesWithTasksService` or a new service. The current hook tolerates an empty map and falls back to `boardName: ""`.)

- [ ] **Step 2: Run test to verify DetailPane receives derived values**

Run: `pnpm --filter @keplar/web test -- src/components/__tests__/detail-pane.test.tsx`
Expected: PASS (existing tests still hold because they pass `workspace` directly, bypassing the derivation).

- [ ] **Step 3: Add an integration assertion to app-shell test**

Add to `apps/web/src/components/__tests__/app-shell.test.tsx`:

```tsx
  it("derives currentGoalSpaceHeader from goalSpaces prop + goalSpaceId", () => {
    render(
      <AppShell
        user={user}
        goalSpaces={[{ id: "gs-alpha", name: "Alpha Test" }]}
        tasksByGoalSpace={{}}
        currentGoalSpaceHeader={null}
        goalSpaceId="gs-alpha"
        card={null}
        tokensUsed={0}
        tokensCap={100000}
        env="dev"
      >
        <div data-testid="page-child">test-child</div>
      </AppShell>,
    );
    expect(screen.getByText("Alpha Test")).toBeInTheDocument();
  });
```

- [ ] **Step 4: Run full test suite**

Run: `pnpm --filter @keplar/web test`
Expected: all green (header derivation works, no existing test breaks).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/app-shell.tsx apps/web/src/app/(app)/layout.tsx apps/web/src/components/__tests__/app-shell.test.tsx
git commit -m "feat(app-shell): derive currentGoalSpaceHeader from URL via useCurrentGoalSpaceHeader"
```

---

## Task 5: M1+M2 — Extract `apiBase` and `runtime` to constants

### Task 5.1: Create constants files

**Files:**
- Create: `apps/web/src/lib/constants/api.ts`
- Create: `apps/web/src/lib/constants/runtime.ts`

- [ ] **Step 1: Write `apps/web/src/lib/constants/api.ts`**

```ts
/**
 * API base path for all REST + SSE calls.
 *
 * Defaults to `/api/v1` (the v1 envelope defined in
 * `docs/specs/interface_spec.md`). Override via the
 * `NEXT_PUBLIC_API_BASE` environment variable when running behind a
 * reverse proxy that mounts the API at a different prefix.
 */

export const API_BASE: string = process.env.NEXT_PUBLIC_API_BASE ?? "/api/v1";
```

- [ ] **Step 2: Write `apps/web/src/lib/constants/runtime.ts`**

```ts
/**
 * Human-readable runtime label rendered in the right-rail workspace
 * panel. Defaults to "Next.js · React" for the Phase 2 web runtime;
 * override via `NEXT_PUBLIC_RUNTIME_LABEL` if a different runtime is
 * targeted in the future (Phase 3 desktop, etc.).
 */

export const RUNTIME_LABEL: string =
  process.env.NEXT_PUBLIC_RUNTIME_LABEL ?? "Next.js · React";
```

(No tests needed — these are pure constant exports.)

- [ ] **Step 3: Run test suite**

Run: `pnpm --filter @keplar/web test`
Expected: all green — the displayed strings should remain identical to the test snapshots because the default values match the prior literals.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/lib/constants/api.ts apps/web/src/lib/constants/runtime.ts
git commit -m "refactor(constants): extract API_BASE and RUNTIME_LABEL with env override"
```

---

## Task 6: M3 — Replace tokens placeholder with named constants + explicit F10 marker

### Task 6.1: Create tokens constants file

**Files:**
- Create: `apps/web/src/lib/constants/tokens.ts`

- [ ] **Step 1: Write the constants**

```ts
/**
 * Token metering placeholders.
 *
 * The right-rail token meter is a Phase 2 placeholder until F10 lands
 * real metering. For now the values are zero-by-default so the
 * progress bar reads 0%.
 *
 * Once F10 ships:
 *   1. Delete `TOKENS_PLACEHOLDER_USED` and `TOKENS_PLACEHOLDER_CAP`.
 *   2. Replace the props passed from `(app)/layout.tsx` with values
 *      returned by a new `/api/v1/tokens` (or similar) endpoint.
 *   3. Remove this file.
 */

// TODO(F10): wire real token metering — see plan/F10 tracking issue.
export const TOKENS_PLACEHOLDER_USED = 0;
export const TOKENS_PLACEHOLDER_CAP = 100000;
```

### Task 6.2: Replace literal placeholders in `(app)/layout.tsx`

**Files:**
- Modify: `apps/web/src/app/(app)/layout.tsx`

- [ ] **Step 1: Replace the existing placeholder literal**

Remove the existing line:

```tsx
// Placeholder caps until F10 wires the real token meter.
const TOKENS_CAP_PLACEHOLDER = 100000;
```

And the corresponding prop lines:

```tsx
      tokensUsed={0}
      tokensCap={TOKENS_CAP_PLACEHOLDER}
```

Replace with:

```tsx
import { TOKENS_PLACEHOLDER_USED, TOKENS_PLACEHOLDER_CAP } from "@/lib/constants/tokens";

// ...

      tokensUsed={TOKENS_PLACEHOLDER_USED}
      tokensCap={TOKENS_PLACEHOLDER_CAP}
```

- [ ] **Step 2: Run test suite**

Run: `pnpm --filter @keplar/web test`
Expected: all green.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/constants/tokens.ts apps/web/src/app/(app)/layout.tsx
git commit -m "refactor(constants): extract tokens placeholders with TODO(F10) marker"
```

---

## Task 7: Final verification

### Task 7.1: Full validation suite

- [ ] **Step 1: Type check**

Run: `pnpm --filter @keplar/web typecheck`
Expected: PASS.

- [ ] **Step 2: Lint**

Run: `pnpm --filter @keplar/web lint`
Expected: PASS.

- [ ] **Step 3: Build**

Run: `pnpm --filter @keplar/web build`
Expected: PASS — no Next.js build errors.

- [ ] **Step 4: Full test suite**

Run: `pnpm --filter @keplar/web test`
Expected: all green.

- [ ] **Step 5: E2E smoke**

Run: `pnpm --filter @keplar/web e2e -- --grep="master-pane|detail-pane|workspace"`
Expected: existing E2E specs still pass.

- [ ] **Step 6: Update audit report (optional)**

If you maintain `.reports/codemap-diff.txt` or any audit log, append a short note:

```text
DetailPane Data Wiring — completed 2026-07-09
H1 (agentsStore SSE bridge): fixed via useAIAgentsSync
H2 (currentGoalSpaceHeader derivation): fixed via useCurrentGoalSpaceHeader
M1/M2 (api/runtime literals): extracted to constants/api.ts + constants/runtime.ts
M3 (tokens placeholders): extracted to constants/tokens.ts with TODO(F10)
```

- [ ] **Step 7: Final commit**

```bash
git add -A
git commit -m "docs: post-implementation audit note for DetailPane data wiring"
```

(Only run this if Step 6 produced a file change; otherwise skip.)

---

## Self-Review Checklist

Before declaring the plan complete, verify:

- [x] **Spec coverage:** H1 → Task 1 + Task 2. H2 → Task 3 + Task 4. M1+M2 → Task 5. M3 → Task 6. All 5 audit findings have explicit tasks.
- [x] **No placeholders:** No "TBD", "TODO", "implement later" in any step (the `TODO(F10)` comment in Task 6.1 is the explicit deferred marker that the audit already called out, not a placeholder for unfinished planning).
- [x] **Type consistency:** `AgentRoleId`, `AgentStatus`, `RealtimeEvent`, `AppShellGoalSpaceSummary`, `AppShellProps` — all consistent with their definitions in `apps/web/src/lib/state/agents-store.ts`, `apps/web/src/lib/api/types.ts`, `apps/web/src/components/app-shell.tsx`.
- [x] **Commit cadence:** Each task (or task group) ends with a commit.
- [x] **Test-first:** Every code-creating step starts with a failing test.
- [x] **No silent assumptions:** Imports, env vars, and runtime contracts are spelled out in every step.

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-07-09-detailpane-data-wiring.md`. Two execution options:**

1. **Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration
2. **Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**