# Request Analysis Spec

Change ID: `20260619-phase2-api-foundation`
Status: request_analysis

## Request Summary

Resume the main Phase 2 line at F2-01 from `docs/superpowers/plans/2026-06-19-phase2-web-collaboration-beta.md`. This feature establishes the shared API foundation for the Web Collaboration Beta: response envelope helpers, API error helpers, request/body parsing helpers, pagination helpers, and an API route test harness.

This feature is intentionally infrastructural. It should create the reusable API primitives that later features will consume, without prematurely implementing auth routes, business endpoints, database repositories, or UI flows. The approved execution model remains Subagent-Driven Development with TDD.

## Assumptions

- F2-00 and `20260619-baseline-health-repair` together are sufficient to unblock the Phase 2 mainline.
- This change corresponds only to F2-01 "API Foundation And Route Test Harness".
- TDD applies strictly here: write failing tests first for response helpers, request helpers, and route test harness behavior before adding implementation.
- `parseCurrentActor()` should expose a stable interface now, even though real authenticated session resolution will be completed in F2-02.
- The dirty workspace already contains prior approved, unfinished-to-commit changes from earlier changes; this change must avoid modifying those unrelated files.

## Scope

### In Scope

- Create `apps/web/src/lib/api/response.ts`.
- Create `apps/web/src/lib/api/errors.ts`.
- Create `apps/web/src/lib/api/request.ts`.
- Create `apps/web/src/lib/api/pagination.ts`.
- Create `apps/web/__tests__/api/response.test.ts`.
- Create `apps/web/__tests__/api/request.test.ts`.
- Create `apps/web/__tests__/api/route-test-harness.ts`.
- Define and test the standard `ApiResponse<T>` / `ApiError` envelope behavior used by later `/api/v1` routes.
- Define and test request/body parsing helpers and a temporary current-actor parsing strategy compatible with F2-02.
- Define and test a reusable route-test harness for JSON request creation and response assertions.

### Out of Scope

- Implementing `/api/v1/auth/*` routes.
- Implementing session persistence or cookie issuance.
- Implementing business routes for goal spaces, boards, cards, confirmations, executions, or SSE.
- Creating repositories or service-layer code outside the API helper surface.
- Modifying UI components or pages.
- Modifying database schema or migrations.
- Changing `.harness/skills/init.sh`, baseline-health files, or F2-00 doc files.

## Affected Areas

- API: `apps/web/src/lib/api/*`, `apps/web/__tests__/api/*`.
- Data model: none.
- Authorization: interface-level only through `parseCurrentActor`, no new policy logic.
- UI/UX: none.
- Tests: new API helper tests only.
- Docs: none required for this feature unless implementation reveals a contract mismatch.

## Acceptance Criteria

- [ ] `apps/web/src/lib/api/response.ts` provides shared response helpers for success, created, no-content, and error responses.
- [ ] `apps/web/src/lib/api/errors.ts` provides a typed error-code surface suitable for later route handlers.
- [ ] `apps/web/src/lib/api/request.ts` provides `readJsonBody`, `requireString`, `optionalString`, and `parseCurrentActor`.
- [ ] `apps/web/src/lib/api/pagination.ts` provides reusable pagination parsing helpers if needed by the tests and current implementation.
- [ ] `apps/web/__tests__/api/response.test.ts` verifies response envelope shape with failing tests first.
- [ ] `apps/web/__tests__/api/request.test.ts` verifies request helper behavior with failing tests first.
- [ ] `apps/web/__tests__/api/route-test-harness.ts` provides reusable request/response assertion helpers for later API route tests.
- [ ] `pnpm --filter @keplar/web test -- __tests__/api/response.test.ts __tests__/api/request.test.ts` passes.
- [ ] `pnpm check` passes in the current environment, or any environment-specific warning/exception is explicitly recorded.
- [ ] No unrelated files from prior changes are modified by this feature.

## Risks

- Risk: `parseCurrentActor()` could accidentally hard-code session behavior that conflicts with F2-02.
  Mitigation: Keep it minimal and interface-oriented, with tests that allow later session-backed substitution.

- Risk: API helper design could sprawl into repository/service abstractions too early.
  Mitigation: Limit the feature to response, request, pagination, and route test harness primitives only.

- Risk: Dirty workspace state from prior changes could bleed into this feature.
  Mitigation: Keep the write set limited to the new `apps/web/src/lib/api/*`, `apps/web/__tests__/api/*`, and this change's harness artifacts.

## Open Questions

- None at request-analysis time. If current actor parsing requires real session semantics immediately, pause and amend scope before crossing into F2-02 territory.

## Approval Gate

Request Analysis must stop here until explicit human approval is given.
