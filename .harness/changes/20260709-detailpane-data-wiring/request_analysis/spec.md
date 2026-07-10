# Request Analysis Spec

Change ID: `20260709-detailpane-data-wiring`
Status: request_analysis

## Request Summary

The DetailPane right-rail (`apps/web/src/components/detail-pane/workspace-panel.tsx` and `apps/web/src/components/detail-pane/ai-panel.tsx`) currently renders 12 UI elements with **broken data wiring**. Of those, 11 are code-complete and test-complete, but their data sources are either dead stores, hardcoded literals, or placeholders.

Specifically:
- The 6 `AI ROLES` rows always display `idle` because `agentsStore.setStatus` has zero production callers — SSE events flow into `boardStore` but are never dispatched to `agentsStore`.
- The `goal` and `board` rows in the WORKSPACE panel always show `—` because `currentGoalSpaceHeader` is hardcoded to `null` in `(app)/layout.tsx`, leaving the client-side derivation (already designed in F3) unimplemented.
- The `runtime`, `api`, and `tokens` rows are hardcoded literals in `app-shell.tsx` (or placeholder caps in `(app)/layout.tsx`) without any indirection for future overrides.

This change wires each of those data sources to real backing state so the DetailPane accurately reflects runtime conditions. It does **not** change public APIs, the database schema, or the visual design — only the data plumbing.

The detailed TDD task breakdown (bite-sized steps, test-first, commit-per-task) lives in [docs/superpowers/plans/2026-07-09-detailpane-data-wiring.md](../../../docs/superpowers/plans/2026-07-09-detailpane-data-wiring.md). This spec is the **scope and acceptance** companion; the superpowers plan is the **execution** companion.

## Assumptions

- `boardStore` (in `apps/web/src/lib/state/board-store.ts`) is the canonical place where SSE events are deduped and stored. Existing consumers (`timeline/task-timeline-view.tsx`, `execution-status.tsx`, `goal-space-shell.tsx`) read from it directly; we add a new consumer that derives `agentsStore` from it.
- `agentsStore.setStatus` already has the right idempotency semantics (the implementation in `agents-store.ts:54-56` no-ops on same status + same taskId), so the bridge can re-fire safely on replay.
- The actor's `goalSpaces` list is already fetched server-side by `(app)/layout.tsx:58` (`listGoalSpacesWithTasksService`) and passed via props to `<AppShellWrapper>`. The new `useCurrentGoalSpaceHeader` hook reads from that prop directly; no extra fetch is required.
- Node boards per goal space are **not** yet fetched by `(app)/layout.tsx`. For this change we pass an empty map and the hook falls back to `boardName: ""`. A follow-up F11/F12 task should populate that map from a real service.
- `DESIGN.md` rules (CSS variable tokens, no hardcoded hex/px in components) are not violated by this change — we are only adding state hooks and replacing literals.

## Scope

### In Scope

- New file: `apps/web/src/lib/realtime/ai-agents-sync.ts` — `useAIAgentsSync` hook bridging SSE → agentsStore.
- New file: `apps/web/src/lib/realtime/__tests__/ai-agents-sync.test.ts` — 5 Vitest cases covering started/completed/failed/cross-GS/unknown-role.
- New file: `apps/web/src/lib/state/current-goal-space-header.ts` — `useCurrentGoalSpaceHeader` hook deriving `{ name, boardName }` from URL + props.
- New file: `apps/web/src/lib/state/__tests__/current-goal-space-header.test.ts` — 5 Vitest cases.
- New file: `apps/web/src/lib/constants/api.ts` — `API_BASE` constant with `NEXT_PUBLIC_API_BASE` env override.
- New file: `apps/web/src/lib/constants/runtime.ts` — `RUNTIME_LABEL` constant with `NEXT_PUBLIC_RUNTIME_LABEL` env override.
- New file: `apps/web/src/lib/constants/tokens.ts` — `TOKENS_PLACEHOLDER_USED` + `TOKENS_PLACEHOLDER_CAP` constants with explicit `TODO(F10)` marker.
- Modify: `apps/web/src/components/app-shell.tsx` — mount `useAIAgentsSync`, consume derived header, swap literals for constants.
- Modify: `apps/web/src/components/__tests__/app-shell.test.tsx` — add 2 new test cases (SSE forward, derived header).
- Modify: `apps/web/src/app/(app)/layout.tsx` — pass `nodeBoardsByGoalSpace={{}}`, use tokens constants.
- Add: `.harness/changes/20260709-detailpane-data-wiring/` containing this spec, tasks file, and delivery artifacts.

### Out of Scope

- Real token metering (F10). The TODO marker replaces the inline comment; no new endpoint, no schema change.
- Populating `nodeBoardsByGoalSpace` from a real service. Deferred to F11/F12. The empty-map fallback keeps the UI from crashing.
- Renaming `WORKSPACES` (plural, master pane) → `WORKSPACE` (singular, detail pane) for consistency. Out of scope; this is a naming change, not a wiring fix.
- Refactoring `MasterPane` to also derive state from the same hook. Out of scope; the audit found no broken wiring in the master pane.
- Any change to the public REST API surface, the database schema, or authorization rules.

## Affected Areas

- API: **none** (no route, schema, or DTO changes).
- Data model: **none** (no migration).
- Authorization: **none** (no role/permission changes; the new hooks only read state already gated by their callers).
- UI/UX: **only data wiring** — the rendered DOM is identical when the underlying state matches the prior hardcoded/placeholder values, so visual snapshots should not change. The behavior changes are:
  - `AIPanel` will show `running` / `error` states when real SSE events arrive (vs. permanent `idle`).
  - `WorkspacePanel`'s `goal` and `board` rows will show the actual goal space + board name when on a `/goal-spaces/:id` route (vs. permanent `—`).
  - `WorkspacePanel`'s `runtime` and `api` rows continue to show the same strings by default but can now be overridden via `NEXT_PUBLIC_*` env vars (no UI difference unless overridden).
  - `WorkspacePanel`'s `tokens` row continues to show `0 / 100,000` but is now sourced from a named constant with a `TODO(F10)` comment.
- Tests: **additive only** — new test files + new test cases in existing files. No existing test is expected to break.
- Docs: this spec + the companion superpowers plan + the audit recap that already lives in the plan's header.

## Acceptance Criteria

- [ ] `pnpm --filter @keplar/web test` is fully green.
- [ ] `pnpm --filter @keplar/web typecheck` passes with no errors.
- [ ] `pnpm --filter @keplar/web lint` passes with no errors.
- [ ] `pnpm --filter @keplar/web build` succeeds.
- [ ] `pnpm --filter @keplar/web e2e` is fully green (no regression in master-pane / detail-pane / workspace specs).
- [ ] `AIPanel` reflects real AI status: in a test that mounts AppShell, fires an `ai_role_started` SSE event for `dev_crafter` into `boardStore`, the next render reads `byRole.dev_crafter.status === "running"` and `currentTaskId === <cardId>`.
- [ ] `WorkspacePanel` shows the goal space name when on `/goal-spaces/:id`: in a test that renders AppShell with `goalSpaces=[{id: "gs-x", name: "X"}]` and `goalSpaceId="gs-x"`, the string `"X"` is present in the rendered output.
- [ ] `goal` and `board` rows in the DetailPane no longer fall back to `"—"` for an authenticated actor viewing an existing goal space (manual smoke check: log in, navigate to `/goal-spaces/:id`, confirm both rows render the real name).
- [ ] `runtime` and `api` rows continue to render `"Next.js · React"` and `"/api/v1"` by default (existing snapshots still pass) but respond to `NEXT_PUBLIC_RUNTIME_LABEL` and `NEXT_PUBLIC_API_BASE` env vars (verified by a quick `process.env` override in a test or by manual run).
- [ ] `apps/web/src/lib/constants/tokens.ts` exports `TOKENS_PLACEHOLDER_USED` and `TOKENS_PLACEHOLDER_CAP` with a `TODO(F10)` comment.
- [ ] Every commit message follows the repo's conventional-commits style (`feat:`, `refactor:`).
- [ ] All 7 commits are present in `git log master..HEAD` after implementation.

## Risks

- **Risk:** The `useAIAgentsSync` hook re-fires all stored events on mount, which may overwrite later events if events arrive out-of-order.
  **Mitigation:** `agentsStore.setStatus` is idempotent on `(role, status, taskId)`; replays of an older `ai_role_started` after a newer `ai_role_completed` will be ignored if `(status, taskId)` already match. The hook also filters events by `goal_space_id` so cross-GS contamination is impossible. Test cases in Task 1.1 cover the cross-GS rejection.
- **Risk:** `useCurrentGoalSpaceHeader` could trigger a re-render storm on every keystroke in the URL if `usePathname` returns a new string each render.
  **Mitigation:** `useMemo` on the derivation result; the hook only recomputes when one of its 4 deps actually changes. Test Task 3.1 covers the memoization contract indirectly by reusing a single render across multiple path reads.
- **Risk:** The new `nodeBoardsByGoalSpace` prop on `AppShellProps` is optional; existing tests may not pass it, which could break the type checker.
  **Mitigation:** Marked as optional with a `= {}` default in the destructuring (Task 4.1, Step 2). Existing tests do not pass it and continue to compile.
- **Risk:** Replacing `"Next.js · React"` and `"/api/v1"` literals in `app-shell.tsx` could break the existing workspace-panel test snapshots.
  **Mitigation:** The default values for `RUNTIME_LABEL` and `API_BASE` are exactly the prior literals; existing tests that assert those strings continue to pass without modification (verified at Task 5.1 Step 3).

## Open Questions

- None blocking. Two follow-ups for after this change merges:
  - Should `nodeBoardsByGoalSpace` be plumbed through `listGoalSpacesWithTasksService` to also return boards, or added as a new `listNodeBoardsService`? (F11/F12 owner decides.)
  - Should the AI panel also surface `elapsedMs` from the running event so the user sees a live timer (currently only `status: "running"` is forwarded, but the SSE event may carry a `startedAt` timestamp)? (UI/UX owner decides — likely a separate spec.)

## Approval Gate

Request Analysis must stop here until explicit human approval is given.