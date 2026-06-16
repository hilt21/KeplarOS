/**
 * F-003 T-014 + SEC-009: canExecuteCardForCardId(DB-aware convenience)单测
 *
 * 覆盖范围(per F-003 AC-3.9 + § 5 强制门禁 + SEC-009):
 *   - 无 pending confirmation 时,允许已授权的 actor(可读卡 + 非 viewer)
 *   - 有 pending confirmation 时,一律 false(§ 5 强制门禁)— 即使 actor 是 member
 *   - card 不存在 → false
 *   - viewer 一律 false(委托 canExecuteCard,即便成员关系存在)
 *
 * 真相源: docs/specs/authorization_matrix.md § 5 强制门禁
 *         docs/review/2026-06-08-full-repo-review/REVIEW.md SEC-009
 *
 * 此测试运行在 node 环境(vitest.config.mts environmentMatchGlobs 配置),以加载
 * better-sqlite3 native module。R-2 风险。
 */

import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { eq } from "drizzle-orm";
import {
  cards,
  goalSpaces,
  humanConfirmations,
  nodeBoardMembers,
  nodeBoards,
  users,
} from "@db/schema";
import * as schema from "@db/schema";
import { canExecuteCardForCardId } from "@/lib/authorization/execute-db";
import type { Actor } from "@/lib/authorization";

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

type Db = BetterSQLite3Database<typeof schema>;

// ─── fixture seeds ────────────────────────────────────────────────

const INITIATOR = "u-initiator";
const MEMBER = "u-member";
const VIEWER = "u-viewer";
const GOAL_A = "g-aaa";
const BOARD_A = "b-aaa";
const CARD_X = "c-xxx";

function seedBase(db: Db, opts: { withMember: boolean }): void {
  db.insert(users)
    .values([
      { id: INITIATOR, name: "Owner", email: "owner@x.com", role: "initiator" },
      { id: MEMBER, name: "Member", email: "member@x.com", role: "chain_user" },
      { id: VIEWER, name: "Viewer", email: "viewer@x.com", role: "viewer" },
    ])
    .run();
  db.insert(goalSpaces).values({ id: GOAL_A, initiatorId: INITIATOR, title: "Goal A" }).run();
  db.insert(nodeBoards)
    .values({ id: BOARD_A, goalSpaceId: GOAL_A, key: "main", title: "Main" })
    .run();
  if (opts.withMember) {
    db.insert(nodeBoardMembers)
      .values({ id: "m-1", boardId: BOARD_A, userId: MEMBER, role: "editor" })
      .run();
  }
  db.insert(cards)
    .values({
      id: CARD_X,
      goalSpaceId: GOAL_A,
      nodeBoardId: BOARD_A,
      displayId: 1,
      title: "Card X",
    })
    .run();
}

const memberActor: Actor = { id: MEMBER, role: "chain_user" };
const viewerActor: Actor = { id: VIEWER, role: "viewer" };

// ─── tests ────────────────────────────────────────────────────────

describe("canExecuteCardForCardId (DB-aware convenience, SEC-009)", () => {
  let sqlite: Database.Database;
  let db: Db;

  beforeEach(() => {
    sqlite = new Database(":memory:");
    sqlite.pragma("foreign_keys = ON");
    loadAllMigrations(sqlite);
    db = drizzle(sqlite, { schema });
  });

  afterEach(() => {
    sqlite.close();
  });

  it("AC-3.9: chain_user 是 member + 无 pending → true", async () => {
    seedBase(db, { withMember: true });
    // sanity: no pending confirmations
    const pending = db
      .select({ id: humanConfirmations.id })
      .from(humanConfirmations)
      .where(eq(humanConfirmations.cardId, CARD_X))
      .all();
    expect(pending).toHaveLength(0);

    await expect(canExecuteCardForCardId(db, memberActor, CARD_X)).resolves.toBe(true);
  });

  it("AC-3.9 + § 5: 可访问 + 有 pending confirmation → false(强制门禁)", async () => {
    seedBase(db, { withMember: true });
    db.insert(humanConfirmations)
      .values({
        id: "h-1",
        cardId: CARD_X,
        triggerType: "high_risk_action",
        riskLevel: "high",
        expiresAt: "2030-01-01 00:00:00",
      })
      .run();

    await expect(canExecuteCardForCardId(db, memberActor, CARD_X)).resolves.toBe(false);
  });

  it("AC-3.9: card 不存在 → false", async () => {
    seedBase(db, { withMember: true });
    await expect(
      canExecuteCardForCardId(db, memberActor, "c-does-not-exist"),
    ).resolves.toBe(false);
  });

  it("AC-3.9: viewer(即便是 member)+ 无 pending → false(委托 canExecuteCard 写权限)", async () => {
    // viewer must be a member of the node board (canReadCard would pass) so we isolate the
    // canExecuteCard role check from the canReadCard check.
    db.insert(users)
      .values([
        { id: INITIATOR, name: "Owner", email: "owner@x.com", role: "initiator" },
        { id: VIEWER, name: "Viewer", email: "viewer@x.com", role: "viewer" },
      ])
      .run();
    db.insert(goalSpaces).values({ id: GOAL_A, initiatorId: INITIATOR, title: "Goal A" }).run();
    db.insert(nodeBoards)
      .values({ id: BOARD_A, goalSpaceId: GOAL_A, key: "main", title: "Main" })
      .run();
    db.insert(nodeBoardMembers)
      .values({ id: "m-viewer", boardId: BOARD_A, userId: VIEWER, role: "editor" })
      .run();
    db.insert(cards)
      .values({
        id: CARD_X,
        goalSpaceId: GOAL_A,
        nodeBoardId: BOARD_A,
        displayId: 1,
        title: "Card X",
      })
      .run();

    await expect(canExecuteCardForCardId(db, viewerActor, CARD_X)).resolves.toBe(false);
  });
});
