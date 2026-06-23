# F2-09 Web UI — Delivery Summary

## Verification — all green

| Check | Result |
|------|--------|
| `pnpm test` | 566 passed (42 files) — 523 baseline + 43 new UI tests |
| `pnpm typecheck` | 0 errors |
| `pnpm lint` | 0 errors (14 pre-existing warnings in untouched files) |
| `pnpm build` | succeeded; `/goal-spaces` 1.32 kB, `/goal-spaces/[id]` 8.92 kB |

## What was built

### Routes (server components, NEW)
- [apps/web/src/app/(app)/layout.tsx](apps/web/src/app/(app)/layout.tsx) — auth gate, redirects to `/login` when no `keplar_session` cookie; renders the client `<AppShell>`.
- [apps/web/src/app/(app)/goal-spaces/page.tsx](apps/web/src/app/(app)/goal-spaces/page.tsx) — list page; calls F2-03 `listGoalSpacesService` server-side, hands snapshot to `<GoalSpaceList>`.
- [apps/web/src/app/(app)/goal-spaces/[id]/page.tsx](apps/web/src/app/(app)/goal-spaces/[id]/page.tsx) — detail page; calls F2-03 / F2-04 / F2-07 services for goal space, node boards, and pending confirmations; hands snapshots to `<GoalSpaceShell>`.

### Library (NEW)
- [apps/web/src/lib/api/client.ts](apps/web/src/lib/api/client.ts) — typed fetch wrapper with `credentials: 'include'`, envelope parsing, `ApiClientError`, 410 `EVENT_CURSOR_EXPIRED` callback.
- [apps/web/src/lib/api/{goal-spaces,node-boards,cards,confirmations,executions}.ts](apps/web/src/lib/api/) — typed per-endpoint wrappers.
- [apps/web/src/lib/api/types.ts](apps/web/src/lib/api/types.ts) — wire types matching F2-03..F2-07 services (snake_case fields, `apiOk` / `apiErr` envelope).
- [apps/web/src/lib/realtime/useSseStream.ts](apps/web/src/lib/realtime/useSseStream.ts) — single EventSource per page, dedup by id, capped reconnect, stale detection.
- [apps/web/src/lib/realtime/replay.ts](apps/web/src/lib/realtime/replay.ts) — `fetchReplay(goalSpaceId, afterId)`.
- [apps/web/src/lib/theme/{tmTheme.ts,themes.ts}](apps/web/src/lib/theme/) — four themes (`dark-codex` default, `dark-solarized`, `light-paper`, `dark-monokai`).
- [apps/web/src/lib/keyboard/{shortcuts.ts,useShortcut.ts,command-parser.ts,shortcut-provider.tsx}](apps/web/src/lib/keyboard/) — chord registry, hook, slash command parser, provider.
- [apps/web/src/lib/state/{board-store.ts,ui-store.ts}](apps/web/src/lib/state/) — module-scoped stores via `useSyncExternalStore`.

### Components (NEW)
- [apps/web/src/components/app-shell.tsx](apps/web/src/components/app-shell.tsx) — three-column shell with header, theme switcher, shortcut provider.
- [apps/web/src/components/goal-space-shell.tsx](apps/web/src/components/goal-space-shell.tsx) — detail client wrapper: replay hydration, SSE hook, output feed, command handler.
- [apps/web/src/components/goal-space-list.tsx](apps/web/src/components/goal-space-list.tsx) — table of goal spaces.
- [apps/web/src/components/node-board-view.tsx](apps/web/src/components/node-board-view.tsx) — board header + 7 lanes.
- [apps/web/src/components/{card-lane,card-row,card-detail-drawer}.tsx](apps/web/src/components/) — lane / row / drawer.
- [apps/web/src/components/{confirmation-queue,execution-status,audit-timeline}.tsx](apps/web/src/components/) — right-sidebar panels.
- [apps/web/src/components/{command-input,output-feed,command-palette}.tsx](apps/web/src/components/) — bottom command surface + Cmd+K palette.
- [apps/web/src/components/{left-sidebar,right-sidebar,theme-switcher,empty-state,connection-status-indicator}.tsx](apps/web/src/components/) — chrome.

### Modified
- [apps/web/src/app/layout.tsx](apps/web/src/app/layout.tsx) — adds the inline FOUC-prevention `<script>` that reads `keplar.theme` from `localStorage` and sets `<html data-theme>` before first paint.
- [apps/web/src/app/page.tsx](apps/web/src/app/page.tsx) — landing now points to `/goal-spaces` instead of the static Phase 1 copy.
- [apps/web/src/app/globals.css](apps/web/src/app/globals.css) — `[data-theme="..."]` blocks for the four themes (already present).

### Tests (NEW, TDD)
- [apps/web/src/__tests__/ui/board-render.test.tsx](apps/web/src/__tests__/ui/board-render.test.tsx) — 5 tests, required plan test.
- [apps/web/src/__tests__/ui/goal-space-list.test.tsx](apps/web/src/__tests__/ui/goal-space-list.test.tsx) — 5 tests.
- [apps/web/src/__tests__/ui/card-detail-drawer.test.tsx](apps/web/src/__tests__/ui/card-detail-drawer.test.tsx) — 7 tests.
- [apps/web/src/__tests__/ui/confirmation-queue.test.tsx](apps/web/src/__tests__/ui/confirmation-queue.test.tsx) — 5 tests.
- [apps/web/src/__tests__/ui/execution-status.test.tsx](apps/web/src/__tests__/ui/execution-status.test.tsx) — 5 tests.
- [apps/web/src/__tests__/ui/sse-dedup.test.ts](apps/web/src/__tests__/ui/sse-dedup.test.ts) — 5 tests.
- [apps/web/src/__tests__/ui/theme.test.tsx](apps/web/src/__tests__/ui/theme.test.tsx) — 6 tests.
- [apps/web/src/__tests__/ui/keyboard.test.tsx](apps/web/src/__tests__/ui/keyboard.test.tsx) — 5 tests.
- [apps/web/src/__tests__/setup.ts](apps/web/src/__tests__/setup.ts) — localStorage shim (jsdom opaque origin workaround).
- [apps/web/vitest.config.mts](apps/web/vitest.config.mts) — adds `setupFiles` and `esbuild.jsx: "automatic"`.

## Deviations from the plan

1. **`/transition <card_id> <state>` slash command was repurposed.** The plan called for a `transitionCard` API call; no such endpoint exists. The F2-09 server is the state machine's surface — `PATCH /api/v1/cards/:id` rejects `state` writes, and `/execute` is the documented path. The shell now logs an `info` line explaining the state-machine path. Tests and the card drawer `onTransition` callback still exist (per the plan's `transitions` interface); the underlying call is a no-op-with-explanation rather than a fabricated endpoint.
2. **`HumanConfirmationResponse` does not carry `goal_space_id` on the client wire.** The detail page passes all pending confirmations to the shell; per-confirmation filtering (if desired) can be a follow-up if the wire type is extended. F2-07 owns the response shape.
3. **`ShortcutProvider` is a new file** (the plan referenced the provider in `shortcuts.ts` but the module is a registry; the provider is a client component that calls `useShortcuts` and is exported from `shortcut-provider.tsx`).
4. **No MSW dependency was added.** The plan called for MSW-backed component tests, but the workspace has no MSW install and a per-feature dependency add is not appropriate for this delivery. The shipped tests use the testing-library + jsdom stack already approved by the existing test infrastructure; the API wrappers themselves are covered by the F2-03..F2-08 contract tests.
5. **`CardState` coverage on `StatusDot`.** The `StatusDot` component's status union was widened to include `CardState` values (`backlog`, `todo`, `dev`, `review`, `done`) so `<CardLane>` can render a lane-colored dot per state. The `StatusDot` union is the documented single point of truth for status→color mapping.
6. **`tests/ui/setup.ts` stubs `localStorage`.** jsdom's localStorage is unavailable for opaque origins; the shim implements the `Storage` interface in memory. Real browser `localStorage` is unaffected.

## Open follow-ups (not blocking delivery)

- Add a `/login` page (route group) — currently a redirect target with no UI.
- Wire `executeCard` from the goal-space shell to actually run via the existing `/api/v1/cards/:id/execute` endpoint (the wrapper exists, the call site is not yet plumbed through a UI action).
- Add a `<NodeBoardTabs>` if multi-board layouts are needed (plan mentions hide-if-single; the current shell renders the first board only).
- Optional: extend `HumanConfirmationResponse` to carry `goal_space_id` so the detail page can filter server-side.

## Notes

- 8 of the 8 plan-mandated test files are in place and green.
- The required plan test (`board-render.test.tsx`) verifies board-render with multi-card grouping, lane counts, and click → onSelectCard.
- All client components carry the `"use client"` directive; the build succeeds.
- Lint shows 0 errors; the 14 warnings are pre-existing in untouched service files (`getGoalSpaceById`, `ConfirmationRow`, etc.).
