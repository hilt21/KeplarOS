import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createJsonRequest, expectApiOk, withTestSession } from "./route-test-harness";
import { makeTestDb, seedFixture } from "../__helpers__/sqlite";
import { realtimeEvents } from "@db/schema";

const mocks = vi.hoisted(() => ({
  db: null as unknown,
  createSseStream: vi.fn(
    () =>
      new ReadableStream<Uint8Array>({
        start(controller) {
          controller.close();
        },
      }),
  ),
}));

vi.mock("@/lib/db/client", () => ({
  getDb: () => mocks.db,
}));

vi.mock("@/lib/realtime/stream", () => ({
  createSseStream: mocks.createSseStream,
}));

const actor = { id: "user-init", role: "initiator" } as const;

function seedRealtimeEvents(db: ReturnType<typeof makeTestDb>["db"]): void {
  db.insert(realtimeEvents)
    .values([
      {
        id: "z-event",
        goalSpaceId: "gs-1",
        sequence: 1,
        type: "card.created",
        resourceType: "card",
        resourceId: "card-1",
        data: { title: "First" },
      },
      {
        id: "a-event",
        goalSpaceId: "gs-1",
        sequence: 2,
        type: "card.updated",
        resourceType: "card",
        resourceId: "card-2",
        data: { title: "Second" },
      },
    ])
    .run();
}

describe("realtime cursor regressions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.KEPLAR_SESSION_SECRET = "test-session-secret";
  });

  afterEach(() => {
    mocks.db = null;
    vi.restoreAllMocks();
  });

  it("replays events after after_id by sequence, not lexicographic id", async () => {
    const { sqlite, db } = makeTestDb();
    try {
      mocks.db = db;
      seedFixture(db, { userId: "user-init", goalSpaceId: "gs-1", boardId: "board-1" });
      seedRealtimeEvents(db);

      const { GET } = await import("@/app/api/v1/goal-spaces/[id]/events/route");
      const response = await GET(
        createJsonRequest(
          "/api/v1/goal-spaces/gs-1/events?after_id=z-event&limit=10",
          "GET",
          undefined,
          withTestSession(actor),
        ),
        { params: Promise.resolve({ id: "gs-1" }) },
      );

      const json = await expectApiOk<{
        events: Array<{ id: string; sequence: number }>;
        has_more: boolean;
      }>(response);

      expect(json.data.events.map((event) => [event.id, event.sequence])).toEqual([["a-event", 2]]);
      expect(json.data.has_more).toBe(false);
    } finally {
      sqlite.close();
    }
  });

  it("starts a fresh SSE connection after the latest stored sequence", async () => {
    const { sqlite, db } = makeTestDb();
    try {
      mocks.db = db;
      seedFixture(db, { userId: "user-init", goalSpaceId: "gs-1", boardId: "board-1" });
      seedRealtimeEvents(db);

      const { GET } = await import("@/app/api/v1/sse/route");
      const response = await GET(
        createJsonRequest(
          "/api/v1/sse?goal_space_id=gs-1",
          "GET",
          undefined,
          withTestSession(actor),
        ),
      );

      expect(response.status).toBe(200);
      expect(mocks.createSseStream).toHaveBeenCalledWith(
        expect.objectContaining({
          goalSpaceId: "gs-1",
          lastSequenceId: 2,
        }),
      );
    } finally {
      sqlite.close();
    }
  });

  it("cancels the locked live stream reader without rejecting the response body", async () => {
    const { sqlite, db } = makeTestDb();
    const liveStreamCancelled = vi.fn();
    try {
      mocks.db = db;
      seedFixture(db, { userId: "user-init", goalSpaceId: "gs-1", boardId: "board-1" });
      mocks.createSseStream.mockReturnValueOnce(
        new ReadableStream<Uint8Array>({
          cancel: liveStreamCancelled,
        }),
      );

      const { GET } = await import("@/app/api/v1/sse/route");
      const response = await GET(
        createJsonRequest(
          "/api/v1/sse?goal_space_id=gs-1",
          "GET",
          undefined,
          withTestSession(actor),
        ),
      );

      await expect(response.body?.cancel("client disconnected")).resolves.toBeUndefined();
      expect(liveStreamCancelled).toHaveBeenCalledWith("client disconnected");
    } finally {
      sqlite.close();
    }
  });

  it("propagates a live stream cleanup failure", async () => {
    const { sqlite, db } = makeTestDb();
    const cleanupError = new Error("live stream cleanup failed");
    try {
      mocks.db = db;
      seedFixture(db, { userId: "user-init", goalSpaceId: "gs-1", boardId: "board-1" });
      mocks.createSseStream.mockReturnValueOnce(
        new ReadableStream<Uint8Array>({
          cancel: () => Promise.reject(cleanupError),
        }),
      );

      const { GET } = await import("@/app/api/v1/sse/route");
      const response = await GET(
        createJsonRequest(
          "/api/v1/sse?goal_space_id=gs-1",
          "GET",
          undefined,
          withTestSession(actor),
        ),
      );

      await expect(response.body?.cancel("client disconnected")).rejects.toBe(cleanupError);
    } finally {
      sqlite.close();
    }
  });
});
