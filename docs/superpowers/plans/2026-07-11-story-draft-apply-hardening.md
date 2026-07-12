# Story Draft Apply Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** Make deterministic Story draft apply deployable, initiator-scoped, strictly validated, bounded, and demonstrably idempotent without adding LLM or external execution.

**Architecture:** Drafts remain ephemeral until explicit apply. The existing runWithAudit transaction creates one Goal Space, initial Board, Cards, audit entry, and realtime event. Idempotency is unique per initiator and recovers an application-key unique conflict as a replay. The repository raw SQLite files become executable through a project-owned migration command and ledger, rather than an empty Drizzle journal.

**Tech Stack:** Next.js 15, TypeScript, Drizzle ORM, better-sqlite3, SQLite, Vitest, Playwright, pnpm.

---

## Frozen decisions

- The same story_application_id used by two different initiators creates two independent workspaces. A retry by the same initiator returns the original workspace with applied: false.
- Any invalid supplied Story field returns INVALID_FIELD (400); untrusted values are never silently filtered.
- Limits are 50 Cards, 50 values in each top-level string collection, and 4,000 characters per editable string.
- Domain fields persist as they do today. Accepted output_requirements and risk_hints are retained in immutable story_draft.apply audit details; no server-side draft lifecycle/table is introduced.
- Retain raw SQL migrations. Replace the non-functional drizzle-kit migrate command with a ledger-backed migration command which supports empty databases and a verified 0000–0012 database.
- This change does not add an LLM, MCP/ACP/A2A, external I/O, automatic Card execution, role-specific UI, or token metering.

## File structure

| File | Responsibility |
| --- | --- |
| .harness/changes/20260711-story-draft-apply-hardening/request_analysis/{spec,tasks}.md | Required approval-gated remediation record. |
| apps/web/scripts/migrate.mjs | Raw-SQL migration command and migration ledger/bootstrap. |
| apps/web/package.json | Run that command for db:migrate. |
| apps/web/db/migrations/0014_story_application_id_scope.sql | Replace global uniqueness with initiator-scoped uniqueness. |
| apps/web/db/schema.ts | Match the composite unique index. |
| apps/web/src/lib/{db/repositories/goal-spaces,services/story-drafts}.ts | Scoped lookup and race recovery. |
| apps/web/src/app/api/v1/story-drafts/apply/route.ts | Strict HTTP validation and limits. |
| apps/web/__tests__/{db/migrate-cli,api/story-drafts,services/story-drafts}.test.ts | Migration, contract, authorization, and integration coverage. |
| apps/web/src/__tests__/ui/create-goal-space-form.test.tsx | UI error-contract coverage. |
| apps/web/e2e/phase2-board.spec.ts | Edited draft becomes the initial Card. |
| docs/specs/{interface_spec,database_design,realtime_events,ai_agent_contracts}.md | Accurate product and technical contracts. |

### Task 1: Open the governed remediation change

**Files:**
- Create: .harness/changes/20260711-story-draft-apply-hardening/request_analysis/spec.md
- Create: .harness/changes/20260711-story-draft-apply-hardening/request_analysis/tasks.md

- [ ] **Step 1: Write request analysis**

Record this acceptance table:

~~~markdown
| ID | Criterion |
| --- | --- |
| AC-1 | pnpm --filter @keplar/web db:migrate applies 0013 and 0014 to empty and verified pre-0013 SQLite databases. |
| AC-2 | Idempotency is private to an initiator; cross-initiator retry never returns another Goal Space ID. |
| AC-3 | A same-initiator unique-key race produces one domain result and a 200 replay, never 500. |
| AC-4 | Every supplied Story field is validated element-by-element; invalid input writes no domain, audit, or realtime record. |
| AC-5 | Valid output requirements and risk hints are traceable in audit details. |
| AC-6 | The flow remains deterministic, no-I/O, and non-executing. |
~~~

- [ ] **Step 2: Write implementation tasks and stop condition**

Include Tasks 2–7 below and:

~~~markdown
## Approval gate

Do not modify application source, migrations, tests, or product documents until
a human explicitly approves this request analysis.
~~~

- [ ] **Step 3: Stop for approval**

Report the change ID and wait. This is mandatory under AGENTS.md.

### Task 2: Make checked-in SQL migrations executable

**Files:**
- Create: apps/web/scripts/migrate.mjs
- Modify: apps/web/package.json:15-25
- Test: apps/web/__tests__/db/migrate-cli.test.ts

- [ ] **Step 1: Write failing migration-command tests**

Create two tests that launch pnpm --filter @keplar/web db:migrate with KEPLAR_DB_PATH pointing at a temporary file:

~~~ts
it('applies every checked-in migration to an empty database', () => {
  const path = temporaryDatabasePath();
  expect(runMigrate(path).status).toBe(0);
  const sqlite = new Database(path);
  expect(columnNames(sqlite, 'goal_spaces')).toContain('story_application_id');
  expect(indexSql(sqlite, 'idx_goal_spaces_initiator_story_application_id_unique'))
    .toMatch(/UNIQUE INDEX.*initiator_id.*story_application_id/i);
  expect(appliedFiles(sqlite)).toContain('0014_story_application_id_scope.sql');
});

it('adopts a verified pre-0013 database and applies new migrations', () => {
  const path = createDatabaseFromSqlFilesThrough('0012_migration_safety_retro.sql');
  expect(runMigrate(path).status).toBe(0);
  const sqlite = new Database(path);
  expect(columnNames(sqlite, 'goal_spaces')).toContain('story_application_id');
  expect(appliedFiles(sqlite)).toContain('0014_story_application_id_scope.sql');
});
~~~

- [ ] **Step 2: Run the test to prove the current failure**

Run: pnpm --filter @keplar/web test -- __tests__/db/migrate-cli.test.ts

Expected: FAIL because the current Drizzle journal has no entries and db:migrate ignores the raw SQL sequence.

- [ ] **Step 3: Implement the migration runner**

Create apps/web/scripts/migrate.mjs with these constants:

~~~js
const databasePath = process.env.KEPLAR_DB_PATH ?? resolve(process.cwd(), 'db/dev.db');
const migrationsDir = resolve(process.cwd(), 'db/migrations');
const ledgerTable = '__keplar_migrations';
const files = readdirSync(migrationsDir).filter((name) => name.endsWith('.sql')).sort();
~~~

The runner must:

1. Open better-sqlite3, enable foreign_keys and journal_mode = WAL.
2. Create __keplar_migrations(filename TEXT PRIMARY KEY, applied_at TEXT NOT NULL).
3. When the ledger is empty and goal_spaces has both acceptance_criteria and cancelled_at, and auth_credentials exists, insert filenames through 0012 as an explicit legacy baseline in one transaction.
4. When the database is neither empty nor that verified pre-0013 shape, throw and exit non-zero. Never guess a baseline.
5. For every unrecorded SQL file, execute its complete contents and insert its filename in the ledger within the same transaction.
6. Print Applied <filename>; print No pending migrations when none remain.

Update package.json:

~~~json
"db:migrate": "node scripts/migrate.mjs"
~~~

- [ ] **Step 4: Run and commit**

Run: pnpm --filter @keplar/web test -- __tests__/db/migrate-cli.test.ts

Expected: PASS.

~~~bash
git add apps/web/scripts/migrate.mjs apps/web/package.json apps/web/__tests__/db/migrate-cli.test.ts
git commit -m 'fix(db): run checked-in sqlite migrations reliably'
~~~

### Task 3: Make Story application uniqueness initiator-scoped

**Files:**
- Create: apps/web/db/migrations/0014_story_application_id_scope.sql
- Modify: apps/web/db/schema.ts:209-215
- Test: apps/web/__tests__/db/migrate-cli.test.ts

- [ ] **Step 1: Extend the failing migration assertion**

~~~ts
expect(indexSql(sqlite, 'idx_goal_spaces_story_application_id_unique')).toBeUndefined();
expect(indexSql(sqlite, 'idx_goal_spaces_initiator_story_application_id_unique'))
  .toContain('initiator_id');
~~~

- [ ] **Step 2: Run the test to prove failure**

Run: pnpm --filter @keplar/web test -- __tests__/db/migrate-cli.test.ts

Expected: FAIL because 0013 still creates a global index.

- [ ] **Step 3: Add the forward-only migration and matching schema**

~~~sql
DROP INDEX IF EXISTS idx_goal_spaces_story_application_id_unique;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS idx_goal_spaces_initiator_story_application_id_unique
ON goal_spaces (initiator_id, story_application_id);--> statement-breakpoint
~~~

Replace the schema declaration with:

~~~ts
storyApplicationIdUnique: uniqueIndex(
  'idx_goal_spaces_initiator_story_application_id_unique',
).on(t.initiatorId, t.storyApplicationId),
~~~

Keep the column nullable so manually created Goal Spaces remain valid.

- [ ] **Step 4: Verify and commit**

Run: pnpm --filter @keplar/web test -- __tests__/db/migrate-cli.test.ts __tests__/schema-types.test.ts

Expected: PASS.

~~~bash
git add apps/web/db/migrations/0014_story_application_id_scope.sql apps/web/db/schema.ts apps/web/__tests__/db/migrate-cli.test.ts
git commit -m 'fix(db): scope story application keys to initiators'
~~~

### Task 4: Scope retries and recover only the expected race

**Files:**
- Modify: apps/web/src/lib/db/repositories/goal-spaces.ts:36-105
- Modify: apps/web/src/lib/services/story-drafts.ts:53-138
- Test: apps/web/__tests__/services/story-drafts.test.ts

- [ ] **Step 1: Write failing service tests**

Seed two initiators and add:

~~~ts
it('does not reuse one initiator key for another initiator', () => {
  const draft = generateStoryDraft('Ship the beta');
  const first = applyStoryDraft('shared-key', draft, initiatorA, db);
  const second = applyStoryDraft('shared-key', draft, initiatorB, db);
  expect(second.applied).toBe(true);
  expect(second.goal_space_id).not.toBe(first.goal_space_id);
});
~~~

For the collision path, use a narrow database test double: the first scoped lookup returns no row, the transaction raises SQLITE_CONSTRAINT_UNIQUE after a same-initiator fixture is inserted, and the recovery lookup returns that fixture. Assert the exact replay result: goal_space_id existing, empty card_ids, applied false.

- [ ] **Step 2: Run the test to prove failure**

Run: pnpm --filter @keplar/web test -- __tests__/services/story-drafts.test.ts

Expected: FAIL because the lookup is global and unique errors escape.

- [ ] **Step 3: Implement scoped lookup and recovery**

Add this repository helper:

~~~ts
export function findGoalSpaceByStoryApplication(
  db: DrizzleDb | AuditTx,
  initiatorId: string,
  storyApplicationId: string,
): { id: string } | null {
  const row = db.select({ id: goalSpaces.id }).from(goalSpaces)
    .where(and(
      eq(goalSpaces.initiatorId, initiatorId),
      eq(goalSpaces.storyApplicationId, storyApplicationId),
    )).get();
  return row ? { id: row.id } : null;
}
~~~

Use it before apply and after only a SQLITE_CONSTRAINT_UNIQUE whose message names idx_goal_spaces_initiator_story_application_id_unique. Re-throw every other database, Card, audit, or event error. The catch surrounds only runWithAudit, so a collided transaction produces no second audit/event record.

- [ ] **Step 4: Verify and commit**

Run: pnpm --filter @keplar/web test -- __tests__/services/story-drafts.test.ts __tests__/authorization/goal-space.test.ts

Expected: PASS.

~~~bash
git add apps/web/src/lib/db/repositories/goal-spaces.ts apps/web/src/lib/services/story-drafts.ts apps/web/__tests__/services/story-drafts.test.ts
git commit -m 'fix(story): scope and recover draft application retries'
~~~

### Task 5: Validate and bound every editable Story field

**Files:**
- Modify: apps/web/src/app/api/v1/story-drafts/apply/route.ts:7-80
- Modify: apps/web/src/lib/services/story-drafts.ts:11-138
- Create: apps/web/__tests__/api/story-drafts.test.ts
- Modify: apps/web/__tests__/services/story-drafts.test.ts

- [ ] **Step 1: Write failing route tests**

Use existing route-test-harness.ts, mock the service, and assert no service call for each malformed request:

~~~ts
it.each([
  { constraints: [42] },
  { acceptance_criteria: [{ criterion: 'x', evidence: [false] }] },
  { output_requirements: [{}] },
  { risk_hints: [null] },
  { cards: [] },
])('returns INVALID_FIELD for malformed Story input', async (patch) => {
  const response = await postApply({ story_application_id: 'app-1', draft: { ...validDraft, ...patch } });
  await expectApiError(response, 'INVALID_FIELD', 400);
  expect(applyStoryDraftMock).not.toHaveBeenCalled();
});
~~~

Also assert unauthenticated is 401, a chain user is 403, first apply is 201, replay is 200, and 51 Cards fail before the service writes a Goal Space.

- [ ] **Step 2: Run the tests to prove failure**

Run: pnpm --filter @keplar/web test -- __tests__/api/story-drafts.test.ts __tests__/services/story-drafts.test.ts

Expected: FAIL because the route filters malformed values and has no limits.

- [ ] **Step 3: Implement strict parsers**

~~~ts
const MAX_STORY_CARDS = 50;
const MAX_STORY_COLLECTION_ITEMS = 50;
const MAX_STORY_TEXT_LENGTH = 4_000;

function requireText(value: unknown, field: string): string {
  const text = requireString(value, field).trim();
  if (!text) throw new ApiRequestError('INVALID_FIELD', field + ' must not be blank.');
  if (text.length > MAX_STORY_TEXT_LENGTH)
    throw new ApiRequestError('INVALID_FIELD', field + ' is too long.');
  return text;
}
~~~

Implement parseStringList that rejects non-arrays, arrays over 50, and every non-string or blank element. Require every acceptance_criteria[i].evidence[j] to pass requireText. Require at most 50 Cards and validate card title/description/priority/risk individually. Do not use filter for request validation. Repeat the card-count invariant in applyStoryDraft so direct callers cannot bypass the route.

- [ ] **Step 4: Preserve accepted planning fields in audit data**

~~~ts
data: {
  story_application_id: storyApplicationId,
  output_requirements: [...draft.output_requirements],
  risk_hints: [...draft.risk_hints],
  card_ids: cardIds,
},
~~~

Add an integration assertion that reads the audit entry and compares these values exactly.

- [ ] **Step 5: Verify and commit**

Run: pnpm --filter @keplar/web test -- __tests__/api/story-drafts.test.ts __tests__/services/story-drafts.test.ts

Expected: PASS.

~~~bash
git add apps/web/src/app/api/v1/story-drafts/apply/route.ts apps/web/src/lib/services/story-drafts.ts apps/web/__tests__/api/story-drafts.test.ts apps/web/__tests__/services/story-drafts.test.ts
git commit -m 'fix(story): validate and bound editable draft input'
~~~

### Task 6: Prove the edited browser workflow and update contracts

**Files:**
- Modify: apps/web/e2e/phase2-board.spec.ts:148-170
- Modify: apps/web/src/__tests__/ui/create-goal-space-form.test.tsx:15-80
- Modify: docs/specs/interface_spec.md:102-113
- Modify: docs/specs/database_design.md:194-219
- Modify: docs/specs/realtime_events.md:13-54
- Modify: docs/specs/ai_agent_contracts.md:9-16

- [ ] **Step 1: Write the failing browser proof**

~~~ts
const editor = page.getByLabel(/Editable Story draft/);
const draft = JSON.parse(await editor.inputValue());
draft.cards[0].title = 'Edited initial planning';
draft.cards[0].priority = 60;
await editor.fill(JSON.stringify(draft, null, 2));
await page.getByRole('button', { name: 'Apply draft and create workspace' }).click();
await expect(page.getByText('Edited initial planning')).toBeVisible({ timeout: 15_000 });
~~~

In the UI test, add a failed apply response and assert its API error message is displayed.

- [ ] **Step 2: Run focused UI checks to prove failure**

Run: pnpm --filter @keplar/web test -- src/__tests__/ui/create-goal-space-form.test.tsx

Expected: FAIL until the error path is made distinguishable.

Run: pnpm --filter @keplar/web e2e -- phase2-board.spec.ts

Expected: FAIL until the initial Card is actually asserted.

- [ ] **Step 3: Make the minimal UI error correction**

Parse JSON before entering the fetch try block. On JSON parse failure, set Draft must be valid JSON, clear busy state, and return. For a non-success API response, retain body.error message or Unable to apply draft. Do not add UI fields, styling, or retry behavior.

- [ ] **Step 4: Reconcile documentation**

Add this to interface_spec.md:

~~~markdown
story_application_id is unique per initiator. A same-initiator replay returns
200 and the original Goal Space; a different initiator never receives or reuses
that Goal Space. Every supplied Story field is validated before mutation.
Invalid input returns INVALID_FIELD (400) and writes nothing.
~~~

In database_design.md, add nullable story_application_id and the composite index. In realtime_events.md, add story_draft.applied and document story_application_id and card_ids. In ai_agent_contracts.md, state that output requirements/risk hints are audit-trace data, not real LLM output or execution commands.

- [ ] **Step 5: Verify and commit**

Run:

~~~bash
pnpm --filter @keplar/web test -- src/__tests__/ui/create-goal-space-form.test.tsx __tests__/api/story-drafts.test.ts __tests__/services/story-drafts.test.ts
pnpm --filter @keplar/web e2e -- phase2-board.spec.ts
~~~

Expected: PASS.

~~~bash
git add apps/web/e2e/phase2-board.spec.ts apps/web/src/__tests__/ui/create-goal-space-form.test.tsx docs/specs/interface_spec.md docs/specs/database_design.md docs/specs/realtime_events.md docs/specs/ai_agent_contracts.md
git commit -m 'test(docs): prove and document story draft application'
~~~

### Task 7: Verify delivery and record Harness evidence

**Files:**
- Create: .harness/changes/20260711-story-draft-apply-hardening/review/findings.md
- Create: .harness/changes/20260711-story-draft-apply-hardening/implementation/notes.md
- Create: .harness/changes/20260711-story-draft-apply-hardening/testing/results.md
- Create: .harness/changes/20260711-story-draft-apply-hardening/delivery/summary.md
- Create: .harness/changes/20260711-story-draft-apply-hardening/handoff.md

- [ ] **Step 1: Run complete verification**

~~~bash
pnpm --filter @keplar/web typecheck
pnpm --filter @keplar/web lint
pnpm --filter @keplar/web test
pnpm --filter @keplar/web build
pnpm --filter @keplar/web e2e
git diff --check
~~~

Expected: all commands exit 0. Record actual test/E2E counts, lint warnings, Node version, and any non-failing existing warnings.

- [ ] **Step 2: Record review closure**

List each reviewed defect, fix, evidence path, and proving test. Link to the historical 20260711-story-draft-cards record; do not rewrite it.

- [ ] **Step 3: Commit delivery evidence**

~~~bash
git add .harness/changes/20260711-story-draft-apply-hardening
git commit -m 'docs(harness): record story draft hardening delivery'
~~~

## Self-review

- Migration execution: Tasks 2–3.
- Cross-user isolation and same-user race recovery: Task 4.
- Strict validation, bounds, no silent field loss, and traceable audit data: Task 5.
- Edited initial Card and user-visible errors: Task 6.
- Full quality gates and governed delivery record: Task 7.
- No LLM/external-execution scope creep: frozen decisions and Task 7.

No implementation placeholder remains: each task names files, tests, expected command outcomes, and the required code or behavior.

