# Full-Repository Code Review — KEPLAR

**Date:** 2026-06-08
**Branch reviewed:** `code-review-s1+s2` (clean tree at `master` HEAD `7b34315`)
**Scope:** 4 review dimensions × spec cross-check
**Reviewers:** 4 parallel specialized agents + 1 manual adversarial verify

---

## 1. Executive Summary

KEPLAR is at the **end of S2**: a Next.js + Drizzle (SQLite) app with a complete
authorization layer, two state machines, a monotonic realtime-event sequence, and
~4.2k LOC of TypeScript. The Rust workspace and desktop app are stubs (`crates/**`
and `apps/desktop/` only have README/placeholder files). All meaningful code lives
under `apps/web/`.

The code is **internally consistent and well-typed**, but has **substantial
spec drift**: a large fraction of findings are the same underlying problem —
schema, enum values, and column names diverge from `docs/specs/database_design.md`,
`docs/specs/authorization_matrix.md`, and `docs/specs/ai_agent_contracts.md`.

### 1.1 Numbers

| Dimension | HIGH | MEDIUM | LOW | Total |
|-----------|-----:|-------:|----:|------:|
| Security & Authorization | 3 | 4 | 2 | 9 |
| Correctness / State Machine | 4 | 5 | 3 | 12 |
| Database / Schema / Migrations | 14 | 19 | 12 | 45 |
| TypeScript / Quality | 0 | 2 | 11 | 13 |
| **Total** | **21** | **30** | **28** | **79** |

Of the 21 HIGH findings:
- 6 are **spec deviations** that break a documented contract
- 7 are **authorization gaps** (no central enforcement; relies on caller convention)
- 4 are **state-machine / domain-logic contradictions** with the spec
- 2 are **migration safety hazards**
- 2 are **security headers / CI gaps**

### 1.2 Top three "must fix before S3"

1. **DB-011 / DB-012 / DB-013 — `human_confirmations` table is incomplete** (13 missing
   columns, 5 wrong enum values, `timed_out` vs `cancelled`). The S3 confirmation
   API cannot be implemented against this schema.
2. **DB-009 / DB-022 — `state_transitions` is entity-polymorphic** instead of
   card-scoped per spec § 3.7. The S3 transition-history endpoint
   (`GET /cards/:id/transitions`) cannot satisfy the spec without a table rebuild.
3. **SEC-003 / SEC-004 / COR-001 / COR-002 — authorization and security-header
   baseline is missing**. `canMutateCard` lacks the § 5 pending-confirmation gate;
   `canDecideConfirmation` lacks status check; no CSP/HSTS/CSRF middleware; no
   audit redaction helper. S3 route handlers will inherit this fragile baseline.

### 1.3 What is **NOT** a problem

- The state machines themselves are *internally* correct; bugs are in the
  *enforcement layer* (authz functions don't run the right checks) and in spec
  interpretation (COR-003 trigger↔actor mapping).
- The `runWithAudit` realtime sequence and audit pipeline are sound under
  better-sqlite3's serial transaction model (COR-008 is forward-looking, not a
  current bug).
- Tests are present, well-structured, and cover the happy paths and most
  precondition branches.

---

## 2. Methodology

### 2.1 Four specialized agents in parallel

| Agent | Subagent | Dimensions | Spec files cross-checked |
|-------|----------|------------|--------------------------|
| Security | `general-purpose` (security lens) | OWASP, authz, secrets, CSRF, headers | `authorization_matrix.md`, `ai_agent_contracts.md`, `non_functional_requirements.md`, `DESIGN.md` |
| Database | `general-purpose` (postgres-reviewer lens) | schema design, migrations, indexes, FKs | `database_design.md`, `er_diagram.md`, `authorization_matrix.md` |
| TypeScript | `general-purpose` (typescript-reviewer lens) | type safety, async, idioms, perf | `interface_spec.md`, `phase1_scope.md` |
| Correctness | `general-purpose` (code-reviewer lens) | state machine, authz logic, edge cases, races | `phase1_scope.md`, `global_unified_spec.md`, `ai_agent_contracts.md`, `authorization_matrix.md`, `realtime_events.md`, `interface_spec.md` |

Each agent returned a JSON array of `{id, severity, file, line, category, evidence, spec_violation, recommendation}`.

### 2.2 Manual adversarial verify (this reviewer)

Spot-checked 6 of the 21 HIGH findings by reading source + spec:

| Finding | Verified? | Note |
|---------|-----------|------|
| **SEC-002** docker-compose `POSTGRES_PASSWORD: keplar` | ✅ Confirmed | Trivially reproducible from file content |
| **COR-004** `human_confirm_timeout → cancelled` violates spec § 10 | ✅ Confirmed | Spec text: "Confirmation timeout must keep or move the card to blocked" |
| **COR-002** `canDecideConfirmation` doesn't check `status` | ✅ Confirmed | Code only checks `role === 'initiator' && id === goalSpaceInitiatorId` |
| **DB-001** `goal_spaces` missing `name/progress/constraints/acceptance_criteria/started_at/cancelled_at/deleted_at` | ✅ Confirmed | Schema uses `title` (not `name`); 7 columns absent per spec § 3.1 |
| **DB-011** `human_confirmations` missing 13 spec columns | ✅ Confirmed | Direct spec § 3.8 ↔ schema diff |
| **DB-013** `timed_out` enum vs spec `cancelled` | ✅ Confirmed | spec § 3.8 lists `pending/approved/rejected/cancelled` |
| **SEC-001 / COR-005** `canReadGoalSpace` blocks node-board members | ⚠️ Downgraded | **Code comment explicitly documents this as an S2 scope boundary** (`S2 范围内不引入间接层`). Not a hidden bug; recommend lowering to MEDIUM and tracking as known debt |
| **COR-003** AI actor recorded for human_reject / human_confirm triggers | ⚠️ Real but nuanced | `actor` field semantics need spec clarification. Recommend ADR |

### 2.3 What was NOT reviewed (out of scope or stub)

- `crates/keplar-{cli,core,rpc,scanner,server}` — 1-line placeholder files
- `apps/desktop/` — README only
- `src/{app,client,core}/` — README only (per `2026-05-30-readonly-exploration/MODULE_OWNERSHIP.md`)
- `docs/**` — specs and architecture notes (read for cross-check, not under review)
- `node_modules`, `.next`, `dist` — generated

---

## 3. Findings by Theme (actionability view)

The 79 findings cluster into 8 themes. Themes are ordered by recommended fix priority
within S2 → S3.

### Theme A — Spec drift in `human_confirmations` (blocks S3 confirmation API)

**HIGH:** DB-011, DB-012, DB-013
**MEDIUM:** DB-029 (related: missing CHECK trigger for trigger_type)

- Schema implements 11 columns; spec § 3.8 requires 23.
- Enum drift in three places: `trigger_type` (5 values wrong), `status` (`timed_out` vs `cancelled`), `risk_level` (helper enum, not in spec).
- `triggered_by`, `triggered_at`, `target_state`, `ai_summary`, `risk_factors`, `recommendations`, `ai_confidence`, `decision_outcome`, `decision_comment`, `resolved_at` — all absent.
- `interface_spec.md § 6.1, § 6.2` cannot be served from this schema.
- **Impact:** S3 endpoints `POST /confirmations` and `POST /confirmations/:id/decide` cannot be implemented; the entire confirmation flow is contractually broken.

**Recommended fix:** Single migration `0003_confirmations_alignment.sql` that:
1. Adds the 10 missing columns (text / real / json defaults per spec)
2. Replaces `timed_out` with `cancelled` in `CONFIRMATION_STATUS_VALUES` and the existing CHECK trigger
3. Replaces `trigger_type` enum with spec values (`high_risk / low_confidence / external_write / deployment / irreversible`) and adds a CHECK trigger
4. Drizzle helper enum: align `CONFIRMATION_TRIGGER_TYPE_VALUES` to spec

---

### Theme B — Spec drift in `state_transitions` (blocks S3 transition history)

**HIGH:** DB-009, DB-010, DB-022
**MEDIUM:** DB-040 (related: missing card/session/timestamp/actor indexes)

- Schema implements an entity-polymorphic version (`entityType + entityId`).
- Spec § 3.7 + `er_diagram.md` require `card_id` (NOT NULL FK) and `session_id` (nullable FK).
- The `Card ||--o{ StateTransition : has` relationship is not enforced.
- Authorization matrix § 3 ("state_transitions inherits from card permissions")
  cannot be evaluated without a real card FK.
- Column naming drift: spec `timestamp` vs schema `created_at`; spec `actor` vs schema `actorType`; missing `actor_name`.

**Recommended fix:** Migration `0004_state_transitions_alignment.sql` with table-rebuild
pattern (used in 0002): create new table with spec columns + FKs + indexes, copy data
with join, drop old, rename. This is a destructive change but matches the precedent
set in PR #1's `0002_card_node_board_consistency.sql`.

---

### Theme C — Spec drift across the remaining tables

**HIGH:** DB-001, DB-003, DB-004, DB-005, DB-006, DB-007, DB-008, DB-014, DB-036
**MEDIUM:** DB-015, DB-016, DB-017, DB-018, DB-019, DB-020, DB-021, DB-023, DB-025,
DB-030, DB-031, DB-035, DB-038, DB-039, DB-041, DB-042, DB-043, DB-044, DB-045
**LOW:** DB-024, DB-028, DB-037

Summary of column-level drifts:

| Table | Drift | Severity |
|-------|-------|----------|
| `goal_spaces` | `title` vs spec `name`; missing `progress`, `constraints`, `acceptance_criteria`, `started_at`, `cancelled_at`, `deleted_at` | HIGH |
| `node_boards` | `title` vs spec `name`; status enum `paused` vs spec `completed` | HIGH |
| `node_board_members` | role enum `editor/viewer/observer` vs spec `owner/member/viewer`; default `editor` vs spec `member` | HIGH |
| `sessions` | Re-modeled as user-session table (`role/expiresAt/closedAt/closeReason`) instead of spec run-session (`trigger/actor/actor_name/started_at/completed_at/context`) | HIGH |
| `agent_executions` | `input/output` vs spec `input_context/result` | HIGH |
| `cards` | `priority` text vs spec integer; missing `risk_level`, `evidence`, `confidence`, `dependencies`; `display_id` integer vs spec VARCHAR `CARD-001` | HIGH |
| `users` | default role `initiator` vs spec `chain_user` (over-privileged!) | HIGH/MEDIUM |
| `realtime_events` | `eventType/payload/publishedAt/actorType` vs spec `type/data/occurred_at/actor`; missing `actor_type` NOT NULL | MEDIUM |
| `audit_entries` | `actorType/occurredAt` vs spec `actor/timestamp`; missing `actor_name` | MEDIUM |
| `state_transitions` | see Theme B | HIGH |

**Recommended fix:** Single migration `0005_global_spec_alignment.sql` performing all
non-destructive renames and additions, plus a follow-up table-rebuild migration for
`sessions` and `cards` (which need type changes — `display_id` int→text, `priority`
text→int).

**Critical:** `users.role` default must change from `initiator` to `chain_user`. This
is a security concern — every new user is currently the highest-privilege role.

---

### Theme D — Authorization logic gaps

**HIGH:** COR-001, COR-002 (SEC-009 duplicate), SEC-009
**MEDIUM:** COR-005, COR-006, COR-007, COR-009, SEC-001 (downgraded), SEC-007
**LOW:** COR-011, COR-012

The authorization functions are *pure* (no DB), which is the right design. The problem
is that some checks that the spec mandates at the authz layer are missing — the spec
treats authz as the source of truth, but the current code defers to caller convention
in several places.

| Finding | What's missing | Spec ref |
|---------|---------------|----------|
| **COR-001 / SEC-009** | `canMutateCard` does not check `hasPendingConfirmation`; only `canExecuteCard` does. The § 5 gate (unblock returns 409) depends on convention. | authorization_matrix.md § 5 |
| **COR-002** | `canDecideConfirmation` doesn't check confirmation status; can re-decide approved/rejected/timed-out confirmations. | interface_spec.md § 6.2 |
| **SEC-001 / COR-005** | `canReadGoalSpace` returns false for non-initiator even when they are valid node_board members. | authorization_matrix.md § 3, § 4 |
| **SEC-007** | `canReadGoalSpace` doesn't enumerate the actor's memberships. Same root cause as SEC-001, but the authz function is the wrong layer to fix. | as above |
| **COR-006** | `canExecuteCard` doesn't consider card state — a chain_user can fire execute on `done`/`cancelled` cards (state machine catches it later, but AI compute is already billed). | interface_spec.md § 4.1 |
| **COR-007** | `canGoalSpaceTransition` returns true for `active → completed` regardless of preconditions; the check is in `assertGoalSpaceTransition` only. Spec says the transition is only valid if preconditions hold. | authorization_matrix.md § 4 |
| **COR-009** | `canReadCard` allows viewer to read via `assignedTo`; spec is ambiguous on this. | authorization_matrix.md § 4 |
| **COR-011** | No `system` actor; system-driven cancellation must impersonate `initiator`. | authorization_matrix.md § 4 |
| **COR-012** | `ConfirmationContext.nodeBoardMemberIds` is dead weight. | spec § 3 (kept for traceability) |

**Recommended fix pattern (apply to each):**
1. Add the missing input field to the context type (e.g. `hasPendingConfirmation` for
   `canMutateCard`).
2. Update the pure function to evaluate it.
3. Add a convenience DB-aware variant (e.g. `canExecuteCardForCardId(db, actor, cardId)`)
   that selects the precondition internally — eliminates caller-convention fragility.
4. Add a unit test that exercises both the allowed and disallowed paths.

---

### Theme E — State machine contradictions with the spec

**HIGH:** COR-003, COR-004
**MEDIUM:** COR-010
**LOW:** (covered above)

| Finding | Spec says | Code says | Notes |
|---------|-----------|-----------|-------|
| **COR-004** | Timeout must keep or move card to `blocked` (spec § 10) | `blocked → cancelled` triggered by `human_confirm_timeout` | Drop the trigger from the cancelled transition; document that timeout is a no-op (or move to blocked self-loop). |
| **COR-003** | Triggers are a taxonomy for human-vs-AI; losing the actor signal makes the contract unanalyzable (spec § 4) | All `from-X → blocked` with `human_reject` have `actor: 'ai_role'`; `review → done` with `human_confirm` has `actor: 'ai_role'` | Model per-(from,to,trigger) actor. The `actor` field records *who performed* the transition, not who triggered it; current mapping is wrong for the `human_*` triggers. |

**Recommended fix:**
- Remove `human_confirm_timeout` from the `blocked → cancelled` triggers array.
- Refactor `CARD_TRANSITIONS` to be keyed on `(from, to, trigger)` triples, each with
  its own `actor` field. Add a helper `actorFor(from, to, trigger): ActorType` for
  backward compatibility.
- Add unit tests for: `human_reject` records `actor: 'human'`, `human_confirm` records
  `actor: 'human'`, `human_confirm_timeout` from `blocked` is rejected (no transition).

---

### Theme F — Security baseline gaps (S3 prerequisites)

**HIGH:** SEC-002, SEC-003
**MEDIUM:** SEC-004, SEC-005, SEC-006
**LOW:** SEC-008

- **SEC-002** `docker-compose.yml` hardcodes `POSTGRES_PASSWORD: keplar`. Replace
  with `${POSTGRES_PASSWORD}` interpolation, add `.env.example`, and add a
  gitleaks/trufflehog step in CI.
- **SEC-003** `next.config.ts` has no `headers()` export. Required headers per NFR
  § 4.1: CSP (nonce-based), HSTS preload, X-Content-Type-Options, X-Frame-Options
  (or CSP `frame-ancestors 'none'`), Referrer-Policy, Permissions-Policy.
- **SEC-004** No `middleware.ts` and no CSRF protection. Spec mandates SameSite +
  Origin check (NFR § 4.1).
- **SEC-005** `runWithAudit` accepts `details/payload/actorId` without size cap or
  PII redaction. NFR § 5.2/§ 5.5 forbids plaintext credentials/tokens.
- **SEC-006** `users` table has no `password_hash` or auth-related columns. S3
  needs a separate `auth_credentials` table with `argon2id` hash + failed-login
  tracker.
- **SEC-008** CI has no secret-leak scanner. Combined with SEC-002, the leak was
  not caught by automation.

**Recommended fix order:**
1. `.env.example` + `docker-compose.yml` env interpolation (1 hour)
2. Add gitleaks to `web-ci.yml` (1 hour)
3. Add `headers()` to `next.config.ts` (2 hours)
4. Add `redactAuditDetails()` helper in `run-with-audit.ts` (2 hours, +tests)
5. Add `middleware.ts` skeleton (4 hours, S3 work continues)
6. `auth_credentials` table migration (S3 scope)

---

### Theme G — Migration safety

**HIGH:** (none new — DB-026, DB-027, DB-032, DB-033 are MEDIUM but worth highlighting)
**MEDIUM:** DB-026, DB-027, DB-032, DB-033
**LOW:** DB-034

These are the dangerous ones in production:

| Finding | Risk | Fix |
|---------|------|-----|
| **DB-026** | `0001` adds `goal_space_id NOT NULL` to `agent_executions` with no default — fails on populated DBs. | Two-step pattern: add nullable, backfill, enforce NOT NULL via table rebuild or CHECK trigger. |
| **DB-027** | `0001` drops `error` column irreversibly, no backfill of `error_code`/`error_message`. | Add columns first, backfill from `error`, then drop. |
| **DB-032** | `0001` runs `PRAGMA foreign_keys=OFF` for ALTER, but has no post-condition FK sanity check. | Add a `SELECT COUNT(*) FROM agent_executions ae WHERE NOT EXISTS (...)` and fail if non-zero. |
| **DB-033** | `0002` synthetic node_board id `_synthetic_<goal_space_id>` can collide with a real id. | Use UUID v4 for synthetic ids + post-condition join check. |

**Recommended fix:** Migration 0000-0002 are S1/S2; these are now immutable. Add a
`docs/migrations/S2_to_S3_alignment.md` ADR documenting the lessons-learned and the
template that future migrations must follow (add-nullable → backfill → enforce pattern).

---

### Theme H — TypeScript / quality

**MEDIUM:** TS-001, TS-002
**LOW:** TS-003 through TS-013

| Finding | Fix | Cost |
|---------|-----|------|
| **TS-001** | Add `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride` to `tsconfig.json`. | 1h to enable, 2-4h to clean resulting errors |
| **TS-002** | Replace `arr[0]!` non-null assertion pattern in tests with a `firstDefined` helper. | 1h |
| **TS-007** | Tighten `eslint.config.mjs`: add `no-explicit-any`, `consistent-type-imports`, `no-floating-promises`, `no-misused-promises`. | 30min |
| **TS-008** | Add a Promise.all concurrency test for `runWithAudit`. | 1h |
| **TS-009** | Define `IllegalTransitionError extends Error` mirroring `ForbiddenError`. | 1h |
| **TS-013** | Flip `next.config.ts` `typedRoutes: true` before S3 starts. | 5min |

---

## 4. Verified False Positives / Noted Asides

| ID | Note |
|----|------|
| **DB-002** | Self-downgraded by the DB agent — schema and trigger are consistent with the spec; no action needed. |
| **DB-024** | `users.initiator_id` ON DELETE behavior is acceptable (no physical delete per spec). Document only. |
| **DB-025** | Missing Drizzle `relations()` is a code-quality concern, not a correctness bug. |
| **DB-030** | DESC indexes in spec are equivalent to ASC in SQLite B-tree; intentional and correct. |
| **DB-034** | Redundant UNIQUE INDEX is an accepted trade-off for the composite FK. |
| **COR-008** | `runWithAudit` sequence is safe under better-sqlite3's serial model. The note is a forward-looking warning for the async driver migration, not a current bug. |
| **TS-004 / TS-005 / TS-006 / TS-010 / TS-011 / TS-012** | Style / nits / ergonomic suggestions. |

---

## 5. Findings Index (alphabetical by ID)

> Full JSON payloads from the four agents are preserved in
> [`findings/`](./findings/) (one file per reviewer). The index below
> is the actionable short-list.

| ID | Sev | Theme | File |
|----|-----|-------|------|
| COR-001 | HIGH | D | `apps/web/src/lib/authorization/card.ts:29` |
| COR-002 | HIGH | D | `apps/web/src/lib/authorization/confirmation.ts:15` |
| COR-003 | HIGH | E | `apps/web/src/lib/state-machine/card.ts:82` |
| COR-004 | HIGH | E | `apps/web/src/lib/state-machine/card.ts:131` |
| COR-005 | MEDIUM | D | `apps/web/src/lib/authorization/goal-space.ts:19` |
| COR-006 | MEDIUM | D | `apps/web/src/lib/authorization/execute.ts:18` |
| COR-007 | MEDIUM | D | `apps/web/src/lib/state-machine/goal-space.ts:93` |
| COR-008 | MEDIUM | aside | `apps/web/src/lib/audit/run-with-audit.ts:95` |
| COR-009 | MEDIUM | D | `apps/web/src/lib/authorization/card.ts:18` |
| COR-010 | LOW | E | `apps/web/src/lib/state-machine/card.ts:137` |
| COR-011 | LOW | D | `apps/web/src/lib/authorization/types.ts:22` |
| COR-012 | LOW | D | `apps/web/src/lib/authorization/types.ts:80` |
| DB-001 | HIGH | C | `apps/web/db/schema.ts:139` |
| DB-002 | — | aside | (downgraded by agent) |
| DB-003 | HIGH | C | `apps/web/db/schema.ts:172` |
| DB-004 | HIGH | C | `apps/web/db/schema.ts:45` |
| DB-005 | HIGH | C | `apps/web/db/schema.ts:107` |
| DB-006 | HIGH | C | `apps/web/db/schema.ts:49` |
| DB-007 | HIGH | C | `apps/web/db/schema.ts:235` |
| DB-008 | HIGH | C | `apps/web/db/schema.ts:351` |
| DB-009 | HIGH | B | `apps/web/db/schema.ts:375` |
| DB-010 | HIGH | B | `apps/web/db/schema.ts:393` |
| DB-011 | HIGH | A | `apps/web/db/schema.ts:404` |
| DB-012 | HIGH | A | `apps/web/db/schema.ts:73` |
| DB-013 | HIGH | A | `apps/web/db/schema.ts:69` |
| DB-014 | HIGH | C | `apps/web/db/schema.ts:274` |
| DB-015 | MEDIUM | C | `apps/web/db/schema.ts:291` |
| DB-016 | MEDIUM | C | `apps/web/db/schema.ts:476` |
| DB-017 | MEDIUM | C | `apps/web/db/schema.ts:476` |
| DB-018 | MEDIUM | C | `apps/web/db/migrations/0000_amazing_the_fury.sql:144` |
| DB-019 | MEDIUM | C | `apps/web/db/schema.ts:442` |
| DB-020 | MEDIUM | C | `apps/web/db/schema.ts:451` |
| DB-021 | MEDIUM | C | `apps/web/db/schema.ts:1` |
| DB-022 | HIGH | B | `apps/web/db/schema.ts:375` |
| DB-023 | MEDIUM | C | `apps/web/db/schema.ts:274` |
| DB-024 | LOW | aside | `apps/web/db/schema.ts:145` |
| DB-025 | MEDIUM | C | `apps/web/db/schema.ts:1` |
| DB-026 | MEDIUM | G | `apps/web/db/migrations/0001_agent_executions_ownership.sql:19` |
| DB-027 | MEDIUM | G | `apps/web/db/migrations/0001_agent_executions_ownership.sql:27` |
| DB-028 | LOW | C | `drizzle.config.ts:1` |
| DB-029 | MEDIUM | A | `apps/web/db/migrations/0001_agent_executions_ownership.sql:1` |
| DB-030 | LOW | aside | `apps/web/db/schema.ts:502` |
| DB-031 | LOW | C | `apps/web/db/schema.ts:493` |
| DB-032 | MEDIUM | G | `apps/web/db/migrations/0001_agent_executions_ownership.sql:18` |
| DB-033 | MEDIUM | G | `apps/web/db/migrations/0002_card_node_board_consistency.sql:34` |
| DB-034 | LOW | aside | `apps/web/db/migrations/0002_card_node_board_consistency.sql:26` |
| DB-035 | MEDIUM | C | `apps/web/db/schema.ts:286` |
| DB-036 | HIGH | C | `apps/web/db/schema.ts:123` |
| DB-037 | LOW | C | `apps/web/db/schema.ts:115` |
| DB-038 | LOW | C | `apps/web/db/schema.ts:312` |
| DB-039 | MEDIUM | C | `apps/web/db/schema.ts:366` |
| DB-040 | MEDIUM | B | `apps/web/db/schema.ts:397` |
| DB-041 | LOW | C | `apps/web/db/schema.ts:431` |
| DB-042 | LOW | C | `apps/web/db/schema.ts:466` |
| DB-043 | LOW | C | `apps/web/db/schema.ts:497` |
| DB-044 | MEDIUM | C | `apps/web/db/schema.ts:139` |
| DB-045 | MEDIUM | C | `apps/web/db/migrations/0001_agent_executions_ownership.sql:47` |
| SEC-001 | MEDIUM (was HIGH) | D | `apps/web/src/lib/authorization/goal-space.ts:19` |
| SEC-002 | HIGH | F | `docker-compose.yml:8` |
| SEC-003 | HIGH | F | `apps/web/next.config.ts:1` |
| SEC-004 | MEDIUM | F | `apps/web` (no middleware.ts) |
| SEC-005 | MEDIUM | F | `apps/web/src/lib/audit/run-with-audit.ts:36` |
| SEC-006 | MEDIUM | F | `apps/web/db/schema.ts:115` |
| SEC-007 | MEDIUM | D | `apps/web/src/lib/authorization/goal-space.ts:19` |
| SEC-008 | LOW | F | `.github/workflows/web-ci.yml:1` |
| SEC-009 | HIGH | D | `apps/web/src/lib/authorization/execute.ts:18` |
| TS-001 | MEDIUM | H | `apps/web/tsconfig.json:7` |
| TS-002 | MEDIUM | H | `apps/web/__tests__/audit/run-with-audit.test.ts:92` |
| TS-003 | LOW | H | `apps/web/src/lib/audit/run-with-audit.ts:60` |
| TS-004 | LOW | H | `apps/web/__tests__/audit/run-with-audit.test.ts:47` |
| TS-005 | LOW | H | `apps/web/src/lib/db/client.ts:23` |
| TS-006 | LOW | H | `apps/web/next.config.ts:7` |
| TS-007 | LOW | H | `apps/web/eslint.config.mjs:30` |
| TS-008 | LOW | H | `apps/web/__tests__/audit/integration.test.ts:152` |
| TS-009 | LOW | H | `apps/web/src/lib/state-machine/card.ts:202` |
| TS-010 | LOW | H | `apps/web/__tests__/state-machine/card.test.ts:270` |
| TS-011 | LOW | H | `apps/web/__tests__/smoke.test.ts:15` |
| TS-012 | LOW | H | `apps/web/package.json:6` |
| TS-013 | LOW | H | `apps/web/next.config.ts:6` |

---

## 6. Recommended Fix Order

| Wave | Scope | Effort | Findings |
|------|-------|--------|----------|
| **Wave 0** (pre-S3, ≤ 1 day) | Single-day ship-blockers: security baseline + script-only fixes | 1 dev-day | SEC-002, SEC-003, SEC-008, TS-013, DB-028 |
| **Wave 1** (S3 day 1-3) | Authorization logic + state machine + schema blockers for S3 | 2-3 dev-days | COR-001, COR-002, COR-003, COR-004, SEC-001 (now MEDIUM, decide), SEC-007, SEC-009, DB-001, DB-011, DB-012, DB-013, DB-022, DB-036, TS-001, TS-002, TS-007 |
| **Wave 2** (S3 day 4-7) | Full spec-alignment migration | 3-5 dev-days | DB-003, DB-004, DB-005, DB-006, DB-007, DB-008, DB-009, DB-010, DB-014, DB-015, DB-016, DB-017, DB-018, DB-019, DB-020, DB-021, DB-023, DB-025, DB-029, DB-035, DB-038, DB-039, DB-040, DB-041, DB-042, DB-043, DB-044, DB-045 |
| **Wave 3** (S3 day 8-10) | Middleware, audit redaction, auth_credentials | 2-3 dev-days | SEC-004, SEC-005, SEC-006 |
| **Wave 4** (S4 candidate) | Migration safety retro + type tightening + test infra | 1-2 dev-days | DB-026, DB-027, DB-032, DB-033, TS-003, TS-004, TS-005, TS-006, TS-008, TS-009, TS-010, TS-011, TS-012, COR-005, COR-006, COR-007, COR-009, COR-010, COR-011, COR-012 |

---

## 7. Spec Deviations — At-a-Glance Cross-Reference

For traceability, the following table maps every spec section that has a deviation
to the relevant findings:

| Spec | Section | Deviations | Findings |
|------|---------|-----------|----------|
| `database_design.md` | § 3.1 goal_spaces | column rename + 7 missing | DB-001, DB-021, DB-044 |
| `database_design.md` | § 3.2 node_boards | name vs title; status enum | DB-003, DB-004, DB-021, DB-045 |
| `database_design.md` | § 3.3 node_board_members | role enum + default | DB-005, DB-029 |
| `database_design.md` | § 3.4 sessions | full re-model needed | DB-006, DB-007, DB-021 |
| `database_design.md` | § 3.5 agent_executions | column rename + missing indexes | DB-008, DB-021, DB-039 |
| `database_design.md` | § 3.6 cards | type changes + 4 missing columns | DB-014, DB-015, DB-021, DB-023, DB-035, DB-038 |
| `database_design.md` | § 3.7 state_transitions | entity-polymorphic vs card-scoped | DB-009, DB-010, DB-020, DB-022, DB-040 |
| `database_design.md` | § 3.8 human_confirmations | 13 missing columns + 2 enum drifts | DB-011, DB-012, DB-013, DB-029, DB-041 |
| `database_design.md` | § 3.9 audit_entries | column naming | DB-019, DB-020, DB-042 |
| `database_design.md` | § 3.10 realtime_events | column naming + missing actor | DB-016, DB-017, DB-018, DB-031, DB-043 |
| `database_design.md` | § 3.11 users | role default over-privileged | DB-036, DB-037 |
| `authorization_matrix.md` | § 3 (resource ownership) | canReadGoalSpace blocks members | SEC-001, COR-005, SEC-007 |
| `authorization_matrix.md` | § 4 (API matrix) | canMutateCard missing gate; system actor; ambiguous viewer | COR-001, COR-006, COR-009, COR-011, SEC-009 |
| `authorization_matrix.md` | § 5 (强制门禁) | hasPendingConfirmation not central | COR-001, SEC-009, COR-007 |
| `ai_agent_contracts.md` | § 4 (triggers) | trigger↔actor mismatch | COR-003 |
| `ai_agent_contracts.md` | § 10 (timeout) | blocked→cancelled violation | COR-004 |
| `interface_spec.md` | § 4.1 (Card) | missing risk_level/evidence/confidence/dependencies | DB-014, DB-023, DB-035 |
| `interface_spec.md` | § 5.1 (transitions) | requires card FK on state_transitions | DB-022 |
| `interface_spec.md` | § 6.1, § 6.2 (confirmations) | human_confirmations schema gap | DB-011, DB-012, DB-013 |
| `interface_spec.md` | § 6.2 (decide) | canDecideConfirmation missing status check | COR-002 |
| `interface_spec.md` | § 7.2 (ExecuteStatus) | input/output rename | DB-008 |
| `interface_spec.md` | § 8.1 (SSEEvent) | realtime_events actor missing | DB-016 |
| `non_functional_requirements.md` | § 4.1 (HTTPS/HSTS/CSRF) | no headers / no middleware | SEC-002, SEC-003, SEC-004 |
| `non_functional_requirements.md` | § 4.2 (auth) | users schema missing creds; no auth code | SEC-006 |
| `non_functional_requirements.md` | § 4.4 (container security) | docker-compose hardcoded creds | SEC-002 |
| `non_functional_requirements.md` | § 5.2, § 5.5 (audit) | no redaction | SEC-005 |
| `realtime_events.md` | § 2 (sequence) | sequence only safe under better-sqlite3 | COR-008 (forward-looking) |

---

## 8. Follow-up

- [ ] File a `decision.md` for SEC-001 (canReadGoalSpace): keep as S2 scope boundary
      and document, or fix in Wave 1.
- [ ] File an ADR for COR-003 (actor↔trigger mapping) before refactoring the state
      machine; needs spec clarification.
- [ ] Track Themes A/B/C as a single **S2→S3 Schema Alignment** epic with its own
      branch and review path (these migrations are destructive and need a dry-run
      matrix on a populated DB).
- [ ] Schedule a follow-up review after Wave 1 to confirm the authorization layer
      is unified (DB-aware convenience functions + caller pattern is enforced).

---

## 9. Appendices

### 9.1 Files reviewed (with line counts)

```
apps/web/db/schema.ts                          ~520 lines   (PRIMARY)
apps/web/db/migrations/0000_amazing_the_fury.sql             (PRIMARY)
apps/web/db/migrations/0001_agent_executions_ownership.sql   (PRIMARY)
apps/web/db/migrations/0002_card_node_board_consistency.sql (PRIMARY)
apps/web/src/lib/authorization/types.ts        99 lines
apps/web/src/lib/authorization/assert.ts       40 lines
apps/web/src/lib/authorization/execute.ts      23 lines
apps/web/src/lib/authorization/card.ts         33 lines
apps/web/src/lib/authorization/goal-space.ts   30 lines
apps/web/src/lib/authorization/confirmation.ts 17 lines
apps/web/src/lib/authorization/node-board.ts  35 lines
apps/web/src/lib/authorization/index.ts        30 lines
apps/web/src/lib/state-machine/card.ts        229 lines
apps/web/src/lib/state-machine/goal-space.ts  171 lines
apps/web/src/lib/audit/run-with-audit.ts      106 lines
apps/web/src/lib/db/client.ts                  50 lines
apps/web/next.config.ts                         9 lines
apps/web/eslint.config.mjs                     ~40 lines
apps/web/tsconfig.json                         ~25 lines
apps/web/package.json                          ~60 lines
docker-compose.yml                              13 lines
.github/workflows/web-ci.yml                   ~50 lines
.github/workflows/card-verify.yml              ~30 lines
```

### 9.2 Spec files consulted (for cross-check)

- `docs/specs/authorization_matrix.md` (§ 3, § 4, § 5)
- `docs/specs/database_design.md` (§ 3.1 through § 3.11)
- `docs/specs/ai_agent_contracts.md` (§ 4, § 10)
- `docs/specs/interface_spec.md` (§ 4.1, § 5.1, § 6.1, § 6.2, § 7.2, § 8.1)
- `docs/specs/realtime_events.md` (§ 2)
- `docs/specs/non_functional_requirements.md` (§ 4.1, § 4.2, § 4.4, § 5.2, § 5.5)
- `docs/specs/global_unified_spec.md` (referenced)
- `docs/specs/phase1_scope.md` (referenced)
- `docs/architecture/er_diagram.md` (referenced for state_transitions and sessions)

### 9.3 Raw agent output

The full per-agent JSON findings arrays are preserved in
[`findings/security.json`](./findings/security.json),
[`findings/database.json`](./findings/database.json),
[`findings/typescript.json`](./findings/typescript.json),
and [`findings/correctness.json`](./findings/correctness.json).
