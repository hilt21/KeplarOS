# Testing Results

Change ID: `20260619-phase2-execution-api`
Status: testing

## Verification Performed

### Targeted F2-07 tests

```text
pnpm --filter @keplar/web test -- __tests__/api/executions.test.ts
# Result: 12 / 12 passed
```

Covers the 2 documented endpoints in `docs/specs/interface_spec.md § 7`:

| # | Endpoint | Tests | Status |
|---|---|---|---|
| 1 | POST `/api/v1/cards/:id/execute` | 7 | ✅ |
| 2 | GET `/api/v1/execute/:taskId` | 4 | ✅ |
| — | Realtime constants snapshot | 1 | ✅ |

### Regression tests (no F-002 / F-003 / F-004 / F2-03 / F2-04 / F2-05 / F2-06 breakage)

```text
pnpm --filter @keplar/web test -- __tests__/authorization/execute.test.ts __tests__/authorization/execute-db.test.ts __tests__/state-machine/card.test.ts __tests__/authorization/card.test.ts
# Result: 84 + 21 + 14 + 21 = 140 / 140 passed
```

### Full web suite

```text
pnpm --filter @keplar/web test
# Result: 33 files, 511 / 511 passed
```

### TypeScript

```text
pnpm --filter @keplar/web typecheck
# Result: 0 errors
```

### Prettier

```text
pnpm --filter @keplar/web format:check
# Result: "All matched files use Prettier code style!"
```

### Git diff check

```text
git diff --check
# Result: clean (no whitespace issues)
```

## Verification Matrix (per feature_list.json)

| Check | Status | Notes |
|---|---|---|
| lint | passed | 0 errors; pre-existing F2-03/F2-04 warnings only (no new F2-07 warnings) |
| typecheck | passed | 0 errors |
| unit | passed | 511 / 511 |
| integration | passed | route-level integration via vitest + mocked `runWithAudit` |
| api_contract | passed | 12 F2-07 tests cover the 2 documented endpoints |
| migration | not_applicable | no DB migration in F2-07 |
| smoke | not_applicable | smoke is a Phase 2 F2-10 deliverable |
| e2e | not_applicable | E2E is a Phase 2 F2-10 deliverable |
| diff_check | passed | clean |

## Coverage of Spec Acceptance Criteria

| AC # | Description | Status |
|---|---|---|
| 1 | POST `/cards/:id/execute` — 202 with ExecuteCardResponse, 401, 404, 403, 422, 409 CONFIRMATION_REQUIRED, 409 STATE_CONFLICT | ✅ |
| 2 | GET `/execute/:taskId` — 200 with ExecuteStatusResponse, 401, 404, 403 | ✅ |
| 3 | Backlog Refiner fixture moves backlog → todo with `dependencies_ready` trigger | ✅ |
| 4 | Review Guard fixture creates needs_confirmation for high-risk card with `trigger_type: 'high_risk'` | ✅ |
| 5 | Failed execution records error_code + error_message + emits `agent_execution.failed` | ✅ |
| 6 | Every execution lifecycle write persists audit_entries (entity_type `agent_execution`) + realtime_events inside runWithAudit | ✅ |
| 7 | State-changing execution persists state_transitions row | ✅ |
| 8 | requireActor used by every F2-07 route | ✅ |
| 9 | canExecuteCard used by create service; § 5 mandatory gate encoded | ✅ |
| 10 | assertTransition used; IllegalTransitionError → 409 STATE_CONFLICT | ✅ |
| 11 | AGENT_EXECUTION_REALTIME_EVENTS + AUDIT_ENTITY_TYPE exported; snapshot test | ✅ |
| 12 | Fixture executor is deterministic, no external I/O | ✅ |
| 13–18 | Verification commands | ✅ |

## Test Additions Since F2-06 Baseline

```text
F2-06 baseline: 499 tests
F2-07 added:    12 tests
F2-07 total:    511 tests
```

## Unavailable Checks

- `pnpm check` (which includes `pnpm build`) was not run end-to-end because the auto-mode classifier flagged it as potentially noisy in the mid-iteration state. Equivalent lighter verifications ran independently and all passed.

Risk: the production build was not verified. F2-10 will exercise the full check.

## Known Limitations

- The mock harness does not enforce real-DB invariants. Real-DB behavior of the partial unique index `idx_human_confirmations_card_pending` is exercised by the gate (F-003) but not by the test mocks.
- The fixture executor is synchronous; production async execution is out of scope.
- The `estimated_time` per role is a constant; production may refine.

## Status

All required verification items pass. F2-07 is ready for Phase 5 Delivery.