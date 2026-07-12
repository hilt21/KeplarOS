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
    db.insert(users)
      .values({
        id: "another-initiator",
        name: "Another Initiator",
        email: "another-initiator@example.com",
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

  it("rejects more than 50 cards before writing any data", () => {
    setup();
    const draft = generateStoryDraft("Ship the beta");
    const oversizedDraft = { ...draft, cards: Array.from({ length: 51 }, () => draft.cards[0]!) };

    expect(() =>
      applyStoryDraft("application-1", oversizedDraft, { id: "initiator", role: "initiator" }, db),
    ).toThrow("at most 50 cards");
    expect(db.select().from(goalSpaces).all()).toHaveLength(0);
    expect(db.select().from(nodeBoards).all()).toHaveLength(0);
    expect(db.select().from(cards).all()).toHaveLength(0);
    expect(db.select().from(auditEntries).all()).toHaveLength(0);
  });

  it("rejects an oversized audit payload before writing any data", () => {
    setup();
    const draft = {
      ...generateStoryDraft("Ship the beta"),
      risk_hints: Array.from({ length: 50 }, () => "x".repeat(4000)),
    };

    expect(() =>
      applyStoryDraft("application-1", draft, { id: "initiator", role: "initiator" }, db),
    ).toThrow("audit payload");
    expect(db.select().from(goalSpaces).all()).toHaveLength(0);
    expect(db.select().from(nodeBoards).all()).toHaveLength(0);
    expect(db.select().from(cards).all()).toHaveLength(0);
    expect(db.select().from(auditEntries).all()).toHaveLength(0);
  });

  it("preserves accepted output requirements and risk hints in audit details", () => {
    setup();
    const draft = {
      ...generateStoryDraft("Ship the beta"),
      output_requirements: ["Release notes"],
      risk_hints: ["Coordinate with support"],
    };

    const result = applyStoryDraft(
      "application-1",
      draft,
      { id: "initiator", role: "initiator" },
      db,
    );
    const audit = db
      .select()
      .from(auditEntries)
      .where(eq(auditEntries.entityId, result.goal_space_id))
      .get();

    expect(audit?.details).toMatchObject({
      story_application_id: "application-1",
      card_ids: result.card_ids,
      output_requirements: ["Release notes"],
      risk_hints: ["Coordinate with support"],
    });
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
    expect(db.select().from(nodeBoards).all()).toHaveLength(1);
    expect(db.select().from(nodeBoardMembers).all()).toHaveLength(1);
    expect(db.select().from(cards).all()).toHaveLength(1);
    expect(db.select().from(auditEntries).all()).toHaveLength(1);
    expect(db.select().from(realtimeEvents).all()).toHaveLength(1);
  });

  it("scopes application id replays to their initiator", () => {
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
      { id: "another-initiator", role: "initiator" },
      db,
    );

    expect(second).toMatchObject({ applied: true });
    expect(second.goal_space_id).not.toBe(first.goal_space_id);
    expect(db.select().from(goalSpaces).all()).toHaveLength(2);
  });

  it("reports the scoped application id unique constraint from SQLite", () => {
    setup();
    applyStoryDraft(
      "application-1",
      generateStoryDraft("Ship the beta"),
      { id: "initiator", role: "initiator" },
      db,
    );
    let error: unknown;
    try {
      db.insert(goalSpaces)
        .values({
          id: "duplicate-goal-space",
          initiatorId: "initiator",
          name: "Duplicate",
          constraints: [],
          storyApplicationId: "application-1",
          tags: [],
        })
        .run();
    } catch (caught) {
      error = caught;
    }

    expect(error).toMatchObject({ code: "SQLITE_CONSTRAINT_UNIQUE" });
    expect((error as Error).message).toMatch(
      /^UNIQUE constraint failed:\s*goal_spaces\.initiator_id\s*,\s*goal_spaces\.story_application_id\s*$/,
    );
  });

  it("recovers a concurrent application id unique conflict as a replay", () => {
    setup();
    const existing = applyStoryDraft(
      "application-1",
      generateStoryDraft("Ship the beta"),
      { id: "initiator", role: "initiator" },
      db,
    );
    let lookupCount = 0;
    let transactionCount = 0;
    const racingDb = {
      select: () => ({
        from: () => ({
          where: () => ({
            get: () => {
              lookupCount += 1;
              return lookupCount === 1 ? undefined : { id: existing.goal_space_id };
            },
          }),
        }),
      }),
      transaction: (callback: (tx: TestDb) => unknown) => {
        transactionCount += 1;
        return callback(db);
      },
    } as unknown as TestDb;

    expect(
      applyStoryDraft(
        "application-1",
        generateStoryDraft("Ship the beta"),
        { id: "initiator", role: "initiator" },
        racingDb,
      ),
    ).toEqual({ goal_space_id: existing.goal_space_id, card_ids: [], applied: false });
    expect(transactionCount).toBe(1);
    expect(db.select().from(goalSpaces).all()).toHaveLength(1);
    expect(db.select().from(nodeBoards).all()).toHaveLength(1);
    expect(db.select().from(nodeBoardMembers).all()).toHaveLength(1);
    expect(db.select().from(cards).all()).toHaveLength(1);
    expect(db.select().from(auditEntries).all()).toHaveLength(1);
    expect(db.select().from(realtimeEvents).all()).toHaveLength(1);
  });
});
