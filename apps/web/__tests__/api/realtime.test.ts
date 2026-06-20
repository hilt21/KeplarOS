/**
 * F2-08 SSE Dashboard Endpoint contract tests (TDD, RED-first).
 *
 * Covers the two documented endpoints:
 *   - GET  /api/v1/sse?goal_space_id=<id>            (interface_spec.md § 8.1)
 *   - GET  /api/v1/goal-spaces/:id/events              (realtime_events.md § 5)
 *
 * SSE wire-format event type names (snake_case) are translated from the
 * storage-format names (dotted form) emitted by F2-04 / F2-05 / F2-06 /
 * F2-07 via the STORAGE_TO_WIRE_TYPE_MAP exported from the events module.
 *
 * Authorization: actor must have access to the goal space (initiator / member / assignee).
 * Pending confirmation, terminal state, and other domain gates are enforced upstream
 * by the service modules that emit the events.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createJsonRequest,
  expectApiError,
  expectApiOk,
  withTestSession,
} from "./route-test-harness";

import type { Actor } from "@/lib/authorization/types";

const mockDb = vi.hoisted(() => ({
  insert: vi.fn(),
  select: vi.fn(),
  update: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("@/lib/db/client", () => ({
  getDb: () => mockDb,
}));

// ─── helpers ────────────────────────────────────────────────────────

type SelectRow = Record<string, unknown> | null | undefined | unknown[] | object;

function queueSelectResults(...rows: SelectRow[]): void {
  const pending = [...rows];
  const makeChain = (): Record<string, unknown> => {
    const chain: Record<string, unknown> = {};
    chain.get = () => pending.shift();
    chain.all = () => {
      const next = pending.shift();
      return next === undefined ? [] : Array.isArray(next) ? next : [next];
    };
    chain.innerJoin = () => makeChain();
    chain.leftJoin = () => makeChain();
    chain.where = () => makeChain();
    chain.groupBy = () => makeChain();
    chain.orderBy = () => makeChain();
    chain.limit = () => makeChain();
    chain.offset = () => makeChain();
    return chain;
  };
  const selectLike = () => ({ from: (_table: unknown) => makeChain() });
  mockDb.select.mockImplementation(selectLike);
  (mockDb as Record<string, unknown>).selectDistinct = selectLike;
}

const actorInitiator: Actor = { id: "user-init", role: "initiator" };
const actorChainUser: Actor = { id: "user-chain", role: "chain_user" };
const actorViewer: Actor = { id: "user-viewer", role: "viewer" };

const baseGoalSpace = {
  id: "gs-1",
  initiatorId: "user-init",
  name: "GS",
  description: "",
  constraints: [],
  acceptanceCriteria: null,
  status: "active",
  progress: 0,
  templateId: null,
  tags: [],
  startedAt: null,
  completedAt: null,
  cancelledAt: null,
  cancelReason: null,
  deletedAt: null,
  createdAt: "2026-06-19T00:00:00.000Z",
  updatedAt: "2026-06-19T00:00:00.000Z",
};

const baseRealtimeEvent = {
  id: "evt-1",
  goalSpaceId: "gs-1",
  sequence: 1,
  type: "card.created",
  resourceType: "card",
  resourceId: "card-1",
  actor: "human",
  actorId: "user-init",
  data: { title: "Test" },
  occurredAt: "2026-06-19T00:00:00.000Z",
};

function resetEnv(): void {
  process.env.KEPLAR_SESSION_SECRET = "test-session-secret";
}

beforeEach(() => {
  vi.clearAllMocks();
  resetEnv();
});
afterEach(() => vi.restoreAllMocks());

// ─── GET /api/v1/sse ──────────────────────────────────────────────

describe("GET /api/v1/sse (F2-08)", () => {
  it("returns 401 without a session", async () => {
    const { GET } = await import("@/app/api/v1/sse/route");
    const response = await GET(createJsonRequest("/api/v1/sse?goal_space_id=gs-1", "GET"));
    expect(response.status).toBe(401);
  });

  it("returns 400 when goal_space_id is missing", async () => {
    const { GET } = await import("@/app/api/v1/sse/route");
    const response = await GET(
      createJsonRequest("/api/v1/sse", "GET", undefined, withTestSession(actorInitiator)),
    );
    await expectApiError(response, "INVALID_FIELD", 400);
  });

  it("returns 404 when the goal space does not exist", async () => {
    queueSelectResults(null);
    const { GET } = await import("@/app/api/v1/sse/route");
    const response = await GET(
      createJsonRequest(
        "/api/v1/sse?goal_space_id=gs-missing",
        "GET",
        undefined,
        withTestSession(actorInitiator),
      ),
    );
    await expectApiError(response, "NOT_FOUND", 404);
  });

  it("returns 403 when the actor has no access to the goal space", async () => {
    queueSelectResults({ ...baseGoalSpace, initiatorId: "user-init-2" }, [
      { userId: "user-stranger" },
    ]);
    const { GET } = await import("@/app/api/v1/sse/route");
    const response = await GET(
      createJsonRequest(
        "/api/v1/sse?goal_space_id=gs-1",
        "GET",
        undefined,
        withTestSession(actorChainUser),
      ),
    );
    await expectApiError(response, "FORBIDDEN", 403);
  });

  it("returns 200 with Content-Type text/event-stream for a valid request", async () => {
    queueSelectResults({ ...baseGoalSpace, initiatorId: "user-init" }, [{ userId: "user-chain" }]);
    const { GET } = await import("@/app/api/v1/sse/route");
    const response = await GET(
      createJsonRequest(
        "/api/v1/sse?goal_space_id=gs-1",
        "GET",
        undefined,
        withTestSession(actorInitiator),
      ),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/event-stream");
  });
});

// ─── GET /api/v1/goal-spaces/:id/events ────────────────────────────

describe("GET /api/v1/goal-spaces/:id/events (F2-08)", () => {
  it("returns 401 without a session", async () => {
    const { GET } = await import("@/app/api/v1/goal-spaces/[id]/events/route");
    const response = await GET(createJsonRequest("/api/v1/goal-spaces/gs-1/events", "GET"), {
      params: Promise.resolve({ id: "gs-1" }),
    });
    expect(response.status).toBe(401);
  });

  it("returns 404 when the goal space does not exist", async () => {
    queueSelectResults(null);
    const { GET } = await import("@/app/api/v1/goal-spaces/[id]/events/route");
    const response = await GET(
      createJsonRequest(
        "/api/v1/goal-spaces/gs-missing/events",
        "GET",
        undefined,
        withTestSession(actorInitiator),
      ),
      { params: Promise.resolve({ id: "gs-missing" }) },
    );
    await expectApiError(response, "NOT_FOUND", 404);
  });

  it("returns 403 when the actor has no access to the goal space", async () => {
    queueSelectResults({ ...baseGoalSpace, initiatorId: "user-init-2" }, [
      { userId: "user-stranger" },
    ]);
    const { GET } = await import("@/app/api/v1/goal-spaces/[id]/events/route");
    const response = await GET(
      createJsonRequest(
        "/api/v1/goal-spaces/gs-1/events",
        "GET",
        undefined,
        withTestSession(actorChainUser),
      ),
      { params: Promise.resolve({ id: "gs-1" }) },
    );
    await expectApiError(response, "FORBIDDEN", 403);
  });

  it("returns 400 when limit > 500", async () => {
    queueSelectResults({ ...baseGoalSpace, initiatorId: "user-init" }, [{ userId: "user-chain" }]);
    const { GET } = await import("@/app/api/v1/goal-spaces/[id]/events/route");
    const response = await GET(
      createJsonRequest(
        "/api/v1/goal-spaces/gs-1/events?limit=1000",
        "GET",
        undefined,
        withTestSession(actorInitiator),
      ),
      { params: Promise.resolve({ id: "gs-1" }) },
    );
    await expectApiError(response, "INVALID_FIELD", 400);
  });

  it("returns 200 with the documented RealtimeEventsResponse shape", async () => {
    queueSelectResults(
      { ...baseGoalSpace, initiatorId: "user-init" },
      [{ userId: "user-chain" }],
      [
        {
          id: "evt-1",
          goalSpaceId: "gs-1",
          sequence: 1,
          type: "card.created",
          resourceType: "card",
          resourceId: "card-1",
          actor: "human",
          actorId: "user-init",
          data: { title: "Test" },
          occurredAt: "2026-06-19T00:00:00.000Z",
        },
      ],
    );
    const { GET } = await import("@/app/api/v1/goal-spaces/[id]/events/route");
    const response = await GET(
      createJsonRequest(
        "/api/v1/goal-spaces/gs-1/events",
        "GET",
        undefined,
        withTestSession(actorInitiator),
      ),
      { params: Promise.resolve({ id: "gs-1" }) },
    );
    const json = await expectApiOk<{
      events: Array<{
        id: string;
        type: string;
        goal_space_id: string;
        resource: { type: string; id: string };
      }>;
      has_more: boolean;
    }>(response);
    expect(json.data.events).toHaveLength(1);
    expect(json.data.events[0]).toMatchObject({
      id: "evt-1",
      type: "card_created",
      goal_space_id: "gs-1",
    });
    expect(json.data.events[0]!.resource).toEqual({ type: "card", id: "card-1" });
    expect(json.data.has_more).toBe(false);
  });

  it("returns 409 EVENT_CURSOR_EXPIRED for an unknown after_id", async () => {
    // Query order: goal space, members, cursor-existence, events list.
    queueSelectResults(
      { ...baseGoalSpace, initiatorId: "user-init" },
      [{ userId: "user-chain" }],
      null, // cursor not found → EVENT_CURSOR_EXPIRED
    );
    const { GET } = await import("@/app/api/v1/goal-spaces/[id]/events/route");
    const response = await GET(
      createJsonRequest(
        "/api/v1/goal-spaces/gs-1/events?after_id=evt-unknown",
        "GET",
        undefined,
        withTestSession(actorInitiator),
      ),
      { params: Promise.resolve({ id: "gs-1" }) },
    );
    await expectApiError(response, "EVENT_CURSOR_EXPIRED", 410);
  });
});

// ─── Wire-format mapping snapshot ────────────────────────────────────

describe("STORAGE_TO_WIRE_TYPE_MAP snapshot (F2-08)", () => {
  it("pins the documented storage → wire type translations", async () => {
    const { STORAGE_TO_WIRE_TYPE_MAP, WIRE_TO_STORAGE_TYPE_MAP, serializeSseEvent } =
      await import("@/lib/realtime/events");
    expect(STORAGE_TO_WIRE_TYPE_MAP).toMatchObject({
      "card.created": "card_created",
      "card.updated": "card_updated",
      "card.assigned": "card_assigned",
      "card.blocked": "card_blocked",
      "card.unblocked": "card_unblocked",
      "human_confirmation.approved": "confirmation_decided",
      "human_confirmation.rejected": "confirmation_decided",
      "agent_execution.queued": "ai_role_started",
      "agent_execution.completed": "ai_role_completed",
      "agent_execution.failed": "ai_role_failed",
      "agent_execution.needs_confirmation": "confirmation_requested",
      "node_board.created": "node_board_created",
      "node_board.updated": "node_board_updated",
      "node_board_member.added": "node_board_member_added",
      "node_board_member.removed": "node_board_member_removed",
    });
    // Inverse map sanity check.
    expect(WIRE_TO_STORAGE_TYPE_MAP.card_created).toBe("card.created");
    expect(WIRE_TO_STORAGE_TYPE_MAP.ai_role_started).toBe("agent_execution.queued");

    // Serialization produces the documented frame format.
    const frame = serializeSseEvent({
      id: "evt-1",
      goalSpaceId: "gs-1",
      sequence: 1,
      type: "card.created",
      resourceType: "card",
      resourceId: "card-1",
      actor: "human",
      actorId: "user-init",
      actorName: null,
      data: { title: "Test" },
      occurredAt: "2026-06-19T00:00:00.000Z",
    });
    expect(frame).toContain("id: evt-1");
    expect(frame).toContain("event: card_created");
    expect(frame).toContain('data: {"id":"evt-1"');
    expect(frame.endsWith("\n\n")).toBe(true);
  });
});
