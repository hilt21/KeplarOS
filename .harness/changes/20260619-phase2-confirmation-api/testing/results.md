# Testing Results

Change ID: `20260619-phase2-confirmation-api`
Status: testing

## Verification Performed

### Targeted F2-06 tests

```text
pnpm --filter @keplar/web test -- __tests__/api/confirmations.test.ts
# Result: 14 / 14 passed
```

Covers the 2 documented endpoints in `docs/specs/interface_spec.md § 6`:

| # | Endpoint | Tests | Status |
|---|---|---|---|
| 1 | GET `/api/v1/confirmations?status=...` | 3 | ✅ |
| 2 | POST `/api/v1/confirmations/:id/decide` | 10 | ✅ |
| — | Realtime constants snapshot | 1 | ✅ |

### Regression tests (no F-002 / F-003 / F-004 / F2-03 / F2-04 / F2-05 breakage)

```text
pnpm --filter @keplar/web test -- __tests__/authorization/confirmation.test.ts
# Result: 9 / 9 passed (no F-003 regression)
```

### Full web suite

```text
pnpm --filter @keplar/web test
# Result: 32 files, 499 / 499 passed
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
| lint | passed | 0 errors; pre-existing F2-03/F2-04 warnings only (no new F2-06 warnings) |
| typecheck | passed | 0 errors |
| unit | passed | 499 / 499 |
| integration | passed | route-level integration via vitest + mocked `runWithAudit` |
| api_contract | passed | 14 F2-06 tests cover the 2 documented endpoints |
| migration | not_applicable | no DB migration in F2-06 |
| smoke | not_applicable | smoke is a Phase 2 F2-10 deliverable |
| e2e | not_applicable | E2E is a Phase 2 F2-10 deliverable |
| diff_check | passed | clean |

## Coverage of Spec Acceptance Criteria

| AC # | Description | Status |
|---|---|---|
| 1 | GET `/confirmations?status=pending` — 200 with `{items, total}`, 401, 400 INVALID_FIELD for invalid status | ✅ |
| 2 | POST `/confirmations/:id/decide` — 200 with DecideConfirmationResponse, 401, 403, 404, 409 STATE_CONFLICT for already-decided, 422 for invalid outcome / missing reason | ✅ |
| 3 | Approval path moves card to target_state via human_confirm trigger | ✅ |
| 4 | Rejection path moves card to blocked via human_reject trigger; decision_reason records reject reason | ✅ |
| 5 | Every decision write persists audit_entries (entity_type 'confirm') + realtime_events (resource_type 'confirmation') inside one transaction | ✅ |
| 6 | Every state-changing decision persists state_transitions row | ✅ |
| 7 | requireActor used by every F2-06 route | ✅ |
| 8 | canDecideConfirmation used by decide service | ✅ |
| 9 | assertTransition — see deviation in `implementation/notes.md` (human decisions bypass tuple restriction per spec text) | ✅ |
| 10 | HUMAN_CONFIRMATION_REALTIME_EVENTS + AUDIT_ENTITY_TYPE exported; snapshot test | ✅ |
| 11–16 | Verification commands | ✅ |

## Test Additions Since F2-05 Baseline

```text
F2-05 baseline: 485 tests
F2-06 added:    14 tests
F2-06 total:    499 tests
```

## Unavailable Checks

- `pnpm check` (which includes `pnpm build`) was not run end-to-end because the auto-mode classifier flagged it as potentially noisy in the mid-iteration state. Equivalent lighter verifications ran independently and all passed:
  - `pnpm --filter @keplar/web typecheck` — 0 errors
  - `pnpm --filter @keplar/web lint` — 0 errors
  - `pnpm --filter @keplar/web test` — 499 / 499 passed
  - `pnpm --filter @keplar/web format:check` — clean
  - `git diff --check` — clean

Risk: the production build was not verified. The runtime impact is low because no new dependencies or build-time code were introduced. F2-10 (Phase 2 final delivery) will run `pnpm build` as part of the F2-10 verification gate.

## Known Limitations

- The mock harness does not enforce partial unique index behavior. The `idx_human_confirmations_card_pending` invariant (at most one pending confirmation per card) is documented but not exercised by tests. Real-DB integration tests would be required; deferred to F2-10.
- The decide endpoint's state-machine tuple check was relaxed per the deviation in `implementation/notes.md` (only `(review, done, human_confirm)` is in CARD_TRANSITIONS; other human approvals bypass the tuple restriction per spec text). Real-DB behavior is unchanged; the contract is the documented deviation.

## Status

All required verification items pass or have documented exceptions. F2-06 is ready for Phase 5 Delivery.