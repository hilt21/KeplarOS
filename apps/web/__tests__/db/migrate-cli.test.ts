import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";

const repositoryRoot = resolve(__dirname, "../../..");
const migrationsDirectory = resolve(__dirname, "../../db/migrations");
const temporaryDirectories: string[] = [];

function createDatabasePath() {
  const directory = mkdtempSync(join(tmpdir(), "keplar-migrate-"));
  temporaryDirectories.push(directory);
  return join(directory, "test.db");
}

function runMigrate(databasePath: string) {
  return spawnSync(
    process.platform === "win32" ? "pnpm.cmd" : "pnpm",
    ["--filter", "@keplar/web", "db:migrate"],
    {
      cwd: repositoryRoot,
      env: { ...process.env, KEPLAR_DB_PATH: databasePath },
      encoding: "utf8",
    },
  );
}

function applyPre0013Migrations(databasePath: string) {
  const db = new Database(databasePath);
  try {
    for (const filename of readdirSync(migrationsDirectory)
      .filter((filename) => filename.endsWith(".sql") && filename < "0013_story_application_id.sql")
      .sort()) {
      db.exec(readFileSync(join(migrationsDirectory, filename), "utf8"));
    }
    db.exec(
      "CREATE TABLE __drizzle_migrations (id INTEGER PRIMARY KEY AUTOINCREMENT, hash TEXT NOT NULL, created_at NUMERIC)",
    );
  } finally {
    db.close();
  }
}

function readDatabase(databasePath: string, callback: (db: Database.Database) => void) {
  const db = new Database(databasePath);
  try {
    callback(db);
  } finally {
    db.close();
  }
}

function expectStoryApplicationIdIndex(db: Database.Database) {
  expect(
    db
      .prepare("SELECT sql FROM sqlite_master WHERE type = 'index' AND name = ?")
      .get("idx_goal_spaces_story_application_id_unique"),
  ).toBeUndefined();

  const compositeIndex = db
    .prepare("SELECT sql FROM sqlite_master WHERE type = 'index' AND name = ?")
    .get("idx_goal_spaces_initiator_story_application_id_unique") as { sql: string } | undefined;
  expect(compositeIndex?.sql).toEqual(expect.any(String));
  expect(compositeIndex?.sql).toMatch(/CREATE UNIQUE INDEX/i);
  expect(compositeIndex?.sql).toMatch(/initiator_id/i);
  expect(compositeIndex?.sql).toMatch(/story_application_id/i);

  const compositeIndexName = "idx_goal_spaces_initiator_story_application_id_unique";
  const index = (
    db.prepare("PRAGMA index_list('goal_spaces')").all() as { name: string; unique: number }[]
  ).find(({ name }) => name === compositeIndexName);
  expect(index).toEqual(expect.objectContaining({ unique: 1 }));
  expect(
    (
      db.prepare(`PRAGMA index_info('${compositeIndexName}')`).all() as {
        seqno: number;
        name: string;
      }[]
    )
      .sort((left, right) => left.seqno - right.seqno)
      .map(({ name }) => name),
  ).toEqual(["initiator_id", "story_application_id"]);
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("db:migrate CLI", () => {
  it("applies every migration to an empty database", () => {
    const databasePath = createDatabasePath();
    const result = runMigrate(databasePath);

    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain("Applied 0013_story_application_id.sql");
    expect(result.stdout).toContain("Applied 0014_story_application_id_scope.sql");
    readDatabase(databasePath, (db) => {
      expect(db.prepare("PRAGMA table_info(goal_spaces)").all()).toContainEqual(
        expect.objectContaining({ name: "story_application_id" }),
      );
      expect(
        db
          .prepare("SELECT filename FROM __keplar_migrations WHERE filename = ?")
          .get("0013_story_application_id.sql"),
      ).toBeDefined();
      expectStoryApplicationIdIndex(db);
    });
  });

  it("baselines a verified pre-0013 database before applying 0013", () => {
    const databasePath = createDatabasePath();
    applyPre0013Migrations(databasePath);

    const result = runMigrate(databasePath);

    expect(result.status, result.stderr).toBe(0);
    readDatabase(databasePath, (db) => {
      expect(db.prepare("PRAGMA table_info(goal_spaces)").all()).toContainEqual(
        expect.objectContaining({ name: "story_application_id" }),
      );
      expect(
        (
          db.prepare("SELECT filename FROM __keplar_migrations ORDER BY filename").all() as {
            filename: string;
          }[]
        ).map(({ filename }) => filename),
      ).toEqual(
        readdirSync(migrationsDirectory)
          .filter((filename) => filename.endsWith(".sql"))
          .sort(),
      );
      expectStoryApplicationIdIndex(db);
    });
  });

  it("refuses an unknown non-empty database without recording migrations", () => {
    const databasePath = createDatabasePath();
    const db = new Database(databasePath);
    db.exec("CREATE TABLE unrelated (id TEXT PRIMARY KEY)");
    db.close();

    const result = runMigrate(databasePath);

    expect(result.status).not.toBe(0);
    readDatabase(databasePath, (database) => {
      const ledger = database
        .prepare(
          "SELECT name FROM sqlite_master WHERE type = 'table' AND name = '__keplar_migrations'",
        )
        .get();
      expect(ledger).toBeUndefined();
    });
  });

  it("refuses a database that only resembles the legacy baseline", () => {
    const databasePath = createDatabasePath();
    const db = new Database(databasePath);
    db.exec(`
      CREATE TABLE users (id TEXT);
      CREATE TABLE goal_spaces (acceptance_criteria TEXT, cancelled_at TEXT, cancel_reason TEXT, deleted_at TEXT);
      CREATE TABLE node_boards (id TEXT);
      CREATE TABLE node_board_members (id TEXT);
      CREATE TABLE sessions (id TEXT);
      CREATE TABLE agent_executions (goal_space_id TEXT, session_id TEXT, card_id TEXT);
      CREATE TABLE cards (node_board_id TEXT, display_id INTEGER, priority TEXT);
      CREATE TABLE state_transitions (id TEXT);
      CREATE TABLE human_confirmations (id TEXT);
      CREATE TABLE audit_entries (id TEXT);
      CREATE TABLE realtime_events (id TEXT);
      CREATE TABLE auth_credentials (user_id TEXT, password_hash TEXT);
      CREATE INDEX idx_cards_goal_space_display_id_active ON cards (node_board_id);
      CREATE TRIGGER trg_node_boards_synthetic_id_format
      BEFORE INSERT ON node_boards BEGIN SELECT 1; END;
    `);
    db.close();

    const result = runMigrate(databasePath);

    expect(result.status).not.toBe(0);
    readDatabase(databasePath, (database) => {
      expect(
        database
          .prepare(
            "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = '__keplar_migrations'",
          )
          .get(),
      ).toBeUndefined();
    });
  });
});
