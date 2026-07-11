import { afterEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";

import {
  auditEntries,
  cards,
  goalSpaces,
  nodeBoardMembers,
  nodeBoards,
  realtimeEvents,
  users,
} from "@db/schema";
import { makeTestDb, type TestDb } from "../__helpers__/sqlite";
import { applyStoryDraft, generateStoryDraft } from "@/lib/services/story-drafts";

describe("Story draft application", () => {
  let db: TestDb;
  let close: (() => void) | undefined;

  afterEach(() => close?.());

  function setup(): void {
    const test = makeTestDb();
    db = test.db;
    close = () => test.sqlite.close();
    db.insert(users)
      .values({
        id: "initiator",
        name: "Initiator",
        email: "initiator@example.com",
        role: "initiator",
      })
      .run();
  }

  it("generates a deterministic editable draft", () => {
    expect(generateStoryDraft("Ship the beta").cards).toHaveLength(1);
    expect(() => generateStoryDraft(" ")).toThrow("goal must not be empty");
  });

  it("atomically applies a draft into a goal space, initial board, card, audit and event", () => {
    setup();
    const result = applyStoryDraft(
      "application-1",
      generateStoryDraft("Ship the beta"),
      { id: "initiator", role: "initiator" },
      db,
    );
    expect(result.applied).toBe(true);
    expect(
      db.select().from(goalSpaces).where(eq(goalSpaces.id, result.goal_space_id)).all(),
    ).toHaveLength(1);
    expect(
      db.select().from(nodeBoards).where(eq(nodeBoards.goalSpaceId, result.goal_space_id)).all(),
    ).toHaveLength(1);
    expect(db.select().from(nodeBoardMembers).all()).toHaveLength(1);
    expect(
      db.select().from(cards).where(eq(cards.goalSpaceId, result.goal_space_id)).all(),
    ).toHaveLength(1);
    expect(
      db.select().from(auditEntries).where(eq(auditEntries.entityId, result.goal_space_id)).all(),
    ).toHaveLength(1);
    expect(
      db
        .select()
        .from(realtimeEvents)
        .where(eq(realtimeEvents.goalSpaceId, result.goal_space_id))
        .all(),
    ).toHaveLength(1);
  });

  it("returns the existing goal space when the application id is retried", () => {
    setup();
    const draft = generateStoryDraft("Ship the beta");
    const first = applyStoryDraft(
      "application-1",
      draft,
      { id: "initiator", role: "initiator" },
      db,
    );
    const second = applyStoryDraft(
      "application-1",
      draft,
      { id: "initiator", role: "initiator" },
      db,
    );
    expect(second).toEqual({ goal_space_id: first.goal_space_id, card_ids: [], applied: false });
    expect(db.select().from(goalSpaces).all()).toHaveLength(1);
    expect(db.select().from(cards).all()).toHaveLength(1);
  });
});
