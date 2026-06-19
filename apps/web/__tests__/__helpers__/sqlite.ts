/**
 * 测试公共 helper:in-memory SQLite + 全部 migration + 最小 fixture。
 *
 * 真相源: docs/specs/database_design.md § 1 § 3
 * 原 TS-004: loadAllMigrations + seedFixture 在 run-with-audit.test.ts /
 *           integration.test.ts / execute-db.test.ts 重复三次,集中维护一份。
 */

import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { eq } from "drizzle-orm";
import { goalSpaces, nodeBoards, realtimeEvents, users } from "@db/schema";
import * as schema from "@db/schema";

const MIGRATIONS_DIR = resolve(__dirname, "../../db/migrations");

export type TestDb = BetterSQLite3Database<typeof schema>;

/**
 * 顺序执行 apps/web/db/migrations 下所有 .sql 文件。跳过 `meta/` 目录与非 .sql 文件。
 */
export function loadAllMigrations(sqlite: Database.Database): void {
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  for (const f of files) {
    sqlite.exec(readFileSync(join(MIGRATIONS_DIR, f), "utf8"));
  }
}

/**
 * 创建 in-memory SQLite,加载全部 migration,FK pragma 打开,返回 Drizzle 实例。
 * 测试用 `beforeEach` 调用;`afterEach` 关闭 sqlite 连接。
 */
export function makeTestDb(): { sqlite: Database.Database; db: TestDb } {
  const sqlite = new Database(":memory:");
  // FK 约束:F-001 schema 用了 .references(),默认 SQLite 不强制,需显式打开
  sqlite.pragma("foreign_keys = ON");
  loadAllMigrations(sqlite);
  const db = drizzle(sqlite, { schema });
  return { sqlite, db };
}

/**
 * seed 最小 fixture:1 个 user + 1 个 goal_space + 1 个 node_board。
 * 足够覆盖 audit_entries / realtime_events 的写入路径(cards 等业务表按需在各测试中追加)。
 *
 * 返回 ids 便于测试用例直接引用。
 */
export interface SeedFixtureIds {
  readonly userId: string;
  readonly goalSpaceId: string;
  readonly boardId: string;
}

export function seedFixture(
  db: TestDb,
  ids: SeedFixtureIds = { userId: "u1", goalSpaceId: "g1", boardId: "b-1" },
): SeedFixtureIds {
  db.insert(users).values({ id: ids.userId, name: "Alice", email: "alice@example.com" }).run();
  db.insert(goalSpaces)
    .values({ id: ids.goalSpaceId, initiatorId: ids.userId, name: "Goal 1" })
    .run();
  db.insert(nodeBoards)
    .values({
      id: ids.boardId,
      goalSpaceId: ids.goalSpaceId,
      key: "main",
      name: "Main",
    })
    .run();
  return ids;
}

/** 取出某 goal_space 内 realtime_events 的 sequence 列表(升序)。 */
export function selectSequencesForGoalSpace(db: TestDb, goalSpaceId: string): number[] {
  return db
    .select({ sequence: realtimeEvents.sequence })
    .from(realtimeEvents)
    .where(eq(realtimeEvents.goalSpaceId, goalSpaceId))
    .all()
    .map((r) => r.sequence)
    .sort((a, b) => a - b);
}
