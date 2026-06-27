# Request Analysis Tasks

Change ID: `20260626-phase3-node-board-create-ui`
Status: pending_human_approval

## Implementation Tasks

- [ ] Add `CreateNodeBoardForm` client component.
  - Verify: component posts to `/api/v1/goal-spaces/${goalSpaceId}/node-boards`, handles success, API envelope errors, and thrown errors.
- [ ] Mount the form in `goal-space-shell.tsx` inside the `boards.length === 0` branch.
  - Verify: shell imports the form, renders it alongside the existing `EmptyState` caption, and keeps `NodeBoardView` for `boards.length > 0`.
- [ ] Keep UI tokenized and compact.
  - Verify: scan P3-03 files for hardcoded hex and tracking/letter-spacing classes.

## Test Tasks

- [ ] Add UI test for successful node-board creation.
  - Verify: fills `Board key` and `Board name`, clicks `Create node board`, checks fetch URL, payload, `method: "POST"`, `credentials: "include"`, and `router.refresh()` called.
- [ ] Add UI test for API envelope error.
  - Verify: renders `envelope.error.message` and does not call `router.refresh()`.
- [ ] Add UI test for thrown fetch error.
  - Verify: renders `Unable to create node board.` and does not call `router.refresh()`.

## Documentation Tasks

- [ ] Create and maintain required harness artifacts.
  - Verify: `request_analysis/{spec.md,tasks.md,feature_list.json}`, `sprint_progress.md`, `review/findings.md`, `implementation/notes.md`, `testing/results.md`, `delivery/summary.md`, `handoff.md`.

## Sequencing (TDD)

1. Step: Create request analysis and review artifacts.
   Verify: artifacts exist under the P3-03 change folder.
2. Step: Add focused failing UI test (RED).
   Verify: focused test command fails because component is not yet implemented (missing import).
3. Step: Implement `CreateNodeBoardForm` to satisfy the test (GREEN).
   Verify: focused test passes for success, API envelope error, and thrown error.
4. Step: Mount form in `goal-space-shell.tsx`.
   Verify: typecheck and lint pass; existing shell tests unaffected.
5. Step: Run requested verification commands.
   Verify: results recorded in `testing/results.md`.
6. Step: Prepare delivery and handoff artifacts.
   Verify: final status, files, risks, and command outcomes are recorded.

## Dependencies

- Existing `POST /api/v1/goal-spaces/{goalSpaceId}/node-boards` route.
- Existing `createNodeBoard` API wrapper at `apps/web/src/lib/api/node-boards.ts`.
- Existing `GoalSpaceShell` `boards.length === 0` branch in `apps/web/src/components/goal-space-shell.tsx`.
- Existing Next router refresh behavior.
- Existing Vitest and Testing Library setup.

## Stop Condition

Stop after Phase 1 Request Analysis artifacts are written. Wait for explicit human approval (e.g., "approved", "执行", "继续实现") before starting Phase 3 Implementation. Do not commit.