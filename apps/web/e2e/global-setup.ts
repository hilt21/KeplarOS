/**
 * Playwright global setup (F2-10).
 *
 * Runs once before any test in the suite. The Playwright web-server lifecycle
 * has already recreated and migrated the dedicated E2E SQLite database; this
 * setup only seeds a minimal goal space + card fixture so cross-spec tests that depend
 * on finding a `CARD-*` link on `/goal-spaces` (master-pane,
 * task-timeline) can run without each spec having to create its own
 * data through the UI.
 *
 * Seed failures are fatal: a missing or unmigrated E2E database must stop the
 * suite before browser actions run.
 */

import Database from "better-sqlite3";
import { existsSync } from "node:fs";

import { hashPassword } from "../src/lib/auth/password";
import { requireE2eDatabasePath } from "./db-path";

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
  const databasePath = requireE2eDatabasePath();
  if (!existsSync(databasePath)) {
    throw new Error(`E2E database was not prepared: ${databasePath}`);
  }
  const sqlite = new Database(databasePath);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  const now = new Date().toISOString();

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
  } finally {
    sqlite.close();
  }
}
