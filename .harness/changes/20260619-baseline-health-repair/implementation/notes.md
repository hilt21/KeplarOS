# Implementation Notes

Change ID: `20260619-baseline-health-repair`
Status: implementation_complete

## Summary

Implemented the approved baseline repair in three small slices:

1. Fixed the existing `@typescript-eslint/consistent-type-imports` failure in `apps/web/src/middleware.ts`.
2. Refreshed `docs/specs/global_unified_spec.md` so its current-state statements match the actual repository baseline.
3. Applied the approved formatting-only cleanup for the 12 files surfaced by `pnpm format:check`.
4. Updated `.harness/skills/init.sh` so the current placeholder-only Rust workspace is skipped instead of requiring `cargo`.

## Files Changed

- Path: `apps/web/src/middleware.ts`
  Reason: Fix the known type-only import lint failure.

- Path: `docs/specs/global_unified_spec.md`
  Reason: Refresh stale current-state wording so docs match the actual repo.

- Path: `apps/web/__tests__/audit/redact.test.ts`
  Reason: Approved formatting-only cleanup from `pnpm format:check`.

- Path: `apps/web/__tests__/auth/password.test.ts`
  Reason: Approved formatting-only cleanup from `pnpm format:check`.

- Path: `apps/web/__tests__/authorization/card.test.ts`
  Reason: Approved formatting-only cleanup from `pnpm format:check`.

- Path: `apps/web/__tests__/headers.test.ts`
  Reason: Approved formatting-only cleanup from `pnpm format:check`.

- Path: `apps/web/__tests__/middleware.test.ts`
  Reason: Approved formatting-only cleanup from `pnpm format:check`.

- Path: `apps/web/__tests__/state-machine/goal-space.test.ts`
  Reason: Approved formatting-only cleanup from `pnpm format:check`.

- Path: `apps/web/db/schema.ts`
  Reason: Approved formatting-only cleanup from `pnpm format:check`.

- Path: `apps/web/src/lib/audit/redact.ts`
  Reason: Approved formatting-only cleanup from `pnpm format:check`.

- Path: `apps/web/src/lib/auth/password.ts`
  Reason: Approved formatting-only cleanup from `pnpm format:check`.

- Path: `apps/web/src/lib/authorization/goal-space.ts`
  Reason: Approved formatting-only cleanup from `pnpm format:check`.

- Path: `apps/web/src/lib/security/headers.ts`
  Reason: Approved formatting-only cleanup from `pnpm format:check`.

- Path: `.harness/skills/init.sh`
  Reason: Skip Rust verification when the current `crates/**/*.rs` sources are placeholder/comment-only.

## Feature Status Updates

| Feature ID | Status | Notes |
|-----------|--------|-------|
| F2-00B | implemented | Repo-scoped baseline blockers addressed; startup path now completes in the current environment. |

## Deviations From Plan

- Deviation: Exact Node `20.10.0` verification was not possible on this machine.
  Reason: The local `node@20` path resolves to Node `25.2.1`; `.nvmrc` is correct but the environment does not provide a real Node 20 runtime.
  Approval: Allowed by the amended acceptance criteria as an explicitly recorded environment exception.

## Risks And Follow-Ups

- Residual environment warning: current Node runtime is still `v25.2.1`, so pnpm emits engine warnings.
- Residual test-runtime warning: Vitest logs a WebSocket `EPERM` warning in this environment even though all tests pass.
- Follow-up: before Phase 2 feature work, install or expose a real Node `20.10.0` runtime so verification can run without engine warnings.

## Verification During Implementation

- Command/check: `pnpm lint`
  Result: Passed after the `middleware.ts` fix.

- Command/check: `pnpm format:check`
  Result: Passed after the approved formatting-only cleanup.

- Command/check: `git diff --check`
  Result: Passed.

- Command/check: `.harness/skills/init.sh`
  Result: Completed successfully; placeholder-only Rust workspace is skipped instead of requiring `cargo`.

## Sprint Progress Update

Implementation is complete. Testing and delivery artifacts should record the remaining environment warnings but do not need to mark the feature blocked.
