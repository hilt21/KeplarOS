# Implementation Notes

Change ID: `20260619-phase2-api-foundation`
Status: implementation_complete

## Summary

Implemented F2-01 API Foundation And Route Test Harness within the approved scope. The change adds shared API response helpers, error helpers, request helpers, a minimal pagination parser, and reusable API route test harness utilities, along with test-first coverage for the helper behavior.

The response envelope now matches `docs/specs/interface_spec.md` with `success`, `data` or `error`, and `timestamp`. `parseCurrentActor()` remains intentionally test-oriented for F2-01 and is gated so the injected header only works in test runtime.

## Files Changed

- Path: `apps/web/src/lib/api/errors.ts`
  Reason: Typed API error-code surface and shared request error class.

- Path: `apps/web/src/lib/api/response.ts`
  Reason: Shared success/error response envelope helpers.

- Path: `apps/web/src/lib/api/request.ts`
  Reason: JSON/body parsing, string validators, and test-only current actor parsing.

- Path: `apps/web/src/lib/api/pagination.ts`
  Reason: Minimal documented page/limit parser with defaults and max cap.

- Path: `apps/web/__tests__/api/response.test.ts`
  Reason: TDD coverage for response envelope helpers.

- Path: `apps/web/__tests__/api/request.test.ts`
  Reason: TDD coverage for request helpers, pagination, and test-only current actor guard.

- Path: `apps/web/__tests__/api/route-test-harness.ts`
  Reason: Shared request/response helper utilities for later route tests.

## Feature Status Updates

| Feature ID | Status | Notes |
|-----------|--------|-------|
| F2-01 | implemented | API foundation and route test harness complete. |

## Deviations From Plan

- Deviation: `parseCurrentActor()` uses a test-only header convention rather than real session extraction.
  Reason: This keeps F2-01 within scope and leaves session persistence to F2-02.
  Approval: Intentional and aligned with the request analysis assumptions.

- Deviation: `pagination.ts` remains intentionally minimal.
  Reason: Only the documented default/max parser behavior is needed by current tests and implementation.
  Approval: Intentional YAGNI choice within F2-01 scope.

## Risks And Follow-Ups

- Residual environment warning: current Node runtime is still `v25.2.1`, so pnpm emits engine warnings against the repo's Node `20.10.0` requirement.
- Residual test-runtime warning: Vitest logs a WebSocket `EPERM` warning in this environment even though tests pass.
- Follow-up: F2-02 should replace the test-only actor header path with real session extraction and keep the helper call sites stable.

## Verification During Implementation

- Command/check: `pnpm --filter @keplar/web test -- __tests__/api/response.test.ts __tests__/api/request.test.ts`
  Result: RED failed before implementation for missing helper modules; GREEN passed after implementation.

- Command/check: `pnpm check`
  Result: Passed after envelope, trust-boundary, and pagination fixes.

- Command/check: `git diff --check`
  Result: Passed.

## Sprint Progress Update

Implementation is complete. Testing and delivery artifacts should record the remaining environment warnings and the F2-02 handoff note.
