# Request Analysis Spec

Change ID: `20260626-phase3-node-board-create-ui`
Status: pending_human_approval

## Request Summary

Implement P3-03 Node-Board Creation UI in the existing web app. The feature adds a compact client-side form on the existing goal-space detail page so an authenticated user can create the first node board for a goal space through the existing `/api/v1/goal-spaces/{goalSpaceId}/node-boards` endpoint.

This feature only renders a node-board creation surface on the goal-space detail page when the goal space has zero boards. It does not change the backend, API, database, schema, migration, authorization, SSE, or replay behavior. It does not implement P3-04 browser-first E2E.

## Assumptions

- P3-02 (goal-space creation UI) is complete and reviewed; P3-02's `CreateGoalSpaceForm` exists and is the visual reference.
- The existing `createNodeBoard(goalSpaceId, { key, name, description? })` API wrapper in `apps/web/src/lib/api/node-boards.ts` is the only client entry point.
- The empty-board state currently lives in `apps/web/src/components/goal-space-shell.tsx` as `boards.length === 0 ? <EmptyState .../> : <NodeBoardView .../>`.
- The user's "Use TDD to develop P3-03" instruction is explicit approval to proceed through Phase 1 Request Analysis only, then STOP for explicit implementation approval per the Application Owner Runtime.
- Existing P3-00 / P3-01 / P3-02 working-tree edits are owned by other work and must not be reverted or reformatted.

## Scope

### In Scope

- Add `apps/web/src/components/create-node-board-form.tsx` (client component, tokenized styling consistent with `CreateGoalSpaceForm`).
- Add `apps/web/src/__tests__/ui/create-node-board-form.test.tsx` covering success, API envelope error, and thrown fetch error.
- Modify `apps/web/src/components/goal-space-shell.tsx` so the `boards.length === 0` branch renders the empty-state caption and the new form together, with the existing `NodeBoardView` kept for `boards.length > 0`.
- Create required harness artifacts under `.harness/changes/20260626-phase3-node-board-create-ui/`.

### Out of Scope

- No backend, API route, service, repository, database, schema, migration, or authorization changes.
- No changes to `apps/web/src/lib/api/node-boards.ts` (existing wrapper is sufficient).
- No changes to `apps/web/src/components/empty-state.tsx`.
- No P3-04 browser-first E2E rewrites; the existing Playwright spec still pre-creates the goal space.
- No changes to command palette, SSE hook, replay hydration, or store state machines.
- No commits.

## Affected Areas

- API: consumes existing `POST /api/v1/goal-spaces/{goalSpaceId}/node-boards`; no API change.
- Data model: no change.
- Authorization: no change; existing `GoalSpaceDetailPage` auth remains authoritative.
- UI/UX: compact enterprise dashboard form on the goal-space detail page when the goal space has no boards.
- Tests: focused UI tests for success, API envelope error, and thrown fetch error.
- Docs: harness artifacts only.

## Acceptance Criteria

- [ ] Component file path: `apps/web/src/components/create-node-board-form.tsx`.
- [ ] Component exports `CreateNodeBoardForm` as a named client component.
- [ ] Component requires `goalSpaceId: string` as a prop and uses it to build the request URL `/api/v1/goal-spaces/${goalSpaceId}/node-boards`.
- [ ] Form has accessible labels exactly `Board key`, `Board name`, and `Description`.
- [ ] Idle submit button text is exactly `Create node board`.
- [ ] Successful submit posts JSON to `/api/v1/goal-spaces/${goalSpaceId}/node-boards` with `method: "POST"`, `credentials: "include"`, and `content-type: application/json`.
- [ ] Request body includes `key`, `name`, and `description` strings (description may be empty string).
- [ ] Successful submit resets the form and calls `router.refresh()`.
- [ ] API envelope error renders `envelope.error.message` and does not refresh.
- [ ] Thrown fetch error renders `Unable to create node board.` and does not refresh.
- [ ] UI uses CSS variables / design tokens; no hardcoded hex or tracking/letter-spacing classes in P3-03 files.
- [ ] `goal-space-shell.tsx` renders `<CreateNodeBoardForm goalSpaceId={goalSpaceId} />` inside the `boards.length === 0` branch alongside the existing empty-state caption.
- [ ] Existing `NodeBoardView` branch is preserved unchanged for `boards.length > 0`.

## Risks

- Risk: Existing Vitest command may not fail loudly for an absent component.
  Mitigation: After adding the test, re-run the focused command and confirm a real RED failure (missing import) before implementing.
- Risk: `goal-space-shell.tsx` is a complex client wrapper (replay, SSE, commands); an over-broad edit could regress unrelated behavior.
  Mitigation: Touch only the `boards.length === 0 ? ... : ...` ternary inside the JSX `return`. Do not refactor surrounding hooks or stores.
- Risk: Dirty working tree contains unrelated Phase 3 edits.
  Mitigation: Limit edits to the declared write scope and report existing dirty state in `sprint_progress.md`.
- Risk: `goalSpaceId` URL encoding edge cases (spaces, slashes).
  Mitigation: Pass `goalSpaceId` directly into the template literal; routing layer guarantees IDs are URL-safe. Test only uses a URL-safe id `gs-1`.

## Open Questions

- None. Scope follows the Phase 3 plan task P3-03 verbatim.

## Approval Gate

The user explicitly requested TDD development for P3-03. Per the Application Owner Runtime, this change folder is delivered as Phase 1 Request Analysis only and STOPs for explicit human approval before Phase 3 Implementation begins.