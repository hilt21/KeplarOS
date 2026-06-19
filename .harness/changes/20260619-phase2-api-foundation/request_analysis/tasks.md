# Request Analysis Tasks

Change ID: `20260619-phase2-api-foundation`
Status: request_analysis

## Implementation Tasks

- [ ] Write failing response-helper tests in `apps/web/__tests__/api/response.test.ts`.
  - Verify: targeted API response tests fail for missing helper implementation before code is added.

- [ ] Implement `apps/web/src/lib/api/response.ts` and `apps/web/src/lib/api/errors.ts`.
  - Verify: targeted API response tests pass.

- [ ] Write failing request-helper tests in `apps/web/__tests__/api/request.test.ts`.
  - Verify: targeted API request tests fail for missing helper behavior before code is added.

- [ ] Implement `apps/web/src/lib/api/request.ts` and `apps/web/src/lib/api/pagination.ts`.
  - Verify: targeted API request tests pass.

- [ ] Implement `apps/web/__tests__/api/route-test-harness.ts`.
  - Verify: response/request tests can use the harness helpers without expanding scope into real routes.

## Test Tasks

- [ ] RED: run targeted API helper tests before implementation to confirm failing state.
  - Verify: `pnpm --filter @keplar/web test -- __tests__/api/response.test.ts __tests__/api/request.test.ts`

- [ ] GREEN: rerun targeted API helper tests after implementation.
  - Verify: `pnpm --filter @keplar/web test -- __tests__/api/response.test.ts __tests__/api/request.test.ts`

- [ ] Run full repo Web verification after helper implementation.
  - Verify: `pnpm check`

- [ ] Run diff hygiene checks.
  - Verify: `git diff --check`

## Documentation Tasks

- [ ] Keep helper semantics aligned with `docs/specs/interface_spec.md`.
  - Verify: response envelope and error shapes match the documented API contract.

- [ ] Keep current actor parsing generic enough for F2-02.
  - Verify: helper names and test expectations do not force cookie/session implementation into F2-01.

## Sequencing

1. Step: Write failing response-helper tests.
   Verify: targeted test run fails for the right reason.
2. Step: Implement response/error helpers.
   Verify: response-helper tests pass.
3. Step: Write failing request-helper tests.
   Verify: targeted test run fails for the right reason.
4. Step: Implement request/pagination helpers and route test harness.
   Verify: targeted request-helper tests pass.
5. Step: Run `pnpm check`.
   Verify: full Web verification passes or environment caveats are recorded.
6. Step: Record results and remaining risks.
   Verify: testing/results.md and sprint_progress.md are updated during later phases.

## Dependencies

- `docs/superpowers/plans/2026-06-19-phase2-web-collaboration-beta.md`
- `docs/specs/interface_spec.md`
- `apps/web/src/lib/authorization/types.ts`
- `apps/web/package.json`
- `.harness/skills/init.sh`

## Stop Condition

Stop after writing request analysis artifacts and wait for human approval.
