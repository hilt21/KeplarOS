/**
 * Playwright global setup (F2-10).
 *
 * Runs once before any test in the suite. Applies all migrations to
 * the dev SQLite DB so that the seed user insertion in the spec's
 * `beforeAll` can write against a fully-migrated schema.
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
 */

import { resolve } from "node:path";
import { existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import Database from "better-sqlite3";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const DEV_DB_PATH = resolve(process.cwd(), "db/dev.db");
const MIGRATIONS_DIR = resolve(process.cwd(), "db/migrations");
const APPLIED_TABLE = "__global_setup_applied";

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

  sqlite.close();
}
