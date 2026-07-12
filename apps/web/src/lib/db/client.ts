/**
 * S2 F-004 db client — 共享 Drizzle + better-sqlite3 实例
 *
 * 真相源: docs/specs/database_design.md § 1 + F-004 AC-4.8
 *   - db 文件路径 `apps/web/db/dev.db`(相对 web package cwd)
 *   - 不引入新依赖:依赖已在 `package.json` 中(drizzle-orm 0.36.4 + better-sqlite3 11.5.0)
 *
 * 单例模式:重复 `getDb()` 返回同一 SQLite 连接,避免 better-sqlite3
 * 连接泄漏 / 同进程多连接跨事务可见性错乱。
 *
 * S2 范围内:测试 (T-013 / T-015) 自建 `new Database(':memory:')` + `drizzle(...)`
 * 不走本函数;生产代码 (S3+) 通过 `getDb()` 取单例。
 */

import { existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import * as schema from "@db/schema";

const DEFAULT_PATH = resolve(process.cwd(), "db/dev.db");

let _cached: { sqlite: Database.Database; db: BetterSQLite3Database<typeof schema> } | null = null;

export function resolveDatabasePath(databasePath = process.env.KEPLAR_DB_PATH): string {
  return databasePath ? resolve(databasePath) : DEFAULT_PATH;
}

/**
 * 取得(或创建)Drizzle + better-sqlite3 实例,默认路径 `apps/web/db/dev.db`。
 * 首次调用创建文件 + 目录 + pragma;后续调用返回同一实例。
 */
export function getDb(): BetterSQLite3Database<typeof schema> {
  if (_cached) return _cached.db;

  const databasePath = resolveDatabasePath();
  const dir = dirname(databasePath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  const sqlite = new Database(databasePath);
  // WAL:提高并发读 + 写序列化;F-004 realtime sequence 单调递增依赖写串行
  sqlite.pragma("journal_mode = WAL");
  // 外键:goal_spaces / node_boards / cards 等 schema 用了 .references(),
  // 默认 SQLite 不强制 FK,需显式打开
  sqlite.pragma("foreign_keys = ON");

  const db = drizzle(sqlite, { schema });
  _cached = { sqlite, db };
  return db;
}

/**
 * Drizzle 实例类型 — 供 runWithAudit 形参 `db: DrizzleDb` 使用。
 */
export type DrizzleDb = BetterSQLite3Database<typeof schema>;
