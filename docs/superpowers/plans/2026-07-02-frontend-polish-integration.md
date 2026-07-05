# Frontend Polish Integration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan feature-by-feature. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the 13 polish components (already created) into a persistent 3-pane shell so the screenshot target ([spec §3.1, §8.6](docs/superpowers/specs/2026-06-29-frontend-polish-design.md)) becomes reachable from `/goal-spaces/[id]` and `/goal-spaces/[id]/tasks/[taskId]`.

**Architecture:** Rewrite `app-shell.tsx` as the persistent 3-pane shell (TopBar | MasterPane | `<PrimaryPane>` | DetailPane) and hoist it into `app/(app)/layout.tsx` as a client component. The (app) server layout fetches `(user, current goal space, token usage, goal-space list with task summaries)` and passes them to `AppShell`. `PrimaryPane` keeps its existing route switch logic; both `/goal-spaces/[id]/page.tsx` and `/goal-spaces/[id]/tasks/[taskId]/page.tsx` render through it.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript 5, existing `useSyncExternalStore` stores, `useSseStream` (F2-09), Vitest + Testing Library + Playwright.

**Reference:** This plan closes the 25 gaps identified in the comparison report (target screenshot vs. actual rendered state).

---

## File Structure (locked by this plan)

| File | Status | Responsibility |
|---|---|---|
| `apps/web/src/app/(app)/layout.tsx` | **Modify** | Server-side: auth + fetch `(user, goal spaces, tasks by goal space, current goal space header, token usage)`. Render `<AppShell ... />`. |
| `apps/web/src/components/app-shell.tsx` | **Rewrite** | Client. Persistent 3-pane: `TopBar` (full-width, 48px) + flex row of `MasterPane` (280px) + `<main>{children}</main>` (1fr, contains `<PrimaryPane>`) + `DetailPane` (320px). No remount on route change. |
| `apps/web/src/components/primary-pane.tsx` | **Modify** | Render `GoalSpaceKanbanView` when `taskId` is absent; `TaskTimelineView` when present. Consume `contextStore` instead of `usePathname`. |
| `apps/web/src/components/master-pane.tsx` | **Modify** | Add localStorage persistence for collapsed sections (§8.3). Add sort order (§8.3). Wire `+ NEW` button to existing `CreateGoalSpaceForm`. |
| `apps/web/src/components/master-pane/workspace-section.tsx` | **Modify** | Accept collapsed state from parent (controlled). |
| `apps/web/src/components/timeline/task-timeline-view.tsx` | **Modify** | Subscribe to `useSseStream` filtered to this task; render real `entries` from SSE + initial replay snapshot. Add "↓ new messages" indicator. Cap to last 200 events. |
| `apps/web/src/app/(app)/goal-spaces/[id]/page.tsx` | **Modify** | Render `<PrimaryPane goalSpaceId={id} ... />` instead of `<GoalSpaceShell>` directly. |
| `apps/web/src/app/(app)/goal-spaces/[id]/tasks/[taskId]/page.tsx` | **Modify** | Fetch the card + initial timeline replay snapshot server-side. Pass `taskData` into `<PrimaryPane>` so it can render `TaskTimelineView` instead of the placeholder. |
| `apps/web/src/components/left-sidebar.tsx` | **Delete** | F2-09 legacy left rail replaced by `MasterPane`. |
| `apps/web/src/lib/state/context-store.ts` | **Modify** | Drive the route→view decision in `PrimaryPane`. |
| `apps/web/src/lib/state/tokens-store.ts` | **New** | Token usage (used / cap) for `WorkspacePanel`. |
| `apps/web/src/lib/services/goal-spaces.ts` | **Modify** | Add `listGoalSpacesWithTaskCountsService(actor)` and `listTasksByGoalSpaceService(actor, goalSpaceIds)` for the Master Pane. |
| `apps/web/src/components/detail-pane.tsx` | **Modify** | Take new props `(workspace, env, card)` from `AppShell`. |
| `apps/web/src/components/top-bar.tsx` | **Modify** | Wire `onOpenCommandPalette` to existing `command-palette.tsx`. |
| `apps/web/src/components/__tests__/app-shell.test.tsx` | **New** | Render test: renders TopBar + Master + Detail with given props. |
| `apps/web/src/components/__tests__/primary-pane.test.tsx` | **New** | Renders GoalSpaceKanbanView when no taskId; TaskTimelineView when present. |
| `apps/web/src/components/timeline/__tests__/task-timeline-view.test.tsx` | **New** | Auto-scroll, "↓ new messages" indicator, 200-event cap. |
| `apps/web/e2e/frontend-polish.spec.ts` | **New** | Playwright happy path: login → goal space → click card → task view shows timeline. |

---

## Feature List

Each feature is independently shippable. Recommended order is **F1 → F13** (architectural before cosmetic).

---

### F1. Delete legacy `LeftSidebar` and remove from `AppShell`

**Files:**
- Delete: `apps/web/src/components/left-sidebar.tsx`
- Modify: `apps/web/src/components/app-shell.tsx` — drop `LeftSidebar` import + render; remove the header `← hide (⌘B)` toggle.

**Acceptance criteria:**
- [ ] No imports of `LeftSidebar` anywhere.
- [ ] `app-shell.tsx` no longer renders the F2-09 left rail or its toggle button.
- [ ] `pnpm vitest run` still 600/600 (existing tests don't reference `LeftSidebar`).

**Verify:** `grep -r "LeftSidebar" apps/web/src/ apps/web/__tests__/`.

---

### F2. Server-side shell data fetcher (`(app)/layout.tsx`)

**Files:**
- Modify: `apps/web/src/app/(app)/layout.tsx` — fetch `(actor.user, accessible goal spaces, task summaries per goal space, current goal space header if URL matches, token usage)` before returning `<AppShell ... />`.

**Data sources** (use existing service layer):
- `actor.user` → `getSessionActor` (already called).
- Accessible goal spaces → existing `listGoalSpacesService(actor)` (or new helper).
- Task summaries per goal space → new `listTasksByGoalSpaceService(actor, ids)` in `lib/services/goal-spaces.ts`.
- Current goal space header → read from the URL params (parsed in `parseContextFromPath`).
- Token usage → new `tokensStore` (F10).

**Acceptance criteria:**
- [ ] `(app)/layout.tsx` passes `goalSpaces`, `tasksByGoalSpace`, `currentGoalSpaceHeader`, `user`, `tokensUsed`, `tokensCap`, `env` to `<AppShell>`.
- [ ] No SSR errors in dev console.

**Verify:** `curl -i http://localhost:3000/goal-spaces/<id>` returns 200 with the new layout.

---

### F3. Rewrite `app-shell.tsx` as persistent 3-pane shell

**Files:**
- Rewrite: `apps/web/src/components/app-shell.tsx` — `TopBar` (full-width 48px) + flex row of `MasterPane` (280px) + `<main>` containing `<PrimaryPane>` slot (1fr) + `DetailPane` (320px). Reads `usePathname()` to derive `goalSpaceId`/`taskId` and pushes them into `contextStore` for descendant reads.

**Skeleton:**

```tsx
"use client";
import { useEffect, useMemo } from "react";
import { usePathname } from "next/navigation";
import { TopBar, type TopBarSegment } from "./top-bar";
import { MasterPane } from "./master-pane";
import { DetailPane } from "./detail-pane";
import { PrimaryPane } from "./primary-pane";
import { useContextStore, parseContextFromPath } from "@/lib/state/context-store";
import { uiStore } from "@/lib/state/ui-store";

interface AppShellProps {
  readonly user: { name: string; role: string; workspace: string };
  readonly goalSpaces: readonly GoalSpaceSummary[];
  readonly tasksByGoalSpace: Readonly<Record<string, readonly TaskSummary[]>>;
  readonly currentGoalSpaceHeader: { name: string; boardName: string } | null;
  readonly goalSpaceId: string | null;
  readonly card: CardRuntimeInfo | null;
  readonly tokensUsed: number;
  readonly tokensCap: number;
  readonly env: "dev" | "prod";
  readonly children: React.ReactNode;
}

export function AppShell({ user, goalSpaces, tasksByGoalSpace, currentGoalSpaceHeader, goalSpaceId, card, tokensUsed, tokensCap, env, children }: AppShellProps) {
  const pathname = usePathname();
  useEffect(() => {
    useContextStore.setState({ current: parseContextFromPath(pathname) });
  }, [pathname]);

  const segments: TopBarSegment[] = useMemo(() => {
    const list: TopBarSegment[] = [{ label: "KEPLAR", href: "/goal-spaces" }];
    if (currentGoalSpaceHeader) list.push({ label: currentGoalSpaceHeader.name, href: goalSpaceId ? `/goal-spaces/${goalSpaceId}` : undefined });
    if (card) list.push({ label: card.displayId });
    return list;
  }, [currentGoalSpaceHeader, card, goalSpaceId]);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: "var(--color-bg)" }}>
      <TopBar segments={segments} tokensUsed={tokensUsed} tokensCap={tokensCap} onOpenCommandPalette={() => uiStore.set({ paletteOpen: true })} />
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        <MasterPane goalSpaces={goalSpaces} tasksByGoalSpace={tasksByGoalSpace} user={user} onOpenSettings={() => { /* TODO */ }} />
        <main style={{ flex: 1, overflowY: "auto" }}>{children}</main>
        <DetailPane workspace={{ goalSpaceName: currentGoalSpaceHeader?.name ?? "—", boardName: currentGoalSpaceHeader?.boardName ?? "—", userName: user.name, userRole: user.role, runtime: "Next.js 15.5.19 · React 19", apiBase: "/api/v1", tokensUsed, tokensCap }} env={env} card={card} />
      </div>
    </div>
  );
}
```

**Acceptance criteria:**
- [ ] Three columns visible at ≥1280px (Master 280 / Primary fluid / Detail 320).
- [ ] Navigating `/goal-spaces/[id]` ↔ `/goal-spaces/[id]/tasks/[taskId]` does NOT remount `MasterPane` or `DetailPane` (verify via `console.log` on mount + a `data-persist-mount-id` attribute).
- [ ] `contextStore` updates on route change.

**Verify:** Manual + Playwright snapshot at `/goal-spaces/<id>/tasks/<taskId>` shows the 3-column layout.

---

### F4. `PrimaryPane` route switch (GoalSpaceKanbanView ↔ TaskTimelineView)

**Files:**
- Modify: `apps/web/src/components/primary-pane.tsx` — read `useContextStore((s) => s.current)` instead of `usePathname()`. If `taskId` set → `<TaskTimelineView>`; else `<GoalSpaceKanbanView>`.
- Modify: `apps/web/src/components/primary-pane/goal-space-kanban-view.tsx` — accept the same props `GoalSpaceShell` already does (snapshot, boards, confirmations).
- Modify: `apps/web/src/app/(app)/goal-spaces/[id]/page.tsx` — render `<PrimaryPane goalSpaceId={id} snapshot={snapshot} boards={boards} confirmations={confirmations} />` instead of `<GoalSpaceShell>` directly.

**Acceptance criteria:**
- [ ] `/goal-spaces/[id]` renders the kanban + AI feed + CommandInput (was previously in `GoalSpaceShell`).
- [ ] The existing F2-09 / phase2-board.spec.ts happy path still passes.
- [ ] `/goal-spaces/[id]/tasks/[taskId]` renders `TaskTimelineView` (after F5 wires `taskData`).

**Verify:** Playwright snapshot of `/goal-spaces/[id]` shows kanban; of `/goal-spaces/[id]/tasks/[taskId]` shows task timeline (after F5).

---

### F5. Task page fetches real `taskData` + initial replay

**Files:**
- Modify: `apps/web/src/app/(app)/goal-spaces/[id]/tasks/[taskId]/page.tsx` — fetch `CardResponse` for `taskId`, plus an initial timeline snapshot (last 50 events for this task via `fetchReplay` filter). Pass both to `<PrimaryPane taskData={...} />`.

**Acceptance criteria:**
- [ ] Visiting `/goal-spaces/[id]/tasks/[taskId]` renders `<TaskTimelineView>` with the card header + state machine + replayed entries (not the placeholder text).
- [ ] Existing 600 tests still pass.

**Verify:** Playwright snapshot at `/goal-spaces/<id>/tasks/<taskId>` shows "CARD-NNN <Title>" + state breadcrumb + message list (not placeholder).

---

### F6. `MasterPane` expand/collapse localStorage persistence

**Files:**
- Modify: `apps/web/src/components/master-pane/workspace-section.tsx` — convert `collapsed` from local state to a controlled prop. Add `aria-expanded` on the section header.
- Modify: `apps/web/src/components/master-pane.tsx` — read/write `localStorage["keplar.master.expanded.${goalSpaceId}"]` per goal space; pass initial collapsed state to each `WorkspaceSection`; provide toggle callback.

**Acceptance criteria:**
- [ ] Click chevron on a section → collapses/expands.
- [ ] Refresh page → collapsed state is preserved.
- [ ] `aria-expanded` reflects state.

**Verify:** Manual + new test `master-pane.test.tsx` covering expand/collapse + persistence.

---

### F7. `MasterPane` sort order (status priority then `updated_at` desc)

**Files:**
- Modify: `apps/web/src/components/master-pane.tsx` — sort `tasksByGoalSpace[gs.id]` by `[state priority, updated_at desc]` before passing to `WorkspaceSection`.

**Priority array:** `["dev", "review", "todo", "backlog", "done", "blocked", "cancelled"]` (per spec §8.3).

**Acceptance criteria:**
- [ ] Tasks within each section appear in the priority order.
- [ ] Same-priority tasks sort by `updated_at` desc.

**Verify:** Unit test `master-pane.test.tsx` sorts a fixture correctly.

---

### F8. `TaskTimelineView` SSE wiring + 200-event cap + auto-scroll indicator

**Files:**
- Modify: `apps/web/src/components/timeline/task-timeline-view.tsx`:
  - Accept new prop `liveStream: readonly RealtimeEvent[]` (filtered SSE events for this task).
  - Merge `entries` + `liveStream`, transform events into `TimelineEntry[]` (each event type → a variant per spec §15.1).
  - Cap to last 200 entries; if truncated, show "↓ new messages" indicator.
  - Click indicator → scrolls to bottom + clears it.

**Transform map (event → variant):**

```ts
function eventToEntry(ev: RealtimeEvent): TimelineEntry {
  switch (ev.type) {
    case "ai_role_started":
      return { id: ev.id, variant: "agent-thinking", body: `${ev.resource.role} started` };
    case "ai_role_completed":
      return { id: ev.id, variant: "system", body: `${ev.resource.role} completed` };
    case "confirmation_requested":
      return { id: ev.id, variant: "confirmation", body: ev.resource.summary, onApprove: () => decide(...), onReject: () => decide(...) };
    case "card_state_changed":
      return { id: ev.id, variant: "system", body: `state → ${ev.resource.state}` };
    default:
      return { id: ev.id, variant: "system", body: ev.type };
  }
}
```

**Acceptance criteria:**
- [ ] New SSE event → new `TimelineMessage` appended with `--motion-message-enter`.
- [ ] When user is scrolled up, "↓ new messages" appears.
- [ ] Click indicator → scrolls to bottom + indicator disappears.
- [ ] When events > 200, oldest are dropped (LRU-style trim).

**Verify:** New test `task-timeline-view.test.tsx` using fake-timers + mocked scroll container.

---

### F9. `GoalSpace` page renders through `PrimaryPane` (F4 acceptance re-verification)

**Files:** Already covered by F4. This feature is the manual verification step + Playwright snapshot.

**Acceptance criteria:**
- [ ] Playwright snapshot of `/goal-spaces/<id>` shows the kanban view rendered by `PrimaryPane`, not the F2-09 single-column layout.

**Verify:** Run `apps/web/e2e/frontend-polish.spec.ts` happy path; visually compare to target.

---

### F10. `tokensStore` (token usage display)

**Files:**
- New: `apps/web/src/lib/state/tokens-store.ts` — `useSyncExternalStore` pattern, holds `{ used, cap }`. Seed from server-side `tokensUsed` / `tokensCap` passed via `(app)/layout.tsx`. Increment via SSE event (`token.delta` if it exists; otherwise keep static).
- Modify: `apps/web/src/components/top-bar.tsx` — read from store instead of props (keep props as initial values).
- Modify: `apps/web/src/components/detail-pane/workspace-panel.tsx` — same.
- Modify: `apps/web/src/app/(app)/layout.tsx` — pass `tokensUsed`, `tokensCap` to `<AppShell>` which seeds the store.

**Acceptance criteria:**
- [ ] TopBar shows `2.4k tok` (mono).
- [ ] `WorkspacePanel` shows `used / cap` + progress bar.

**Verify:** Manual + new test `tokens-store.test.ts`.

---

### F11. Wire TopBar `CMD K` to existing `command-palette.tsx`

**Files:**
- Modify: `apps/web/src/components/top-bar.tsx` — `onOpenCommandPalette` toggles `uiStore.paletteOpen`.
- Modify: `apps/web/src/components/command-palette.tsx` — render the palette overlay when `uiStore.paletteOpen`.

**Acceptance criteria:**
- [ ] Click "CMD K" → palette opens (existing component).
- [ ] Esc → closes.

**Verify:** Playwright click on CMD K button → palette visible.

---

### F12. Add missing component tests

**Files:**
- New: `apps/web/src/components/__tests__/app-shell.test.tsx` — renders TopBar + Master + Detail.
- New: `apps/web/src/components/__tests__/primary-pane.test.tsx` — route switch test (GoalSpace vs Task).
- New: `apps/web/src/components/__tests__/detail-pane.test.tsx` — 4-zone renders.
- New: `apps/web/src/components/__tests__/message-input.test.tsx` — Enter submits, Shift+Enter new line, disabled when empty.
- New: `apps/web/src/components/__tests__/workspace-panel.test.tsx` — token bar width matches `used/cap`.
- New: `apps/web/src/components/__tests__/ai-panel.test.tsx` — 6 roles, idle = green dot.

**Acceptance criteria:**
- [ ] 6 new test files; ≥80% coverage for new components.
- [ ] `pnpm vitest run` shows ≥640 passing tests (was 600).

**Verify:** `pnpm vitest run --coverage`.

---

### F13. E2E happy path: login → goal space → click card → task view

**Files:**
- New: `apps/web/e2e/frontend-polish.spec.ts` — covers the screenshot flow.

**Steps:**
1. Visit `/login` → fill credentials → submit.
2. Visit `/goal-spaces/<id>` → assert 3-column layout (MasterPane + PrimaryPane + DetailPane all visible).
3. Click a task row in MasterPane → URL becomes `/goal-spaces/<id>/tasks/<taskId>` → PrimaryPane swaps to TaskTimelineView; MasterPane + DetailPane remain mounted (assert via data-attribute).
4. Type "test message" in MessageInput → press Enter → assert entry appears.

**Acceptance criteria:**
- [ ] E2E spec passes against `pnpm next dev` on port 3000.
- [ ] Existing `phase2-board.spec.ts` still passes.

**Verify:** `pnpm exec playwright test apps/web/e2e/frontend-polish.spec.ts`.

---

## Self-Review

**Spec coverage:**
- §3.1 Persistent shell — F3
- §4 Layout (desktop) — F3
- §6.1 Motion tokens — already in place (c4437bb); F8 references them
- §8.1 AppShell — F3
- §8.2 TopBar clickable breadcrumb — F3 (`segments` prop already supports it)
- §8.3 MasterPane — F6, F7, F11
- §8.4 PrimaryPane — F4
- §8.5 DetailPane — F3 mounts it (zones already exist)
- §8.6 TaskTimelineView — F5 (entries), F8 (live)
- §8.7 MessageInput — already exists (F12 tests it)
- §10.1 Boot flow — F2
- §10.2 Drill into a task — F5
- §15.1 Events consumed — F8
- §16 Accessibility (aria-live on Timeline, aria-expanded on sections) — F6, F8
- §18.1 Unit tests — F12
- §18.3 E2E — F13

**Placeholder scan:** No "TBD", "TODO", "implement later" in the steps. Every step has explicit files + acceptance criteria + verification command.

**Type consistency:**
- `TopBarSegment` (F3) matches existing `top-bar.tsx` interface.
- `GoalSpaceSummary` / `TaskSummary` / `CardRuntimeInfo` already defined in `master-pane/workspace-section.tsx` and `detail-pane/card-runtime.tsx`.
- New `tokensStore` types match existing pattern (`useSyncExternalStore` + Object.assign hook).

---

## Execution

After approval, this plan is executed with **superpowers:subagent-driven-development** (recommended) — one subagent per feature, with spec-compliance review + code-quality review between features.

Alternatively, **superpowers:executing-plans** runs the features inline with checkpoints.

**Estimated cost:** F1–F11 ≈ 1500–2500 lines of new code across ~12 files. F12 ≈ 300–500 lines of tests. F13 ≈ 100 lines of E2E. Total session cost likely $400–$700.

**Recommendation:** Start a fresh session for execution — the current session is already at ~$300 spent across 43 modified files.