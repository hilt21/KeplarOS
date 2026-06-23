/**
 * SSE dedup (F2-09) — RED-first test.
 *
 * Verifies: replay + live emit the same id → only one stored;
 * boardStore.appendMany dedupes by event id; appendMany with no
 * fresh events does not notify.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { boardStore } from "@/lib/state/board-store";
import type { RealtimeEvent } from "@/lib/api/types";

const GOAL_SPACE_ID = "gs-test-dedup";

function makeEvent(id: string, type: RealtimeEvent["type"] = "card_state_changed"): RealtimeEvent {
  return {
    id,
    sequence: 1,
    type,
    occurred_at: new Date().toISOString(),
    goal_space_id: GOAL_SPACE_ID,
    resource: { type: "card", id: `card-${id}` },
    actor: { type: "ai_role", name: "Dev Crafter" },
    data: { state: "todo" },
  };
}

describe("boardStore dedup", () => {
  beforeEach(() => {
    boardStore.clear(GOAL_SPACE_ID);
  });

  afterEach(() => {
    boardStore.clear(GOAL_SPACE_ID);
  });

  it("append keeps the first occurrence of an id", () => {
    const ev = makeEvent("evt-1");
    boardStore.append(GOAL_SPACE_ID, ev);
    boardStore.append(GOAL_SPACE_ID, ev);
    expect(boardStore.getSnapshot(GOAL_SPACE_ID).events.length).toBe(1);
  });

  it("appendMany drops events whose ids are already known", () => {
    const a = makeEvent("evt-a");
    const b = makeEvent("evt-b");
    boardStore.appendMany(GOAL_SPACE_ID, [a, b]);
    boardStore.appendMany(GOAL_SPACE_ID, [a, b, makeEvent("evt-c")]);
    const snap = boardStore.getSnapshot(GOAL_SPACE_ID);
    expect(snap.events.length).toBe(3);
    expect(snap.events.map((e) => e.id)).toEqual(["evt-a", "evt-b", "evt-c"]);
  });

  it("replay and live SSE delivering the same id keeps only one entry", () => {
    const replayed = makeEvent("evt-shared");
    const fromLive = makeEvent("evt-shared");
    // Replay hydration
    boardStore.appendMany(GOAL_SPACE_ID, [replayed]);
    // SSE delivers same id (race condition: server pushed before
    // replay caught up).
    boardStore.append(GOAL_SPACE_ID, fromLive);
    expect(boardStore.getSnapshot(GOAL_SPACE_ID).events.length).toBe(1);
  });

  it("subscribe fires once per batch even if no fresh events", () => {
    const a = makeEvent("evt-a");
    boardStore.appendMany(GOAL_SPACE_ID, [a]);
    const listener = vi.fn();
    boardStore.subscribe(GOAL_SPACE_ID, listener);
    // Re-appending the same id should NOT notify.
    boardStore.appendMany(GOAL_SPACE_ID, [a]);
    expect(listener).not.toHaveBeenCalled();
  });

  it("clear empties the goal space state", () => {
    boardStore.append(GOAL_SPACE_ID, makeEvent("evt-1"));
    boardStore.clear(GOAL_SPACE_ID);
    expect(boardStore.getSnapshot(GOAL_SPACE_ID).events.length).toBe(0);
  });
});
