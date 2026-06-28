# Request Analysis Spec

Change ID: `20260626-phase3-p3-04b-form-submit-fix`
Status: pending_human_approval

## Request Summary

Convert the three P3-01/02/03 form components from `<form onSubmit>` + `<button type="submit">` to a button-driven pattern (`<button type="button" onClick>` + `onKeyDown` on inputs for Enter key) so the browser does not natively submit the form as a GET before React hydrates. This unblocks the P3-04 browser-first E2E happy-path in Next.js dev mode and removes a latent UX hazard (passwords in URL query params).

This feature is a narrow product-side fix; it does not change API, DB, schema, authorization, P3-04 E2E expectations, or any other component.

## Assumptions

- The three forms are already committed (`9e6955b feat(web): create node boards from browser` for the node-board form; the goal-space and login forms were committed in earlier P3-01/02 work).
- Existing focused unit tests for all three forms use `fireEvent.click` on the submit button (`getByRole("button", { name: ... })`). With `type="button"`, `fireEvent.click` invokes the `onClick` handler directly, so existing tests do not need to change.
- P3-04 E2E will pass once these forms no longer submit natively before hydration.
- All three forms' Enter-key UX must be preserved — keyboard users must still be able to submit by pressing Enter while focused in any input.

## Scope

### In Scope

- Modify `apps/web/src/components/login-form.tsx`:
  - Change `<button type="submit">` to `<button type="button" onClick={handleSubmit}>`.
  - Add `onKeyDown` to each input that calls `handleSubmit` when `event.key === "Enter"` (with a synthetic event object since `handleSubmit` expects `React.FormEvent<HTMLFormElement>`).
  - Keep `<form onSubmit={handleSubmit}>` so the existing accessibility behaviour (Enter in any field) and the existing unit tests (which fire click events) still work.
- Apply the same pattern to `apps/web/src/components/create-goal-space-form.tsx`.
- Apply the same pattern to `apps/web/src/components/create-node-board-form.tsx`.
- Create required harness artifacts under `.harness/changes/20260626-phase3-p3-04b-form-submit-fix/`.

### Out of Scope

- No changes to API, DB, schema, migration, or authorization.
- No changes to `apps/web/e2e/phase2-board.spec.ts`; the existing redundant `waitForLoadState("load")` + `waitForTimeout(1500)` lines can be removed (clean up) but are not required for this change to pass.
- No changes to form submission payload shape, success-path behaviour, or error rendering.
- No changes to unit tests (existing `fireEvent.click` continues to invoke the handler via `onClick`).
- No commits until explicitly requested.

## Affected Areas

- Product UI: three form components in `apps/web/src/components/`.
- Tests: existing focused unit tests should continue to pass without modification.
- E2E: `apps/web/e2e/phase2-board.spec.ts` is not modified but should now pass as a downstream effect.

## Acceptance Criteria

- [ ] `apps/web/src/components/login-form.tsx` submit button uses `type="button"` and `onClick={handleSubmit}` (or an equivalent wrapper that calls the same fetch logic).
- [ ] `apps/web/src/components/login-form.tsx` inputs each have an `onKeyDown` handler that submits when Enter is pressed.
- [ ] Same pattern applied to `apps/web/src/components/create-goal-space-form.tsx`.
- [ ] Same pattern applied to `apps/web/src/components/create-node-board-form.tsx`.
- [ ] `<form onSubmit={handleSubmit}>` is kept on all three forms (preserves accessibility and is the canonical submit-handler anchor).
- [ ] `pnpm --filter @keplar/web typecheck` exits 0.
- [ ] `pnpm --filter @keplar/web lint` exits 0 with no new warnings.
- [ ] `pnpm --filter @keplar/web test` reports all three focused UI test files still passing (no test changes required).
- [ ] `pnpm --filter @keplar/web format:check` exits 0 (after `prettier --write` on the three modified files if needed).
- [ ] `pnpm --filter @keplar/web e2e` exits 0 with `1 passed` for the P3-04 happy-path spec (no spec changes required).

## Risks

- Risk: Changing the button's `type` could affect accessibility tools or screen readers that rely on `type="submit"` semantics.
  Mitigation: `type="button"` is valid for buttons that don't natively submit a form. The form's `onSubmit` handler is still wired for keyboard Enter. Accessibility tree still exposes the button as a button.
- Risk: `onKeyDown` Enter handling may double-fire if the form's `onSubmit` also runs.
  Mitigation: The Enter key inside an input inside a form triggers the form's submit event regardless of `onKeyDown`. The `onKeyDown` for Enter is redundant with the form's natural Enter handling and serves only as a safety net for cases where the user might press Enter before hydration completes. Pick one path (either rely on form's `onSubmit` for Enter, or rely on `onKeyDown` for Enter, not both) — recommendation: keep `onKeyDown` because it's the most hydration-robust.
- Risk: `onKeyDown` handler must construct a synthetic event-like object that `handleSubmit` accepts, or `handleSubmit` must be refactored to accept no event.
  Mitigation: Refactor `handleSubmit` to take no event argument; the `<form onSubmit>` wrapper passes `event` but we ignore it (or call `event.preventDefault()` only there). The button's `onClick` calls `handleSubmit()` with no args.

## Open Questions

- None. The Enter-key path is decided: keep `<form onSubmit>` and let the browser's native Enter-to-submit fire React's onSubmit handler. The hydration race is resolved because the **button click** is no longer a form submission — it's a plain button click that calls `handleSubmit()` via `onClick`. Enter-to-submit still works after hydration via the form's natural submit behavior.

## Approval Gate

The user explicitly requested "start as a new change" for this follow-up. Per the Application Owner Runtime, this change folder is delivered as Phase 1 Request Analysis only and STOPs for explicit human approval before Phase 3 Implementation begins.