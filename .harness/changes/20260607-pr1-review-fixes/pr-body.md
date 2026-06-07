## Re-submission: address PR #1 review (closes all P1 + P2 must-fix items)

**Closes:** the 7 review items from hilt21's PR #1 comment.

| # | Severity | Item | Closing commit |
|---|----------|------|----------------|
| 1 | P1 | Goal Space read restricted to owner | `fix(auth): restrict goal space read to owner` |
| 2 | P1 | `agent_executions` ownership + enum realignment | `fix(db): enforce agent execution ownership and statuses` |
| 3 | P1 | Card / node board / goal space composite FK | `fix(db): enforce card node board goal space consistency` |
| 4 | P2 | CHECK constraints on 8 enum columns | `test(db): cover enum and ownership constraints` |
| 5 | P2 | Root `package.json` packageManager + .nvmrc | `chore(devex): unify pnpm + node verification entrypoints` |
| 6 | P2 | CI path filter + `pnpm check` | `ci: run web checks from workspace root` |
| 7 | P2 | Enum truth source reconciled | items 2 + 4 above |

Plus a tooling follow-up:

| # | Severity | Item | Closing commit |
|---|----------|------|----------------|
| – | chore | Prettier snapshot ignore + format fixups (required for `pnpm check` to pass) | `chore: prettier + drizzle-kit snapshot ignore` |

### Verification commands (reviewer's list)

- `nvm use` → reads `.nvmrc` → switches to Node 20.
- `corepack enable && corepack prepare pnpm@11.5.1 --activate` → pins pnpm.
- `pnpm install --frozen-lockfile` → no drift.
- `pnpm check` → runs typecheck + lint + test + build + format:check from the workspace root. **238/238 tests pass; build succeeds; typecheck + lint + format:check all clean.**

### Database sanity check (reviewer's list)

```bash
cd /Users/mac/KeplarOS && rm -f apps/web/db/dev.db && cd apps/web && pnpm db:migrate
sqlite3 db/dev.db "PRAGMA foreign_keys=ON; SELECT name FROM sqlite_master WHERE type='trigger' AND name LIKE '%check%' ORDER BY name"
sqlite3 db/dev.db "PRAGMA foreign_key_list(cards)"
```

Expected & observed:

- **16 enum-check triggers** (8 INSERT + 8 UPDATE, one per enum column: `users.role`, `goal_spaces.status`, `node_boards.status`, `sessions.status`, `cards.state`, `agent_executions.status`, `agent_executions.requested_by_type`, `human_confirmations.status`).
- **Composite FK** on `cards`: `id=1` rows in `PRAGMA foreign_key_list(cards)` show `(node_board_id, goal_space_id) -> node_boards(id, goal_space_id)`. Supported by a `CREATE UNIQUE INDEX idx_node_boards_id_goal_space_unique` on the parent table (FK target must be UNIQUE/PK in SQLite).
- **card_id NOT NULL**: enforced by a BEFORE INSERT/UPDATE trigger pair `trg_agent_executions_card_id_notnull{,_u}` (SQLite cannot `ALTER COLUMN ... SET NOT NULL`, so the trigger is the idiomatic equivalent). Header comment in `0001_agent_executions_ownership.sql` documents the choice.

### Test coverage delta

- 225/225 (S1 + F-001 + F-002 + F-003 + F-004, pre-Commit-4) → 238/238 (+13 in `schema-migrate-constraints.test.ts`).
- The 5 reviewer-suggested test scenarios are all covered:
  - illegal enum insert fails (T-100, 5 cases)
  - orphan `agent_executions` insert fails (T-101, 3 cases)
  - cross-goal-space card insert fails (T-102)
  - cross-owner goal space read rejected (T-103, 2 cases)
  - `agent_executions.id` (the future `task_id` alias) is always bound to a card and goal_space via the FK chain (T-104, JOIN-based row-shape test)

### Scope statement

This PR does NOT modify:

- `apps/desktop/`
- `crates/*`, `Cargo.toml`
- `DESIGN.md`
- `docs/**` (the `database_design.md` § 3.5 table is the truth source and was already correct; only the code, migration, and tests were aligned to it)
- `README.md`
- `AGENTS.md`, `CLAUDE.md`, `LICENSE`

It does modify the S2 F-001 / F-002 / F-003 / F-004 deliverables within the application package, adds two migrations under `apps/web/db/migrations/`, and adds a `schema-migrate-constraints.test.ts` covering the migration end-to-end. No API handler, no UI, no AI executor is added.

### Risk register

- The 0001 migration adds `goal_space_id` as `NOT NULL` to `agent_executions`. On a populated S2 dev DB the column would need a follow-up backfill UPDATE (the migration does not do it because the source column did not exist before the ADD; this is documented in the SQL header). On a fresh dev DB the migration applies cleanly.
- The 0001 migration's `card_id NOT NULL` is enforced by a trigger pair, not a column constraint, because SQLite cannot `ALTER COLUMN ... SET NOT NULL`. The trigger is load-bearing for the row-shape guarantee that S3 `authorize()` will rely on.
- The 0002 migration introduces a synthetic archived node_board per goal_space during backfill. This is a one-shot data fix; once the migration has been applied to a DB, re-running it is a no-op (the `INSERT OR IGNORE` is idempotent). The composite FK will then reject any future cross-space writes.
- Enum triggers fire BEFORE INSERT and BEFORE UPDATE. They do NOT cover DELETE (intentional — deletes should be soft). They do not retroactively validate existing rows; if a dev DB was carrying legacy `pending` / `timeout` values in `agent_executions.status`, those rows will fail the next UPDATE that touches them. The reviewer did not ask for a backfill there, and the spec is the source of truth.
- Commit `c0e54b0` (`chore: prettier + drizzle-kit snapshot ignore`) added an `.prettierignore` excluding `db/migrations/meta/` from prettier's check. This is a documented drizzle-kit/prettier toolchain friction: drizzle-kit emits single-element JSON arrays on their own lines; prettier's default JSON formatter collapses them. The snapshot files are auto-generated and re-emitted byte-for-byte on the next `drizzle-kit generate`, so a prettier rewrite would be reverted by the next migration anyway. Excluding them breaks the loop.

🤖 Generated with [Claude Code](https://claude.ai/code)
