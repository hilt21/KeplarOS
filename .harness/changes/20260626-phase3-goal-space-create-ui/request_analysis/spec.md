# Request Analysis Spec

Change ID: `20260626-phase3-goal-space-create-ui`
Status: approved_for_implementation

## Request Summary

Implement P3-02 Goal-Space Creation UI in the existing web app. The feature adds a compact client-side form on the existing `/goal-spaces` page so an authenticated user can create a goal space through the existing `/api/v1/goal-spaces` endpoint.

This feature only creates goal spaces from the existing `/goal-spaces` page. It does not add P3-03 node-board UI and does not change backend, API, database, authorization, or schema behavior.

## Assumptions

- The user's "Implement P3-02" instruction is explicit approval to proceed through implementation for this single feature.
- The existing `/api/v1/goal-spaces` POST endpoint accepts `name`, `description`, `constraints`, and `acceptance_criteria`.
- A self-contained client form is preferred over changing `apps/web/src/lib/api/goal-spaces.ts`.
- Existing P3-00/P3-01 working-tree edits are owned by other work and must not be reverted or reformatted.

## Scope

### In Scope

- Add `apps/web/src/components/create-goal-space-form.tsx`.
- Add `apps/web/src/__tests__/ui/create-goal-space-form.test.tsx`.
- Render `<CreateGoalSpaceForm />` in `apps/web/src/app/(app)/goal-spaces/page.tsx` after the page header and before the empty/list state.
- Create required harness artifacts under `.harness/changes/20260626-phase3-goal-space-create-ui/`.

### Out of Scope

- No P3-03 node-board UI.
- No backend, API route, service, database, migration, schema, or authorization changes.
- No changes to existing P3-00/P3-01 work except where the requested page integration requires a local import/render.
- No commits.

## Affected Areas

- API: consumes existing `POST /api/v1/goal-spaces`; no API change.
- Data model: no change.
- Authorization: no change; existing page/layout auth remains authoritative.
- UI/UX: compact enterprise dashboard form on `/goal-spaces`, using design tokens.
- Tests: focused UI tests for success and API error behavior.
- Docs: harness artifacts only.

## Acceptance Criteria

- [ ] Form has accessible labels exactly `Goal name` and `Description`.
- [ ] Idle submit button text is exactly `Create goal space`.
- [ ] Successful submit posts JSON to `/api/v1/goal-spaces` with `method: "POST"` and `credentials: "include"`.
- [ ] Request body includes `name`, `description`, `constraints: []`, and `acceptance_criteria: []`.
- [ ] Successful submit resets the form and calls `router.refresh()`.
- [ ] API envelope error renders `envelope.error.message` and does not refresh.
- [ ] Thrown fetch error renders `Unable to create goal space.`.
- [ ] UI uses CSS variables/design tokens; no hardcoded hex or tracking/letter-spacing classes in P3-02 files.
- [ ] Form is rendered after the `/goal-spaces` header and before the existing empty/list state.

## Risks

- Risk: Existing Vitest command may not fail for a missing path pattern.
  Mitigation: After adding the test, run the focused command again to confirm a real RED failure before implementing the component.
- Risk: Dirty working tree contains unrelated Phase 3 edits.
  Mitigation: Limit edits to the declared write scope and report existing dirty state.

## Open Questions

- None. Scope is explicit.

## Approval Gate

The user explicitly requested implementation for this change id and provided write scope, acceptance criteria, and verification commands.
