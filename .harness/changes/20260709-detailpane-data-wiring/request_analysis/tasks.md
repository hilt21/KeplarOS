# Request Analysis Tasks

Change ID: `20260709-detailpane-data-wiring`
Status: request_analysis

> **Execution source-of-truth:** The bite-sized TDD steps, code snippets, and exact `git commit` messages for this change live in [docs/superpowers/plans/2026-07-09-detailpane-data-wiring.md](../../../docs/superpowers/plans/2026-07-09-detailpane-data-wiring.md). This file is the **scope tracker** at AOR granularity (one bullet per task group); the superpowers plan is the **executor**.
>
> **Suggested execution mode:** `superpowers:subagent-driven-development` (fresh subagent per superpowers Task, two-stage review between tasks). 7 superpowers tasks = 7 subagent dispatches.

## Implementation Tasks

- [ ] **Task 1 — `useAIAgentsSync` bridge hook (H1)**
  - Create `apps/web/src/lib/realtime/ai-agents-sync.ts` exporting `useAIAgentsSync(goalSpaceId: string | null): void`.
  - Internally subscribes to `boardStore.subscribe(goalSpaceId, ...)` and forwards `ai_role_started/completed/failed` events to `useAgentsStore.getState().setStatus(role, status, cardId)`.
  - Validates `event.resource.id` against the `AgentRoleId` set; warns and ignores unknown roles.
  - Replays already-stored events on mount.
  - **Verify:** superpowers Task 1.2 — `pnpm --filter @keplar/web test -- src/lib/realtime/__tests__/ai-agents-sync.test.ts` is green (5 cases).

- [ ] **Task 2 — Mount the hook in AppShell (H1)**
  - Modify `apps/web/src/components/app-shell.tsx`: import `useAIAgentsSync`, call `useAIAgentsSync(goalSpaceId)` inside `AppShell(...)`.
  - Extend `apps/web/src/components/__tests__/app-shell.test.tsx` with one integration test that fires an `ai_role_started` SSE event and asserts `byRole.dev_crafter.status === "running"`.
  - **Verify:** superpowers Task 2.2 — full test suite green; no regression in `master-pane.test.tsx` / `detail-pane.test.tsx` / `app-shell.test.tsx`.

- [ ] **Task 3 — `useCurrentGoalSpaceHeader` hook (H2)**
  - Create `apps/web/src/lib/state/current-goal-space-header.ts` exporting `useCurrentGoalSpaceHeader({ goalSpaces, nodeBoardsByGs?, goalSpaceId }): { name, boardName } | null`.
  - Resolution priority: explicit `goalSpaceId` prop wins over `usePathname()` parsing.
  - Returns `null` when pathname is not under `/goal-spaces/` or when the resolved id is not in `goalSpaces`.
  - **Verify:** superpowers Task 3.2 — 5 Vitest cases green.

- [ ] **Task 4 — Consume derived header in AppShell (H2)**
  - Add optional `nodeBoardsByGoalSpace` prop to `AppShellProps`, defaulting to `{}`.
  - Inside AppShell, call `useCurrentGoalSpaceHeader({ goalSpaces, nodeBoardsByGs: nodeBoardsByGoalSpace, goalSpaceId })`.
  - Pass the derived header into `<DetailPane workspace={{ goalSpaceName, boardName, ... }} />`.
  - Modify `apps/web/src/components/__tests__/app-shell.test.tsx` with one integration test asserting the goal space name appears in the rendered output.
  - Modify `apps/web/src/app/(app)/layout.tsx` to pass `nodeBoardsByGoalSpace={{}}` (placeholder; F11/F12 will populate).
  - **Verify:** superpowers Task 4.2 — full test suite green.

- [ ] **Task 5 — Extract `apiBase` and `runtime` to constants (M1 + M2)**
  - Create `apps/web/src/lib/constants/api.ts` exporting `API_BASE` (`process.env.NEXT_PUBLIC_API_BASE ?? "/api/v1"`).
  - Create `apps/web/src/lib/constants/runtime.ts` exporting `RUNTIME_LABEL` (`process.env.NEXT_PUBLIC_RUNTIME_LABEL ?? "Next.js · React"`).
  - Replace literals in `app-shell.tsx` DetailPane block.
  - **Verify:** superpowers Task 5.1 — `pnpm --filter @keplar/web test` green; existing `workspace-panel.test.tsx` snapshots unchanged.

- [ ] **Task 6 — Extract tokens placeholders + F10 marker (M3)**
  - Create `apps/web/src/lib/constants/tokens.ts` exporting `TOKENS_PLACEHOLDER_USED = 0` and `TOKENS_PLACEHOLDER_CAP = 100000`, with `TODO(F10)` comment.
  - Replace inline constants in `apps/web/src/app/(app)/layout.tsx` (remove `const TOKENS_CAP_PLACEHOLDER = 100000;`).
  - **Verify:** superpowers Task 6.2 — `pnpm --filter @keplar/web test` green.

- [ ] **Task 7 — Final validation**
  - Run `pnpm check` (typecheck + lint + test + build + format:check).
  - Run `pnpm e2e` to confirm no regression in master-pane / detail-pane / workspace specs.
  - **Verify:** superpowers Task 7.1 — all green; optional audit-note commit if `.reports/codemap-diff.txt` was touched.

## Test Tasks

- [ ] **Test 1 — `ai-agents-sync.test.ts` (5 cases)**
  - Verify: started → running / completed → idle / failed → error / cross-GS isolation / unknown-role warn.
- [ ] **Test 2 — `current-goal-space-header.test.ts` (5 cases)**
  - Verify: non-GS path → null / unknown id → null / known id → `{name, boardName}` / empty boards → `""` / explicit prop overrides URL.
- [ ] **Test 3 — `app-shell.test.tsx` integration (2 new cases)**
  - Verify: SSE forward + derived header render.
- [ ] **Test 4 — Existing test suites remain green**
  - Verify: `pnpm --filter @keplar/web test` — no regression.

## Documentation Tasks

- [ ] **Doc 1 — Spec + plan + tasks in change folder**
  - Add: this file + the spec + the superpowers plan (already created this session).
  - Verify: `ls .harness/changes/20260709-detailpane-data-wiring/request_analysis/` shows both `spec.md` and `tasks.md`.
- [ ] **Doc 2 — Audit-note append (optional)**
  - If `.reports/codemap-diff.txt` exists, append a post-implementation note summarizing the H1/H2/M1-M3 outcomes.
  - Verify: `tail .reports/codemap-diff.txt` shows the new note (or skip silently if file does not exist).

## Sequencing

1. **Implementation order (strict):** Task 1 → 2 → 3 → 4 → 5 → 6 → 7.
   - Task 1.2 (bridge) is the foundation for Task 2 (mounting).
   - Task 3.2 (header hook) is the foundation for Task 4 (consumption).
   - Task 5 + 6 are independent of Tasks 1–4 and can be parallelized if multiple agents are available, but they are simple enough to do sequentially.
   - Task 7 runs only after all of the above.
   - Verify: `git log --oneline master..HEAD` shows 7 commits in order.
2. **Test sequencing:** Write the failing test before each implementation (per superpowers plan TDD discipline). Do not batch tests with implementations.
   - Verify: Each commit's diff includes both the test file and the implementation file together.
3. **Commit cadence:** One commit per superpowers task (7 commits total). Commit messages must follow `feat(scope): ...` / `refactor(scope): ...` convention.
   - Verify: `git log --oneline master..HEAD | wc -l` ≥ 7.

## Dependencies

- **Dependency:** `boardStore`, `useBoardStore` (existing — `apps/web/src/lib/state/board-store.ts`) for SSE event source.
- **Dependency:** `useAgentsStore`, `AgentRoleId`, `AgentStatus` (existing — `apps/web/src/lib/state/agents-store.ts`) for the destination store.
- **Dependency:** `RealtimeEvent`, `RealtimeEventType` types (existing — `apps/web/src/lib/api/types.ts`).
- **Dependency:** `usePathname` from `next/navigation` (Next.js 15 built-in).
- **Dependency:** `parseContextFromPath` (existing — `apps/web/src/lib/state/context-store.ts:91`) for URL → goal-space-id resolution.
- **Dependency:** `AppShellGoalSpaceSummary` type (existing — `apps/web/src/components/app-shell.tsx`).
- **No new package dependencies.** No migration. No env var additions beyond the optional `NEXT_PUBLIC_*` overrides.

## Stop Condition

Stop after writing request analysis artifacts and wait for human approval. Do not modify any application source, test, config, or doc outside this change folder until explicit human approval (per CLAUDE.md Application Owner Runtime).