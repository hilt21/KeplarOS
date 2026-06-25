/**
 * Playwright global setup (F2-10).
 *
 * Runs once before any test in the suite. Applies all migrations to
 * the dev SQLite DB so that the seed user insertion in the spec's
 * `beforeAll` can write against a fully-migrated schema.
 *
 * Migrations are loaded via the same `loadAllMigrations` helper used
 * by unit tests so this stays consistent with the test-side fixture
 * story (no separate drizzle-kit migration run needed for the E2E
 * suite).
 */

import { resolve } from "node:path";
import { existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import Database from "better-sqlite3";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const DEV_DB_PATH = resolve(process.cwd(), "db/dev.db");
const MIGRATIONS_DIR = resolve(process.cwd(), "db/migrations");

export default async function globalSetup(): Promise<void> {
  const dir = dirname(DEV_DB_PATH);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  const sqlite = new Database(DEV_DB_PATH);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");

  // Apply every .sql in migrations/ in lexicographic order.
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  for (const f of files) {
    const sql = readFileSync(join(MIGRATIONS_DIR, f), "utf8");
    sqlite.exec(sql);
  }

  sqlite.close();
}
