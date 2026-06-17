/**
 * T-013: runWithAudit 行为单测
 *
 * 覆盖范围(per F-004 AC-4.2 / AC-4.3 / AC-4.4 / AC-4.6):
 *   - AC-4.2: 业务 + audit + realtime 三段同事务提交成功
 *   - AC-4.3: audit 写失败 → 业务回滚(用 BEFORE INSERT trigger 主动 fail)
 *   - AC-4.4: 连续 10 次 runWithAudit 在同一 goalSpace 下 sequence 严格 1..10
 *   - AC-4.6: skipRealtime=true 不写 realtime_events
 *
 * 真相源: docs/specs/database_design.md § 3.9 § 3.10 + F-004 description
 *
 * 此测试运行在 node 环境(vitest.config.mts environmentMatchGlobs 配置),以加载
 * better-sqlite3 native module。R-2 风险。
 */

import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { auditEntries, cards, goalSpaces, nodeBoards, realtimeEvents, users } from "@db/schema";
import * as schema from "@db/schema";
import { runWithAudit } from "@/lib/audit";

const MIGRATIONS_DIR = resolve(__dirname, "../../db/migrations");

function loadAllMigrations(sqlite: Database.Database): void {
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  expect(files.length).toBeGreaterThanOrEqual(1);
  for (const f of files) {
    sqlite.exec(readFileSync(join(MIGRATIONS_DIR, f), "utf8"));
  }
}

function seedFixture(db: BetterSQLite3Database<typeof schema>): void {
  db.insert(users).values({ id: "u1", name: "Alice", email: "alice@example.com" }).run();
  db.insert(goalSpaces).values({ id: "g1", initiatorId: "u1", name: "Goal 1" }).run();
  db.insert(nodeBoards).values({ id: "b-1", goalSpaceId: "g1", key: "main", name: "Main" }).run();
}

describe("T-013: runWithAudit", () => {
  let sqlite: Database.Database;
  let db: BetterSQLite3Database<typeof schema>;

  beforeEach(() => {
    sqlite = new Database(":memory:");
    sqlite.pragma("foreign_keys = ON");
    loadAllMigrations(sqlite);
    db = drizzle(sqlite, { schema });
  });

  afterEach(() => {
    sqlite.close();
  });

  it("AC-4.2: 业务 + audit + realtime 三段同事务提交成功", () => {
    seedFixture(db);
    const result = runWithAudit(
      db,
      {
        entityType: "card",
        entityId: "c-1",
        actorType: "human",
        actorId: "u1",
        action: "create",
        goalSpaceId: "g1",
        eventType: "card.created",
        resourceType: "card",
        resourceId: "c-1",
        payload: { reason: "first card" },
      },
      (tx) => {
        tx.insert(cards)
          .values({
            id: "c-1",
            goalSpaceId: "g1",
            nodeBoardId: "b-1",
            displayId: "CARD-001",
            title: "Card 1",
          })
          .run();
        return "ok";
      },
    );

    expect(result).toBe("ok");

    const cardsInDb = db.select().from(cards).all();
    expect(cardsInDb).toHaveLength(1);
    expect(cardsInDb[0]).toBeDefined();
    expect(cardsInDb[0]!.title).toBe("Card 1");

    const audits = db.select().from(auditEntries).all();
    expect(audits).toHaveLength(1);
    expect(audits[0]).toBeDefined();
    expect(audits[0]!.entityType).toBe("card");
    expect(audits[0]!.entityId).toBe("c-1");
    expect(audits[0]!.action).toBe("create");
    expect(audits[0]!.actorType).toBe("human");
    expect(audits[0]!.actorId).toBe("u1");
    expect(audits[0]!.details).toEqual({});

    const events = db.select().from(realtimeEvents).all();
    expect(events).toHaveLength(1);
    expect(events[0]).toBeDefined();
    expect(events[0]!.goalSpaceId).toBe("g1");
    expect(events[0]!.sequence).toBe(1);
    expect(events[0]!.eventType).toBe("card.created");
    expect(events[0]!.resourceType).toBe("card");
    expect(events[0]!.resourceId).toBe("c-1");
    expect(events[0]!.payload).toEqual({ reason: "first card" });
  });

  it("AC-4.3: audit 写失败 → 业务回滚(SELECT 验证),realtime 也不写", () => {
    seedFixture(db);
    // BEFORE INSERT trigger: action='BLOCK' 时主动 RAISE(FAIL) — 模拟 audit 失败
    sqlite.exec(
      `CREATE TRIGGER block_sentinel_audit BEFORE INSERT ON audit_entries
       WHEN NEW.action = 'BLOCK'
       BEGIN SELECT RAISE(FAIL, 'sentinel audit blocked'); END;`,
    );

    expect(() =>
      runWithAudit(
        db,
        {
          entityType: "card",
          entityId: "c-2",
          actorType: "human",
          actorId: "u1",
          action: "BLOCK",
          goalSpaceId: "g1",
          eventType: "card.created",
          resourceType: "card",
          resourceId: "c-2",
        },
        (tx) => {
          tx.insert(cards)
            .values({
              id: "c-2",
              goalSpaceId: "g1",
              nodeBoardId: "b-1",
              displayId: "CARD-002",
              title: "Card 2",
            })
            .run();
          return "ok";
        },
      ),
    ).toThrow(/sentinel audit blocked/);

    // 业务、audit、realtime 三段均被回滚
    expect(db.select().from(cards).all()).toHaveLength(0);
    expect(db.select().from(auditEntries).all()).toHaveLength(0);
    expect(db.select().from(realtimeEvents).all()).toHaveLength(0);
  });

  it("AC-4.4: 连续 10 次 runWithAudit 在同一 goalSpace 下 sequence 严格 1..10", () => {
    seedFixture(db);
    for (let i = 1; i <= 10; i++) {
      runWithAudit(
        db,
        {
          entityType: "card",
          entityId: `c-${i}`,
          actorType: "system",
          actorId: null,
          action: "create",
          goalSpaceId: "g1",
          eventType: "card.created",
          resourceType: "card",
          resourceId: `c-${i}`,
        },
        (tx) => {
          tx.insert(cards)
            .values({
              id: `c-${i}`,
              goalSpaceId: "g1",
              nodeBoardId: "b-1",
              displayId: `CARD-${String(i).padStart(3, "0")}`,
              title: `Card ${i}`,
            })
            .run();
          return i;
        },
      );
    }

    const events = db.select().from(realtimeEvents).all();
    expect(events).toHaveLength(10);
    const sequences = events.map((e) => e.sequence).sort((a, b) => a - b);
    expect(sequences).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it("AC-4.6: skipRealtime=true 不写 realtime_events,audit 仍写", () => {
    seedFixture(db);
    runWithAudit(
      db,
      {
        entityType: "session",
        entityId: "s-1",
        actorType: "system",
        actorId: null,
        action: "internal_heartbeat",
        goalSpaceId: "g1",
        eventType: "session.heartbeat",
        resourceType: "session",
        resourceId: "s-1",
        skipRealtime: true,
      },
      () => "noop",
    );

    const audits = db.select().from(auditEntries).all();
    expect(audits).toHaveLength(1);
    expect(audits[0]).toBeDefined();
    expect(audits[0]!.action).toBe("internal_heartbeat");

    const events = db.select().from(realtimeEvents).all();
    expect(events).toHaveLength(0);
  });
});
