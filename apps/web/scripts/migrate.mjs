import Database from "better-sqlite3";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const scriptsDirectory = fileURLToPath(new URL(".", import.meta.url));
const migrationsDirectory = join(scriptsDirectory, "../db/migrations");
const databasePath = process.env.KEPLAR_DB_PATH ?? join(process.cwd(), "db/dev.db");
const ledgerTable = "__keplar_migrations";

function migrationSql(sql) {
  return sql
    .replace(/^\s*BEGIN TRANSACTION;\s*--> statement-breakpoint\s*$/gm, "")
    .replace(/^\s*COMMIT;\s*--> statement-breakpoint\s*$/gm, "");
}

function schemaFingerprint(db) {
  return db
    .prepare(
      "SELECT type, name, tbl_name, sql FROM sqlite_master WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' AND name NOT IN (?, '__drizzle_migrations') ORDER BY type, name",
    )
    .all(ledgerTable);
}

function hasPre0013Schema(db, migrations) {
  const expected = new Database(":memory:");
  try {
    for (const filename of migrations.filter(
      (filename) => filename < "0013_story_application_id.sql",
    )) {
      expected.exec(readFileSync(join(migrationsDirectory, filename), "utf8"));
    }
    return JSON.stringify(schemaFingerprint(db)) === JSON.stringify(schemaFingerprint(expected));
  } finally {
    expected.close();
  }
}

function applyMigration(db, filename) {
  const sql = migrationSql(readFileSync(join(migrationsDirectory, filename), "utf8"));
  db.transaction(() => {
    db.exec(sql);
    db.prepare(`INSERT INTO ${ledgerTable} (filename, applied_at) VALUES (?, ?)`).run(
      filename,
      new Date().toISOString(),
    );
  })();
}

function createLedger(db) {
  db.exec(`CREATE TABLE ${ledgerTable} (filename TEXT PRIMARY KEY, applied_at TEXT NOT NULL)`);
}

function run() {
  const migrations = readdirSync(migrationsDirectory)
    .filter((filename) => filename.endsWith(".sql"))
    .sort();
  const db = new Database(databasePath);

  try {
    db.pragma("foreign_keys = ON");
    db.pragma("journal_mode = WAL");
    const ledgerExists =
      db
        .prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?")
        .get(ledgerTable) !== undefined;
    const tables = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name != ?",
      )
      .all(ledgerTable);

    if (!ledgerExists && tables.length > 0 && !hasPre0013Schema(db, migrations)) {
      throw new Error(
        "Refusing to migrate an unknown non-empty database without a verified legacy baseline.",
      );
    }

    if (!ledgerExists) createLedger(db);

    const applied = new Set(
      db
        .prepare(`SELECT filename FROM ${ledgerTable}`)
        .all()
        .map(({ filename }) => filename),
    );
    if (applied.size === 0 && tables.length > 0) {
      if (!hasPre0013Schema(db, migrations)) {
        throw new Error(
          "Refusing to migrate an unknown non-empty database without a verified legacy baseline.",
        );
      }

      const legacyMigrations = migrations.filter(
        (filename) => filename < "0013_story_application_id.sql",
      );
      db.transaction(() => {
        const insert = db.prepare(
          `INSERT INTO ${ledgerTable} (filename, applied_at) VALUES (?, ?)`,
        );
        const appliedAt = new Date().toISOString();
        for (const filename of legacyMigrations) {
          insert.run(filename, appliedAt);
          applied.add(filename);
        }
      })();
    }

    const pending = migrations.filter((filename) => !applied.has(filename));
    if (pending.length === 0) {
      console.log("No pending migrations");
      return;
    }

    for (const filename of pending) {
      applyMigration(db, filename);
      console.log(`Applied ${filename}`);
    }
  } finally {
    db.close();
  }
}

try {
  run();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
