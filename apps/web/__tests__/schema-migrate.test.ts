/**
 * T-002: 临时 in-memory SQLite 跑 0000 迁移 → 11 张表存在 →
 *        partial unique index 实际生效(插入重复 active 行失败)
 *
 * 真相源: docs/specs/database_design.md § 3.3 / § 5
 *
 * 此测试运行在 node 环境(vitest.config.mts environmentMatchGlobs 配置),以加载
 * better-sqlite3 native module。R-2 风险。
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import Database from "better-sqlite3";
import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

const MIGRATIONS_DIR = resolve(__dirname, "../db/migrations");

describe("T-002: 0000 migration applies cleanly + partial unique indexes actually enforce", () => {
  let db: Database.Database;
  let migrationSql: string;

  beforeAll(() => {
    const files = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql"));
    expect(files.length).toBeGreaterThanOrEqual(1);
    const sorted = files.sort();
    const first = sorted[0];
    if (first === undefined) {
      throw new Error("expected at least one migration file");
    }
    migrationSql = readFileSync(join(MIGRATIONS_DIR, first), "utf8");
    db = new Database(":memory:");
    db.exec(migrationSql);
  });

  afterAll(() => {
    db?.close();
  });

  it("migration file is parseable and contains all 11 expected tables", () => {
    const tables = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '__drizzle%' ORDER BY name",
      )
      .all() as Array<{ name: string }>;
    const tableNames = tables.map((t) => t.name);
    expect(tableNames).toEqual([
      "agent_executions",
      "audit_entries",
      "cards",
      "goal_spaces",
      "human_confirmations",
      "node_board_members",
      "node_boards",
      "realtime_events",
      "sessions",
      "state_transitions",
      "users",
    ]);
  });

  it("partial unique index idx_node_board_members_board_user_active is present and partial", () => {
    const idx = db
      .prepare(
        "SELECT name, sql FROM sqlite_master WHERE type='index' AND name='idx_node_board_members_board_user_active'",
      )
      .get() as { name: string; sql: string } | undefined;
    expect(idx).toBeDefined();
    expect(idx!.sql).toMatch(/WHERE/i);
    expect(idx!.sql).toMatch(/removed_at IS NULL/i);
  });

  it("partial unique index actually rejects a duplicate active membership row", () => {
    db.exec("PRAGMA foreign_keys = ON");
    db.prepare(
      "INSERT INTO users (id, name, email) VALUES ('u1', 'Alice', 'alice@example.com')",
    ).run();
    db.prepare(
      "INSERT INTO goal_spaces (id, initiator_id, title) VALUES ('g1', 'u1', 'Goal 1')",
    ).run();
    db.prepare(
      "INSERT INTO node_boards (id, goal_space_id, key, title) VALUES ('b1', 'g1', 'main', 'Main')",
    ).run();
    db.prepare(
      "INSERT INTO node_board_members (id, board_id, user_id, role) VALUES ('m1', 'b1', 'u1', 'editor')",
    ).run();

    expect(() =>
      db
        .prepare(
          "INSERT INTO node_board_members (id, board_id, user_id, role) VALUES ('m2', 'b1', 'u1', 'viewer')",
        )
        .run(),
    ).toThrow(/UNIQUE constraint failed/i);
  });

  it("soft-removed membership (removed_at set) does NOT block a fresh re-add (partial index scope)", () => {
    db.prepare("UPDATE node_board_members SET removed_at = datetime('now') WHERE id = 'm1'").run();
    expect(() =>
      db
        .prepare(
          "INSERT INTO node_board_members (id, board_id, user_id, role) VALUES ('m3', 'b1', 'u1', 'editor')",
        )
        .run(),
    ).not.toThrow();
  });

  it("partial unique index idx_cards_goal_space_display_id_active enforces soft-deleted display_id re-use", () => {
    db.prepare(
      "INSERT INTO cards (id, goal_space_id, node_board_id, display_id, title) VALUES ('c1', 'g1', 'b1', 1, 'Card 1')",
    ).run();
    expect(() =>
      db
        .prepare(
          "INSERT INTO cards (id, goal_space_id, node_board_id, display_id, title) VALUES ('c2', 'g1', 'b1', 1, 'Card 1 dup')",
        )
        .run(),
    ).toThrow(/UNIQUE constraint failed/i);

    db.prepare("UPDATE cards SET deleted_at = datetime('now') WHERE id = 'c1'").run();
    expect(() =>
      db
        .prepare(
          "INSERT INTO cards (id, goal_space_id, node_board_id, display_id, title) VALUES ('c3', 'g1', 'b1', 1, 'Card 1 reuse')",
        )
        .run(),
    ).not.toThrow();
  });

  it("partial unique index idx_human_confirmations_card_pending rejects a second pending confirmation per card", () => {
    db.prepare(
      "INSERT INTO human_confirmations (id, card_id, trigger_type, risk_level, expires_at) VALUES ('h1', 'c3', 'high_risk_action', 'medium', '2030-01-01 00:00:00')",
    ).run();
    expect(() =>
      db
        .prepare(
          "INSERT INTO human_confirmations (id, card_id, trigger_type, risk_level, expires_at) VALUES ('h2', 'c3', 'high_risk_action', 'high', '2030-01-01 00:00:00')",
        )
        .run(),
    ).toThrow(/UNIQUE constraint failed/i);

    db.prepare("UPDATE human_confirmations SET status = 'approved' WHERE id = 'h1'").run();
    expect(() =>
      db
        .prepare(
          "INSERT INTO human_confirmations (id, card_id, trigger_type, risk_level, expires_at) VALUES ('h3', 'c3', 'high_risk_action', 'low', '2030-01-01 00:00:00')",
        )
        .run(),
    ).not.toThrow();
  });

  it("UUID defaults are hex(32) — every default-generated id is unique and 32 chars", () => {
    // Insert without explicit id to exercise the default expression.
    db.prepare("INSERT INTO users (name, email) VALUES ('Bob', 'bob@example.com')").run();
    db.prepare("INSERT INTO users (name, email) VALUES ('Carol', 'carol@example.com')").run();
    // Exclude the explicit-id fixture row ('u1') — that one intentionally uses a literal.
    const rows = db.prepare("SELECT id FROM users WHERE id != 'u1' ORDER BY id").all() as Array<{
      id: string;
    }>;
    expect(rows.length).toBe(2);
    for (const r of rows) {
      expect(r.id).toMatch(/^[0-9a-f]{32}$/);
    }
    // The two generated ids must differ.
    expect(rows[0]!.id).not.toBe(rows[1]!.id);
  });

  it("JSON defaults are valid JSON for the 'object' shape", () => {
    const row = db
      .prepare("SELECT preferences FROM users WHERE email = 'alice@example.com'")
      .get() as { preferences: string };
    expect(() => JSON.parse(row.preferences)).not.toThrow();
    expect(JSON.parse(row.preferences)).toEqual({});
  });

  it("timestamp defaults are ISO-8601 strings produced by datetime('now')", () => {
    const row = db
      .prepare("SELECT created_at FROM users WHERE email = 'alice@example.com'")
      .get() as { created_at: string };
    expect(row.created_at).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
  });
});
