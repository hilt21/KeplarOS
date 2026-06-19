# Implementation Notes

Change ID: `20260619-phase2-baseline-docs`
Status: implementation_complete

## Summary

Implemented F2-00 as a documentation-only Phase 2 baseline refresh. The docs now state that Phase 1 is complete, define Phase 2 as Web Collaboration Beta, refresh the test matrix to use the current root pnpm verification commands, and describe the Phase 2 `/api/v1` API target as future implementation through Next.js route handlers.

No application source, test code, database migration, UI, CI, or runtime configuration files were changed.

## Files Changed

- Path: `docs/specs/phase1_scope.md`
  Reason: Mark Phase 1 complete and define Phase 2 Web Collaboration Beta as the next target.

- Path: `docs/architecture/test_matrix.md`
  Reason: Replace stale "no executable test entry" wording with current pnpm verification commands and Phase 2 verification direction.

- Path: `docs/specs/interface_spec.md`
  Reason: Add a future-oriented Phase 2 `/api/v1` route-handler implementation note.

- Path: `docs/README.md`
  Reason: Update documentation entry point from Phase 1 freeze to Phase 2 baseline.

## Feature Status Updates

| Feature ID | Status | Notes |
|-----------|--------|-------|
| F2-00 | implemented | Documentation-only changes complete; verification recorded in testing results. |

## Deviations From Plan

- Deviation: `docs/specs/global_unified_spec.md` still contains stale current-state wording.
  Reason: It was identified during RED verification but was outside the approved F2-00 write scope.
  Approval: Not changed. Track as a separate scope amendment.

- Deviation: `.harness/skills/init.sh` did not complete green.
  Reason: Existing environment uses Node `v25.2.1` while project requires Node 20, and existing `apps/web/src/middleware.ts` has a lint issue.
  Approval: Not fixed in F2-00 because the approved feature is documentation-only.

## Risks And Follow-Ups

- Follow-up: Create a separate change to refresh `docs/specs/global_unified_spec.md`.
- Follow-up: Before implementing F2-01 API foundation, fix or switch the local environment to Node 20 and resolve the existing middleware lint issue so `pnpm check` is green.

## Verification During Implementation

- Command/check: RED stale documentation search
  Result: Found stale assertions in `docs/architecture/test_matrix.md` and `docs/specs/global_unified_spec.md`.

- Command/check: GREEN stale test-entry search for `docs/architecture/test_matrix.md`
  Result: No stale "no executable test entry" matches remained in the touched test matrix file.

- Command/check: pnpm command search in `docs/architecture/test_matrix.md`
  Result: Found `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`, `pnpm format:check`, and `pnpm check`.

- Command/check: Phase 2 API note search in `docs/specs/interface_spec.md`
  Result: Found future-oriented `/api/v1` Next.js route-handler target wording with authorization, audit, and realtime boundaries.

- Command/check: `git diff --check`
  Result: Passed.

- Review: Subagent spec compliance review
  Result: Approved.

- Review: Subagent quality review
  Result: Initial rejection for overclaiming wording; fixed and re-reviewed as approved.

## Sprint Progress Update

Implementation is complete for F2-00. Testing results and delivery artifacts should record the baseline verification exception before closing the feature.
