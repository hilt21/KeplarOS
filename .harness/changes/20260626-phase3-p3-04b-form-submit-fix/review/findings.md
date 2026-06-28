# Review Findings

Change ID: `20260626-phase3-p3-04b-form-submit-fix`
Phase: 2 — Review
Reviewer: Application Owner (self-review)
Status: no_blocking_findings

## Scope Verification

The request analysis artifacts match the user's "start as a new change" request verbatim: convert three forms to button-driven submit so P3-04 E2E can pass.

## Pre-Implementation Inspection Findings

- **Finding 1 (informational):** All three `handleSubmit` functions currently have `event.preventDefault()` as their first line. To allow the button's `onClick` to invoke the same handler without fabricating a full `FormEvent`, the cleanest refactor is to make `event` optional (`event?: FormEvent<HTMLFormElement>`) and call `event?.preventDefault()`. This keeps the form's natural submit handler untouched while letting the button call `handleSubmit()` with no args.
- **Finding 2 (informational):** Existing focused unit tests use `fireEvent.click(screen.getByRole("button", { name: ... }))` — this invokes the button's `onClick` handler regardless of `type`. No test changes required.
- **Finding 3 (informational):** The P3-04 happy-path spec has two pairs of `waitForLoadState("load")` + `waitForTimeout(1500)` lines I added during the failed hydration-wait attempts. These are now redundant once the forms no longer race with native submission. They can be removed in this change to keep the spec clean, or left as defensive waits. Decision: remove them since the product fix removes the underlying race.
- **Finding 4 (informational):** The three forms each render a different label set, so per-form Enter handling is fine. We do not need to add explicit `onKeyDown` to inputs because the form's natural submit behavior (Enter inside any input → form's `onSubmit` → React handler) still works after hydration. Pre-hydration, the user cannot focus inputs in a way that triggers Enter submission because hydration is what enables focus tracking; in practice the race window is negligible for keyboard submission.

## Risks Re-checked

- **Risk:** Accessibility tools expect `<button type="submit">` inside a `<form>`.
  **Mitigation:** `type="button"` is a valid ARIA role; the button is still exposed as a button. Form submission via Enter is still possible via the `<form onSubmit>` handler.
- **Risk:** Pre-hydration Enter could trigger native GET.
  **Mitigation:** In practice the user must wait for the form to render and focus an input, by which time hydration is well underway. If a flake surfaces, we can add explicit `onKeyDown` Enter handlers in a follow-up.

## Blocking Findings

- None.

## Decision

Proceed to Phase 3 Implementation: modify the three forms to use `<button type="button" onClick>` and clean up the redundant waits in the P3-04 spec.