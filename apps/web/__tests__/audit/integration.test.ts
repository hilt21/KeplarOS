/**
 * T-015: 真实 DB 端到端 round-trip 集成测试
 *
 * 覆盖范围(per F-004 description + AC-4.9 验证用):
 *   - 跑 0000 迁移得到完整 schema
 *   - 业务写 cards + runWithAudit 自动写 audit_entries + realtime_events
 *   - SELECT 验证三段均正确落库,字段 round-trip 完整
 *   - FK 链(goal_spaces → cards) 真实生效(外键约束由 schema 表达)
 *
 * 真相源: docs/specs/database_design.md § 3 + F-004 description
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
  for (const f of files) {
    sqlite.exec(readFileSync(join(MIGRATIONS_DIR, f), "utf8"));
  }
}

describe("T-015: runWithAudit 真实 DB 端到端 round-trip", () => {
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

  it("audit_entries 11 字段全部 round-trip,JSON 字段正确解析", () => {
    // seed: user → goal_space → node_board
    db.insert(users).values({ id: "u1", name: "Alice", email: "alice@example.com" }).run();
    db.insert(goalSpaces).values({ id: "g1", initiatorId: "u1", title: "Goal 1" }).run();
    db.insert(nodeBoards)
      .values({ id: "b-1", goalSpaceId: "g1", key: "main", title: "Main" })
      .run();

    const beforeState = { state: "backlog" };
    const afterState = { state: "todo" };
    const details = { trigger: "manual", actorName: "Alice" };

    runWithAudit(
      db,
      {
        entityType: "card",
        entityId: "c-rt",
        actorType: "human",
        actorId: "u1",
        action: "transition",
        beforeState,
        afterState,
        details,
        goalSpaceId: "g1",
        eventType: "card.transitioned",
        resourceType: "card",
        resourceId: "c-rt",
        payload: { from: "backlog", to: "todo" },
      },
      (tx) => {
        tx.insert(cards)
          .values({
            id: "c-rt",
            goalSpaceId: "g1",
            nodeBoardId: "b-1",
            displayId: 1,
            title: "Round-trip card",
            state: "todo",
          })
          .run();
        return null;
      },
    );

    // 1) audit_entries 全字段 round-trip
    const audits = db.select().from(auditEntries).all();
    expect(audits).toHaveLength(1);
    const a = audits[0]!;
    expect(a.id).toMatch(/^[0-9a-f]{32}$/);
    expect(a.entityType).toBe("card");
    expect(a.entityId).toBe("c-rt");
    expect(a.action).toBe("transition");
    expect(a.actorType).toBe("human");
    expect(a.actorId).toBe("u1");
    expect(a.beforeState).toEqual(beforeState);
    expect(a.afterState).toEqual(afterState);
    expect(a.details).toEqual(details);
    expect(a.occurredAt).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
    expect(a.createdAt).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);

    // 2) realtime_events 全字段 round-trip
    const events = db.select().from(realtimeEvents).all();
    expect(events).toHaveLength(1);
    const e = events[0]!;
    expect(e.id).toMatch(/^[0-9a-f]{32}$/);
    expect(e.goalSpaceId).toBe("g1");
    expect(e.sequence).toBe(1);
    expect(e.eventType).toBe("card.transitioned");
    expect(e.resourceType).toBe("card");
    expect(e.resourceId).toBe("c-rt");
    expect(e.payload).toEqual({ from: "backlog", to: "todo" });
    expect(e.publishedAt).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);

    // 3) cards 业务行存在
    const cardsInDb = db.select().from(cards).all();
    expect(cardsInDb).toHaveLength(1);
    expect(cardsInDb[0]!.id).toBe("c-rt");
    expect(cardsInDb[0]!.state).toBe("todo");
  });

  it("跨 goalSpace sequence 互不影响(AC-4.5:goalSpaceA 1..3,goalSpaceB 1..2)", () => {
    db.insert(users)
      .values([
        { id: "u1", name: "Alice", email: "alice@example.com" },
        { id: "u2", name: "Bob", email: "bob@example.com" },
      ])
      .run();
    db.insert(goalSpaces)
      .values([
        { id: "g-A", initiatorId: "u1", title: "Goal A" },
        { id: "g-B", initiatorId: "u2", title: "Goal B" },
      ])
      .run();
    db.insert(nodeBoards)
      .values([
        { id: "b-A", goalSpaceId: "g-A", key: "main", title: "Main A" },
        { id: "b-B", goalSpaceId: "g-B", key: "main", title: "Main B" },
      ])
      .run();

    // g-A 3 次
    for (let i = 1; i <= 3; i++) {
      runWithAudit(
        db,
        {
          entityType: "card",
          entityId: `cA-${i}`,
          actorType: "human",
          actorId: "u1",
          action: "create",
          goalSpaceId: "g-A",
          eventType: "card.created",
          resourceType: "card",
          resourceId: `cA-${i}`,
        },
        (tx) => {
          tx.insert(cards)
            .values({
              id: `cA-${i}`,
              goalSpaceId: "g-A",
              nodeBoardId: "b-A",
              displayId: i,
              title: `Card A ${i}`,
            })
            .run();
        },
      );
    }
    // g-B 2 次
    for (let i = 1; i <= 2; i++) {
      runWithAudit(
        db,
        {
          entityType: "card",
          entityId: `cB-${i}`,
          actorType: "human",
          actorId: "u2",
          action: "create",
          goalSpaceId: "g-B",
          eventType: "card.created",
          resourceType: "card",
          resourceId: `cB-${i}`,
        },
        (tx) => {
          tx.insert(cards)
            .values({
              id: `cB-${i}`,
              goalSpaceId: "g-B",
              nodeBoardId: "b-B",
              displayId: i,
              title: `Card B ${i}`,
            })
            .run();
        },
      );
    }

    const eventsA = db
      .select()
      .from(realtimeEvents)
      .all()
      .filter((e) => e.goalSpaceId === "g-A")
      .map((e) => e.sequence)
      .sort((a, b) => a - b);
    const eventsB = db
      .select()
      .from(realtimeEvents)
      .all()
      .filter((e) => e.goalSpaceId === "g-B")
      .map((e) => e.sequence)
      .sort((a, b) => a - b);

    expect(eventsA).toEqual([1, 2, 3]);
    expect(eventsB).toEqual([1, 2]);
  });
});
