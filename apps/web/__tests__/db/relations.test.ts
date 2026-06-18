/**
 * DB-025: smoke test for Drizzle relations() declarations.
 *
 * Verifies that:
 *  1. All 11 table relations are exported.
 *  2. Drizzle's relational query API (`db.query.<table>`) is constructed
 *     without throwing on an in-memory SQLite database.
 *
 * This is a structural smoke test — actual relational queries (with
 * `with: { ... }`) require a fully migrated database, which is out of
 * scope here. The point is to fail fast if a relation declaration is
 * missing, malformed, or references a field that does not exist.
 */

import { describe, it, expect } from "vitest";
import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import {
  usersRelations,
  goalSpacesRelations,
  nodeBoardsRelations,
  nodeBoardMembersRelations,
  sessionsRelations,
  cardsRelations,
  agentExecutionsRelations,
  stateTransitionsRelations,
  humanConfirmationsRelations,
  auditEntriesRelations,
  realtimeEventsRelations,
  schema,
} from "../../db/schema";

describe("Drizzle relations (DB-025)", () => {
  it("all 11 table relations are exported", () => {
    expect(usersRelations).toBeDefined();
    expect(goalSpacesRelations).toBeDefined();
    expect(nodeBoardsRelations).toBeDefined();
    expect(nodeBoardMembersRelations).toBeDefined();
    expect(sessionsRelations).toBeDefined();
    expect(cardsRelations).toBeDefined();
    expect(agentExecutionsRelations).toBeDefined();
    expect(stateTransitionsRelations).toBeDefined();
    expect(humanConfirmationsRelations).toBeDefined();
    expect(auditEntriesRelations).toBeDefined();
    expect(realtimeEventsRelations).toBeDefined();
  });

  it("schema accepts the Drizzle relational query API", () => {
    const sqlite = new Database(":memory:");
    const db = drizzle(sqlite, { schema });

    // The relational query API constructs lazy proxies; the proxy
    // must be defined for every table in `schema` even if we never
    // issue a real query against an empty in-memory database.
    expect(db.query.users).toBeDefined();
    expect(db.query.goalSpaces).toBeDefined();
    expect(db.query.nodeBoards).toBeDefined();
    expect(db.query.nodeBoardMembers).toBeDefined();
    expect(db.query.sessions).toBeDefined();
    expect(db.query.cards).toBeDefined();
    expect(db.query.agentExecutions).toBeDefined();
    expect(db.query.stateTransitions).toBeDefined();
    expect(db.query.humanConfirmations).toBeDefined();
    expect(db.query.auditEntries).toBeDefined();
    expect(db.query.realtimeEvents).toBeDefined();
  });
});
