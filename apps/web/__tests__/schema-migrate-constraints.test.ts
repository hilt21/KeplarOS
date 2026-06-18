/**
 * T-100..T-104: 0000 + 0001 + 0002 migration end-to-end, exercising:
 *   1. enum CHECK triggers reject illegal values (per PR #1 review P2 #4)
 *   2. orphan agent_executions insert is blocked by NOT NULL goal_space_id
 *   3. cross-goal-space card/node_board insert is blocked by composite FK
 *   4. cross-owner goal space read is rejected by canReadGoalSpace (sanity)
 *   5. agent_executions.task_id (id) cannot bypass card / goal_space permissions
 *      because the row carries both FKs; the authorization layer in S3 will
 *      call canReadCard / canReadGoalSpace before exposing task_id.
 *
 * 真相源: docs/specs/database_design.md + authorization_matrix.md
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import Database from "better-sqlite3";
import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { canReadGoalSpace } from "@/lib/authorization";

const MIGRATIONS_DIR = resolve(__dirname, "../db/migrations");

function loadMigrations(db: Database.Database): void {
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  for (const f of files) {
    db.exec(readFileSync(join(MIGRATIONS_DIR, f), "utf8"));
  }
}

function insertBaseFixtures(db: Database.Database): void {
  db.exec("PRAGMA foreign_keys = ON");
  db.prepare(
    "INSERT INTO users (id, name, email, role) VALUES ('u1', 'Alice', 'alice@x.com', 'initiator')",
  ).run();
  db.prepare(
    "INSERT INTO users (id, name, email, role) VALUES ('u2', 'Bob', 'bob@x.com', 'initiator')",
  ).run();
  db.prepare(
    "INSERT INTO goal_spaces (id, initiator_id, name, status) VALUES ('g1', 'u1', 'Goal 1', 'draft')",
  ).run();
  db.prepare(
    "INSERT INTO goal_spaces (id, initiator_id, name, status) VALUES ('g2', 'u2', 'Goal 2', 'draft')",
  ).run();
  db.prepare(
    "INSERT INTO node_boards (id, goal_space_id, key, name, status) VALUES ('b1', 'g1', 'main', 'Main', 'active')",
  ).run();
  db.prepare(
    "INSERT INTO node_boards (id, goal_space_id, key, name, status) VALUES ('b2', 'g2', 'main', 'Main', 'active')",
  ).run();
  db.prepare(
    "INSERT INTO cards (id, goal_space_id, node_board_id, display_id, title, state) VALUES ('c1', 'g1', 'b1', 1, 'C', 'backlog')",
  ).run();
}

describe("T-100: enum CHECK triggers reject illegal values", () => {
  let db: Database.Database;
  beforeAll(() => {
    db = new Database(":memory:");
    loadMigrations(db);
    insertBaseFixtures(db);
  });
  afterAll(() => db?.close());

  it("users.role rejects 'admin'", () => {
    expect(() =>
      db
        .prepare("INSERT INTO users (id, name, email, role) VALUES ('u3', 'E', 'e@x.com', 'admin')")
        .run(),
    ).toThrow(/users\.role must be one of/i);
  });

  it("goal_spaces.status rejects 'paused'", () => {
    expect(() =>
      db
        .prepare(
          "INSERT INTO goal_spaces (id, initiator_id, name, status) VALUES ('g3', 'u1', 'X', 'paused')",
        )
        .run(),
    ).toThrow(/goal_spaces\.status must be one of/i);
  });

  it("cards.state rejects 'wontfix'", () => {
    expect(() =>
      db
        .prepare(
          "INSERT INTO cards (id, goal_space_id, node_board_id, display_id, title, state) VALUES ('c2', 'g1', 'b1', 2, 'X', 'wontfix')",
        )
        .run(),
    ).toThrow(/cards\.state must be one of/i);
  });

  it("agent_executions.status rejects the legacy 'pending' (P1 #2 enum realignment)", () => {
    expect(() =>
      db
        .prepare(
          "INSERT INTO agent_executions (id, goal_space_id, card_id, agent_role, trigger, status) VALUES ('e1', 'g1', 'c1', 'Dev', 'manual', 'pending')",
        )
        .run(),
    ).toThrow(/agent_executions\.status must be one of/i);
  });

  it("agent_executions.requested_by_type rejects 'robot'", () => {
    expect(() =>
      db
        .prepare(
          "INSERT INTO agent_executions (id, goal_space_id, card_id, agent_role, trigger, status, requested_by_type) VALUES ('e2', 'g1', 'c1', 'Dev', 'manual', 'queued', 'robot')",
        )
        .run(),
    ).toThrow(/agent_executions\.requested_by_type must be one of/i);
  });

  it("BEFORE UPDATE trigger also rejects 'wontfix' on cards.state (symmetric enforcement)", () => {
    expect(() => db.prepare("UPDATE cards SET state = 'wontfix' WHERE id = 'c1'").run()).toThrow(
      /cards\.state must be one of/i,
    );
  });
});

describe("T-101: orphan agent_executions blocked (PR #1 review P1 #2)", () => {
  let db: Database.Database;
  beforeAll(() => {
    db = new Database(":memory:");
    loadMigrations(db);
    insertBaseFixtures(db);
  });
  afterAll(() => db?.close());

  it("insert without goal_space_id fails on NOT NULL", () => {
    expect(() =>
      db
        .prepare(
          "INSERT INTO agent_executions (id, card_id, agent_role, trigger, status) VALUES ('e3', 'c1', 'Dev', 'manual', 'queued')",
        )
        .run(),
    ).toThrow(/NOT NULL constraint failed: agent_executions\.goal_space_id/i);
  });

  it("insert without card_id fails on NOT NULL (enforced by trigger since card_id column is nullable in 0000)", () => {
    expect(() =>
      db
        .prepare(
          "INSERT INTO agent_executions (id, goal_space_id, agent_role, trigger, status) VALUES ('e4', 'g1', 'Dev', 'manual', 'queued')",
        )
        .run(),
    ).toThrow(/agent_executions\.card_id must not be NULL/i);
  });

  it("insert with non-existent goal_space_id fails on FK", () => {
    expect(() =>
      db
        .prepare(
          "INSERT INTO agent_executions (id, goal_space_id, card_id, agent_role, trigger, status) VALUES ('e5', 'g-bogus', 'c1', 'Dev', 'manual', 'queued')",
        )
        .run(),
    ).toThrow(/FOREIGN KEY constraint failed/i);
  });
});

describe("T-102: cross-goal-space card blocked by composite FK (PR #1 review P1 #3)", () => {
  let db: Database.Database;
  beforeAll(() => {
    db = new Database(":memory:");
    loadMigrations(db);
    insertBaseFixtures(db);
  });
  afterAll(() => db?.close());

  it("inserting a card whose node_board belongs to a different goal_space fails", () => {
    expect(() =>
      db
        .prepare(
          "INSERT INTO cards (id, goal_space_id, node_board_id, display_id, title) VALUES ('c2', 'g1', 'b2', 2, 'cross-space')",
        )
        .run(),
    ).toThrow(/FOREIGN KEY constraint failed/i);
  });
});

describe("T-103: cross-owner goal space read is rejected (PR #1 review P1 #1)", () => {
  it("canReadGoalSpace returns false when actor is an initiator of a different goal_space", () => {
    expect(
      canReadGoalSpace(
        { id: "u1", role: "initiator" },
        { goalSpaceId: "g2", initiatorId: "u2", nodeBoardMemberIds: [] },
      ),
    ).toBe(false);
  });

  it("canReadGoalSpace returns true when actor is the owner", () => {
    expect(
      canReadGoalSpace(
        { id: "u1", role: "initiator" },
        { goalSpaceId: "g1", initiatorId: "u1", nodeBoardMemberIds: [] },
      ),
    ).toBe(true);
  });
});

describe("T-104: agent_executions row is always bound to a card and goal_space (row-shape guarantee for S3 authorize())", () => {
  let db: Database.Database;
  beforeAll(() => {
    db = new Database(":memory:");
    loadMigrations(db);
    insertBaseFixtures(db);
  });
  afterAll(() => db?.close());

  it("an agent_execution id can always be JOINed to its card and goal_space (the row-shape guarantee S3 authorize() will rely on)", () => {
    db.prepare(
      "INSERT INTO agent_executions (id, goal_space_id, card_id, agent_role, trigger, status) VALUES ('e6', 'g1', 'c1', 'Dev', 'manual', 'queued')",
    ).run();
    const row = db
      .prepare(
        "SELECT ae.id AS task_id, ae.goal_space_id, c.id AS card_id, c.node_board_id, nb.goal_space_id AS nb_goal_space_id " +
          "FROM agent_executions ae " +
          "JOIN cards c ON c.id = ae.card_id " +
          "JOIN node_boards nb ON nb.id = c.node_board_id AND nb.goal_space_id = c.goal_space_id " +
          "WHERE ae.id = 'e6'",
      )
      .get() as {
      task_id: string;
      goal_space_id: string;
      card_id: string;
      node_board_id: string;
      nb_goal_space_id: string;
    };
    expect(row.task_id).toBe("e6");
    expect(row.goal_space_id).toBe("g1");
    expect(row.card_id).toBe("c1");
    expect(row.node_board_id).toBe("b1");
    expect(row.nb_goal_space_id).toBe("g1");
  });
});

describe("T-105: DB-041 idx_human_confirmations_decided_by index exists (spec § 3.8)", () => {
  let db: Database.Database;
  beforeAll(() => {
    db = new Database(":memory:");
    loadMigrations(db);
    insertBaseFixtures(db);
  });
  afterAll(() => db?.close());

  it("idx_human_confirmations_decided_by is created on the decision_by column", () => {
    const idx = db
      .prepare(
        "SELECT name, sql FROM sqlite_master WHERE type='index' AND name='idx_human_confirmations_decided_by'",
      )
      .get() as { name: string; sql: string } | undefined;
    expect(idx).toBeDefined();
    expect(idx!.sql).toMatch(/human_confirmations/i);
    expect(idx!.sql).toMatch(/decision_by/i);
  });
});

/**
 * T-106: Wave 4 Sub-group A — migration safety retro (DB-026/027/032/033)
 *
 *   DB-026 (0001: goal_space_id NOT NULL with no DEFAULT)
 *     Verified by T-101: the agent_executions row with NULL goal_space_id
 *     is rejected by NOT NULL. No retro migration is needed.
 *
 *   DB-027 (0001: 'error' column dropped without backfill)
 *     Verified by inspecting PRAGMA table_info('agent_executions'):
 *     error_code and error_message are present; 'error' is absent. No
 *     data was preserved — documented in 0012's migration header.
 *
 *   DB-032 (0001: PRAGMA foreign_keys=OFF window during ALTER TABLE)
 *     Verified by T-101/T-102/T-104: after PRAGMA foreign_keys=ON, the FK
 *     constraints 0001 added (goal_space_id → goal_spaces.id) are
 *     actively enforced by the test fixtures. No retro migration needed.
 *
 *   DB-033 (0002: synthetic node_board id collision risk)
 *     Defensive guard installed in 0012 — verified below.
 */
describe("T-106: Wave 4 Sub-group A migration safety retro (DB-026/027/032/033)", () => {
  let db: Database.Database;
  beforeAll(() => {
    db = new Database(":memory:");
    loadMigrations(db);
    insertBaseFixtures(db);
  });
  afterAll(() => db?.close());

  it("DB-026: agent_executions.goal_space_id is NOT NULL after the migration set runs", () => {
    const col = db
      .prepare("PRAGMA table_info('agent_executions')")
      .all()
      .find((c) => (c as { name: string }).name === "goal_space_id") as
      | { name: string; notnull: number }
      | undefined;
    expect(col).toBeDefined();
    expect(col!.notnull).toBe(1);
  });

  it("DB-027: error_code and error_message columns exist on agent_executions; 'error' does not", () => {
    const cols = db.prepare("PRAGMA table_info('agent_executions')").all() as Array<{
      name: string;
    }>;
    const names = new Set(cols.map((c) => c.name));
    expect(names.has("error_code")).toBe(true);
    expect(names.has("error_message")).toBe(true);
    expect(names.has("error")).toBe(false);
  });

  it("DB-032: FK from agent_executions.goal_space_id -> goal_spaces.id is enforced with PRAGMA foreign_keys=ON", () => {
    // The fact that T-101's "insert with non-existent goal_space_id fails on FK"
    // passes already proves this; assert it here too for self-contained coverage.
    expect(() =>
      db
        .prepare(
          "INSERT INTO agent_executions (id, goal_space_id, card_id, agent_role, trigger, status) VALUES ('e-t106', 'g-bogus', 'c1', 'Dev', 'manual', 'queued')",
        )
        .run(),
    ).toThrow(/FOREIGN KEY constraint failed/i);
  });

  it("DB-033: 0012 installs trg_node_boards_synthetic_id_format (insert) and _u (update) defensive triggers", () => {
    const triggers = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='trigger' AND name LIKE '%synthetic_id_format%'",
      )
      .all() as Array<{ name: string }>;
    const names = triggers.map((t) => t.name);
    expect(names).toContain("trg_node_boards_synthetic_id_format");
    expect(names).toContain("trg_node_boards_synthetic_id_format_u");
  });

  it("DB-033: synthetic node_board with the canonical id ('_synthetic_' || goal_space_id) is accepted", () => {
    expect(() =>
      db
        .prepare(
          "INSERT INTO node_boards (id, goal_space_id, key, name, status) VALUES ('_synthetic_g1', 'g1', 'synthetic', 'Synthetic', 'archived')",
        )
        .run(),
    ).not.toThrow();
  });

  it("DB-033: synthetic node_board with a mismatched id is rejected by the defensive trigger", () => {
    expect(() =>
      db
        .prepare(
          "INSERT INTO node_boards (id, goal_space_id, key, name, status) VALUES ('wrong_id', 'g1', 'synthetic', 'Bad Synthetic', 'archived')",
        )
        .run(),
    ).toThrow(/synthetic node_board\.id must equal/i);
  });

  it("DB-033: non-synthetic node_boards are unaffected by the trigger", () => {
    // The base fixtures insert 'b1' and 'b2' as non-synthetic rows; this
    // assertion re-asserts that the trigger's WHEN clause excludes them.
    // If the trigger fired for any insert, the fixture setup itself would
    // have thrown. Verify with a fresh insert here as a positive control.
    expect(() =>
      db
        .prepare(
          "INSERT INTO node_boards (id, goal_space_id, key, name, status) VALUES ('b-extra', 'g1', 'extra', 'Extra', 'active')",
        )
        .run(),
    ).not.toThrow();
  });
});
