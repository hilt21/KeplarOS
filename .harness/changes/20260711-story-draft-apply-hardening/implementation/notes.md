# Implementation Notes

Change ID: `20260711-story-draft-apply-hardening`

## Implemented Work

### Migration command and baseline safety

- Added `apps/web/scripts/migrate.mjs` as the project-owned raw-SQL SQLite
  migration command.
- Updated `apps/web/package.json` so `db:migrate` runs that command.
- The command tracks applied files in `__keplar_migrations`, applies each SQL
  file and its ledger entry in one SQLite transaction, and supports
  `KEPLAR_DB_PATH`.
- An empty database applies all checked-in migrations. A legacy database can
  baseline only when its complete application schema snapshot equals the
  0000–0012 snapshot; bookkeeping tables from the prior Drizzle command are
  excluded from that comparison. Other non-empty untracked databases fail
  without receiving a ledger.

### Initiator-scoped application-key index

- Added forward-only migration `0014_story_application_id_scope.sql`.
- It replaces the global Story application key index with
  `idx_goal_spaces_initiator_story_application_id_unique` over
  `(initiator_id, story_application_id)`.
- Updated the Drizzle schema to declare that same nullable composite index.
- Migration CLI tests inspect `PRAGMA index_list` and `PRAGMA index_info`
  so a non-unique, reordered, or over-broad index cannot pass unnoticed.

### Scoped idempotency and unique-conflict recovery

- Added a repository lookup that is scoped by both initiator and application
  key.
- Story apply now lets different initiators use the same client key without
  sharing a workspace.
- It recovers only the real better-sqlite3 composite-key unique error, performs
  a second scoped lookup, and otherwise rethrows the original error.
- Tests use a real SQLite duplicate error and prove that conflict recovery
  creates no second Goal Space, Board, membership, Card, audit entry, or
  realtime event.

### Strict Story validation and audit traceability

- Replaced silent filtering with strict route-level validation for every
  editable Story field, including nested acceptance evidence.
- Added bounded request validation and a shared UTF-8 audit-payload preflight
  so oversized but individually valid values return a 4xx before writes.
- Direct service callers retain the Card-count and audit-size invariants.
- Applied output requirements and risk hints are preserved in immutable audit
  details without adding a draft table.

## Files Changed So Far

- `apps/web/scripts/migrate.mjs`
- `apps/web/package.json`
- `apps/web/__tests__/db/migrate-cli.test.ts`
- `apps/web/db/migrations/0014_story_application_id_scope.sql`
- `apps/web/db/schema.ts`
- `apps/web/src/lib/db/repositories/goal-spaces.ts`
- `apps/web/src/lib/services/story-drafts.ts`
- `apps/web/__tests__/services/story-drafts.test.ts`
- `apps/web/src/app/api/v1/story-drafts/apply/route.ts`
- `apps/web/__tests__/api/story-drafts.test.ts`

## Verification So Far

- Migration CLI test: 4 passed.
- `pnpm --filter @keplar/web typecheck`: passed.
- Targeted Prettier check: passed.
- `git diff --check`: passed.
- Schema type test: 10 passed.
- Story draft integration tests: 6 passed.
- Story route/service contract tests: 21 passed.

## Remaining Approved Work

- Add UI/E2E proof and documentation reconciliation.

## Risks / Deviations

- No scope deviation. The runner deliberately fails closed for an unknown
  non-empty SQLite database rather than attempting a speculative baseline.
- Full suite, E2E, and build verification remain pending until all approved
  F-001 work is complete.
