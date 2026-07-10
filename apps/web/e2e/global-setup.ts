/**
 * Playwright global setup (F2-10).
 *
 * Runs once before any test in the suite. Applies all migrations to
 * the dev SQLite DB so that the seed user insertion in the spec's
 * `beforeAll` can write against a fully-migrated schema. Then seeds
 * a minimal goal space + card fixture so cross-spec tests that depend
 * on finding a `CARD-*` link on `/goal-spaces` (master-pane,
 * task-timeline) can run without each spec having to create its own
 * data through the UI.
 *
 * Migration files use plain `CREATE TABLE` / `ALTER TABLE ADD COLUMN`
 * (not `IF NOT EXISTS`), so naive reruns against a long-lived dev.db
 * raise "already exists" / "duplicate column" / "no such column"
 * errors. We track which migrations have already been applied via
 * a sidecar `__global_setup_applied` table; on rerun, we skip files
 * we've already recorded as applied (whether they ran cleanly this
 * time or in a previous run before the sidecar existed). Migrations
 * that error with an idempotency-style message are recorded as
 * applied so subsequent runs skip them too.
 *
 * The seed block uses `INSERT OR IGNORE` so reruns are no-ops.
 * Wrapped in try/catch with a `console.warn` so that schema drift in
 * the seed doesn't crash the suite — the dependent specs will still
 * be skipped/fail loudly if they can't find data.
 */

import { resolve } from "node:path";
import { existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import Database from "better-sqlite3";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { hashPassword } from "../src/lib/auth/password";

const DEV_DB_PATH = resolve(process.cwd(), "db/dev.db");
const MIGRATIONS_DIR = resolve(process.cwd(), "db/migrations");
const APPLIED_TABLE = "__global_setup_applied";

// ─── seed constants (kept in sync with phase2-board.spec.ts) ──────────
const SEED_USER_ID = "e2e-user-00000001";
const SEED_USER_EMAIL = "e2e@keplar.test";
const SEED_USER_NAME = "E2E Initiator";
const SEED_USER_ROLE = "initiator";
const SEED_PASSWORD = "e2e-password";

const SEED_GOAL_SPACE_ID = "e2e-gs-00000001";
const SEED_BOARD_ID = "e2e-board-00000001";
const SEED_CARD_ID = "e2e-card-00000001";
const SEED_CARD_DISPLAY_ID = "CARD-001";

export default async function globalSetup(): Promise<void> {
  const dir = dirname(DEV_DB_PATH);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  const sqlite = new Database(DEV_DB_PATH);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");

  // Sidecar metadata table. CREATE TABLE IF NOT EXISTS so this itself
  // is idempotent on the very first run.
  sqlite.exec(
    `CREATE TABLE IF NOT EXISTS ${APPLIED_TABLE} (
       filename TEXT PRIMARY KEY,
       applied_at TEXT NOT NULL
     )`,
  );

  const appliedRows = sqlite.prepare(`SELECT filename FROM ${APPLIED_TABLE}`).all() as {
    filename: string;
  }[];
  const applied = new Set(appliedRows.map((r) => r.filename));

  const insertApplied = sqlite.prepare(
    `INSERT OR IGNORE INTO ${APPLIED_TABLE} (filename, applied_at) VALUES (?, ?)`,
  );

  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  const now = new Date().toISOString();

  for (const f of files) {
    if (applied.has(f)) continue;
    const sql = readFileSync(join(MIGRATIONS_DIR, f), "utf8");
    try {
      sqlite.exec(sql);
      insertApplied.run(f, now);
    } catch (err) {
      // The dev DB predates the sidecar metadata table on first run
      // after P3-04: many migrations will fail with idempotency-style
      // errors because the schema is already in place. Treat those
      // as "already applied" so subsequent runs skip them cleanly.
      const message = err instanceof Error ? err.message : String(err);
      if (
        /already exists|duplicate column|no such column|no such table|cannot start a transaction within a transaction/i.test(
          message,
        )
      ) {
        insertApplied.run(f, now);
      } else {
        throw err;
      }
    }
  }

  // ─── seed minimal fixture for cross-spec tests ─────────────────────
  // master-pane.spec.ts and task-timeline.spec.ts both login as
  // e2e@keplar.test and look for a `CARD-*` link on /goal-spaces. We
  // seed one user + goal space + node board + card so both specs can
  // find their target. `phase2-board.spec.ts` already creates its own
  // goal space + board + card through the UI, so this seed is purely
  // for specs that don't generate their own data.
  try {
    const passwordHash = await hashPassword(SEED_PASSWORD);

    sqlite
      .prepare(
        `INSERT OR IGNORE INTO users
           (id, name, email, role, preferences, created_at)
         VALUES (?, ?, ?, ?, '{}', ?)`,
      )
      .run(SEED_USER_ID, SEED_USER_NAME, SEED_USER_EMAIL, SEED_USER_ROLE, now);

    sqlite
      .prepare(
        `INSERT OR IGNORE INTO auth_credentials
           (user_id, password_hash, failed_login_attempts, last_rotated_at)
         VALUES (?, ?, 0, ?)`,
      )
      .run(SEED_USER_ID, passwordHash, now);

    sqlite
      .prepare(
        `INSERT OR IGNORE INTO goal_spaces
           (id, initiator_id, name, description, constraints, status,
            progress, tags, started_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, '[]', 'active', 0, '[]', ?, ?, ?)`,
      )
      .run(
        SEED_GOAL_SPACE_ID,
        SEED_USER_ID,
        "E2E base goal space",
        "Seeded by global-setup.ts for cross-spec tests.",
        now,
        now,
        now,
      );

    sqlite
      .prepare(
        `INSERT OR IGNORE INTO node_boards
           (id, goal_space_id, key, name, status, display_order,
            context, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'active', 0, '{}', ?, ?)`,
      )
      .run(SEED_BOARD_ID, SEED_GOAL_SPACE_ID, "main", "Main board", now, now);

    sqlite
      .prepare(
        `INSERT OR IGNORE INTO node_board_members
           (id, board_id, user_id, role, joined_at)
         VALUES (lower(hex(randomblob(16))), ?, ?, 'owner', ?)`,
      )
      .run(SEED_BOARD_ID, SEED_USER_ID, now);

    sqlite
      .prepare(
        `INSERT OR IGNORE INTO cards
           (id, goal_space_id, node_board_id, display_id, title, state,
            assigned_to, priority, risk_level, evidence, confidence,
            dependencies, tags, context, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 'backlog', ?, 50, 'low', '[]', 0.5,
                 '[]', '[]', '{}', ?, ?)`,
      )
      .run(
        SEED_CARD_ID,
        SEED_GOAL_SPACE_ID,
        SEED_BOARD_ID,
        SEED_CARD_DISPLAY_ID,
        "E2E base card",
        SEED_USER_ID,
        now,
        now,
      );
  } catch (err) {
    // Schema drift may turn one of these INSERTs into an error in a
    // future migration cycle. Log and continue so the suite still runs.
    console.warn(
      "[global-setup] seed insert failed (non-fatal):",
      err instanceof Error ? err.message : String(err),
    );
  }

  sqlite.close();
}
