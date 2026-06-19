/**
 * F2-03 Goal Space API contract tests (TDD, RED-first).
 *
 * Covers the seven documented endpoints in docs/specs/interface_spec.md § 3:
 *   - POST   /api/v1/goal-spaces
 *   - GET    /api/v1/goal-spaces
 *   - GET    /api/v1/goal-spaces/:id
 *   - PATCH  /api/v1/goal-spaces/:id
 *   - POST   /api/v1/goal-spaces/:id/start
 *   - POST   /api/v1/goal-spaces/:id/complete
 *   - POST   /api/v1/goal-spaces/:id/cancel
 *
 * Authorization matrix: docs/specs/authorization_matrix.md § 4.
 * Realtime event types: goal_space.created | updated | started | completed | cancelled.
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
type UpdateCall = { table: string; values: Record<string, unknown>; where?: unknown };
type InsertCall = { table: string; values: Record<string, unknown> };

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
  const selectLike = () => ({
    from: (_table: unknown) => makeChain(),
  });
  mockDb.select.mockImplementation(selectLike);
  (mockDb as Record<string, unknown>).selectDistinct = selectLike;
}

const capturedUpdates: UpdateCall[] = [];
const capturedInserts: InsertCall[] = [];

function captureMutations(): { updates: UpdateCall[]; inserts: InsertCall[] } {
  mockDb.update.mockImplementation((_table: unknown) => ({
    set: (values: Record<string, unknown>) => ({
      where: (where: unknown) => ({
        run: () => {
          capturedUpdates.push({ table: "table", values, where });
        },
      }),
    }),
  }));
  mockDb.insert.mockImplementation((_table: unknown) => ({
    values: (values: Record<string, unknown>) => ({
      run: () => {
        capturedInserts.push({ table: "table", values });
        return values;
      },
    }),
  }));
  return { updates: capturedUpdates, inserts: capturedInserts };
}

function makeTxHarness(insertedRow: Record<string, unknown> = { ...baseGoalSpace }): void {
  mockDb.transaction.mockImplementation((fn: (tx: unknown) => unknown) => {
    const mockTx = {
      insert: (_table: unknown) => ({
        values: (_values: Record<string, unknown>) => ({
          returning: () => ({
            get: () => insertedRow,
          }),
          run: () => {
            /* no-op for audit + realtime inserts */
          },
        }),
      }),
      update: (_table: unknown) => ({
        set: (_values: Record<string, unknown>) => ({
          where: (_where: unknown) => ({
            run: () => {
              /* no-op */
            },
            returning: () => ({
              get: () => insertedRow,
            }),
          }),
        }),
      }),
    };
    return fn(mockTx);
  });
}

const actorInitiator: Actor = { id: "user-init", role: "initiator" };
const actorChainUser: Actor = { id: "user-chain", role: "chain_user" };
const actorViewer: Actor = { id: "user-viewer", role: "viewer" };

const baseGoalSpace = {
  id: "gs-1",
  initiatorId: "user-init",
  name: "Ship Phase 2 Beta",
  description: "Description",
  constraints: ["must run locally"],
  acceptanceCriteria: [{ criterion: "all routes 200", evidence: ["curl"] }],
  status: "draft",
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

const baseContext = {
  goalSpaceId: "gs-1",
  initiatorId: "user-init",
  nodeBoardMemberIds: [] as string[],
};

function resetEnv(): void {
  process.env.KEPLAR_SESSION_SECRET = "test-session-secret";
}

// ─── POST /api/v1/goal-spaces ───────────────────────────────────────

describe("POST /api/v1/goal-spaces (F2-03)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedUpdates.length = 0;
    capturedInserts.length = 0;
    resetEnv();
  });
  afterEach(() => vi.restoreAllMocks());

  it("returns 401 when no authenticated session is present", async () => {
    const { POST } = await import("@/app/api/v1/goal-spaces/route");
    const response = await POST(createJsonRequest("/api/v1/goal-spaces", "POST", { name: "X" }));
    await expectApiError(response, "UNAUTHORIZED", 401);
  });

  it("returns 403 when a non-initiator tries to create a goal space", async () => {
    queueSelectResults(null);
    const { POST } = await import("@/app/api/v1/goal-spaces/route");
    const response = await POST(
      createJsonRequest(
        "/api/v1/goal-spaces",
        "POST",
        { name: "X" },
        withTestSession(actorChainUser),
      ),
    );
    await expectApiError(response, "FORBIDDEN", 403);
  });

  it("returns 400 when name is missing", async () => {
    const { POST } = await import("@/app/api/v1/goal-spaces/route");
    const response = await POST(
      createJsonRequest(
        "/api/v1/goal-spaces",
        "POST",
        { description: "no name" },
        withTestSession(actorInitiator),
      ),
    );
    await expectApiError(response, "INVALID_FIELD", 400);
  });

  it("returns 201 with the documented GoalSpaceResponse and writes audit + realtime", async () => {
    queueSelectResults({ ...baseGoalSpace });
    captureMutations();
    makeTxHarness({ ...baseGoalSpace, name: "Ship Phase 2 Beta" });

    const { POST } = await import("@/app/api/v1/goal-spaces/route");
    const response = await POST(
      createJsonRequest(
        "/api/v1/goal-spaces",
        "POST",
        {
          name: "Ship Phase 2 Beta",
          description: "Description",
          constraints: ["must run locally"],
          acceptance_criteria: [{ criterion: "all routes 200", evidence: ["curl"] }],
        },
        withTestSession(actorInitiator),
      ),
    );

    const json = await expectApiOk<{
      id: string;
      name: string;
      status: string;
      initiator_id: string;
      node_board_counts: { total: number; active: number; completed: number };
      card_counts: Record<string, number>;
    }>(response);
    expect(json.data).toMatchObject({
      id: "gs-1",
      name: "Ship Phase 2 Beta",
      status: "draft",
      initiator_id: "user-init",
    });
    expect(json.data.node_board_counts).toEqual({ total: 0, active: 0, completed: 0 });
    expect(json.data.card_counts).toEqual({
      backlog: 0,
      todo: 0,
      dev: 0,
      review: 0,
      done: 0,
      blocked: 0,
      cancelled: 0,
    });
    // audit + realtime should be written via runWithAudit (transaction-wrapped)
    expect(mockDb.transaction).toHaveBeenCalledTimes(1);
  });
});

// ─── GET /api/v1/goal-spaces ────────────────────────────────────────

describe("GET /api/v1/goal-spaces (F2-03)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedUpdates.length = 0;
    capturedInserts.length = 0;
    resetEnv();
  });
  afterEach(() => vi.restoreAllMocks());

  it("returns 401 without a session", async () => {
    const { GET } = await import("@/app/api/v1/goal-spaces/route");
    const response = await GET(createJsonRequest("/api/v1/goal-spaces", "GET"));
    await expectApiError(response, "UNAUTHORIZED", 401);
  });

  it("returns 200 with paginated items the actor can read", async () => {
    // Query order in the service:
    //   1. total count for pagination (first .get())
    //   2. list goal spaces (then .all())
    //   3. node board counts for the listed goal space(s)
    //   4. card counts for the listed goal space(s)
    queueSelectResults(
      { value: 1 }, // total
      [{ ...baseGoalSpace, status: "active" }], // list
      [{ status: "active", value: 0 }], // node board counts
      [{ state: "todo", value: 0 }], // card counts
    );
    const { GET } = await import("@/app/api/v1/goal-spaces/route");
    const response = await GET(
      createJsonRequest(
        "/api/v1/goal-spaces?status=active&page=1&limit=20",
        "GET",
        undefined,
        withTestSession(actorInitiator),
      ),
    );
    const json = await expectApiOk<{
      items: Array<{ id: string; status: string }>;
      total: number;
      page: number;
      limit: number;
    }>(response);
    expect(json.data.items).toHaveLength(1);
    expect(json.data.items[0]).toMatchObject({ id: "gs-1", status: "active" });
    expect(json.data.total).toBe(1);
    expect(json.data.page).toBe(1);
    expect(json.data.limit).toBe(20);
  });

  it("returns 400 for invalid page/limit", async () => {
    const { GET } = await import("@/app/api/v1/goal-spaces/route");
    const response = await GET(
      createJsonRequest(
        "/api/v1/goal-spaces?page=0",
        "GET",
        undefined,
        withTestSession(actorInitiator),
      ),
    );
    await expectApiError(response, "INVALID_FIELD", 400);
  });
});

// ─── GET /api/v1/goal-spaces/:id ────────────────────────────────────

describe("GET /api/v1/goal-spaces/:id (F2-03)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedUpdates.length = 0;
    capturedInserts.length = 0;
    resetEnv();
  });
  afterEach(() => vi.restoreAllMocks());

  it("returns 200 with detail for a readable goal space", async () => {
    // Query order in the service:
    //   1. goal space by id
    //   2. node board members (for authorization)
    //   3. node board counts (grouped)
    //   4. card counts (grouped)
    queueSelectResults(
      { ...baseGoalSpace, status: "active", startedAt: "2026-06-19T00:01:00.000Z" },
      [{ userId: "user-init" }],
      [{ status: "active", value: 1 }],
      [{ state: "todo", value: 0 }],
    );
    const { GET } = await import("@/app/api/v1/goal-spaces/[id]/route");
    const response = await GET(
      createJsonRequest(
        "/api/v1/goal-spaces/gs-1",
        "GET",
        undefined,
        withTestSession(actorInitiator),
      ),
      { params: Promise.resolve({ id: "gs-1" }) },
    );
    const json = await expectApiOk<{
      id: string;
      started_at: string;
      cards: unknown[];
    }>(response);
    expect(json.data).toMatchObject({
      id: "gs-1",
      started_at: "2026-06-19T00:01:00.000Z",
    });
    expect(json.data.cards).toEqual([]);
  });

  it("returns 404 when the goal space does not exist", async () => {
    queueSelectResults(null);
    const { GET } = await import("@/app/api/v1/goal-spaces/[id]/route");
    const response = await GET(
      createJsonRequest(
        "/api/v1/goal-spaces/missing",
        "GET",
        undefined,
        withTestSession(actorInitiator),
      ),
      { params: Promise.resolve({ id: "missing" }) },
    );
    await expectApiError(response, "NOT_FOUND", 404);
  });

  it("returns 403 when the actor cannot read the goal space", async () => {
    // first select: goal space exists but for a different initiator
    // second select: no node board members (chain_user is not a member)
    queueSelectResults({ ...baseGoalSpace, initiatorId: "other-init" }, []);
    const { GET } = await import("@/app/api/v1/goal-spaces/[id]/route");
    const response = await GET(
      createJsonRequest(
        "/api/v1/goal-spaces/gs-1",
        "GET",
        undefined,
        withTestSession(actorChainUser),
      ),
      { params: Promise.resolve({ id: "gs-1" }) },
    );
    await expectApiError(response, "FORBIDDEN", 403);
  });
});

// ─── PATCH /api/v1/goal-spaces/:id ──────────────────────────────────

describe("PATCH /api/v1/goal-spaces/:id (F2-03)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedUpdates.length = 0;
    capturedInserts.length = 0;
    resetEnv();
  });
  afterEach(() => vi.restoreAllMocks());

  it("returns 200 with the updated goal space when initiator updates a draft", async () => {
    // Query order: goal space, members (initiator is a member of own goal space)
    queueSelectResults({ ...baseGoalSpace, status: "draft" }, [{ userId: "user-init" }]);
    captureMutations();
    makeTxHarness({
      ...baseGoalSpace,
      status: "draft",
      name: "Updated",
      updatedAt: "2026-06-19T00:05:00.000Z",
    });

    const { PATCH } = await import("@/app/api/v1/goal-spaces/[id]/route");
    const response = await PATCH(
      createJsonRequest(
        "/api/v1/goal-spaces/gs-1",
        "PATCH",
        { name: "Updated" },
        withTestSession(actorInitiator),
      ),
      { params: Promise.resolve({ id: "gs-1" }) },
    );
    const json = await expectApiOk<{ name: string }>(response);
    expect(json.data.name).toBe("Updated");
  });

  it("returns 409 with STATE_CONFLICT when the goal space is not draft", async () => {
    queueSelectResults({ ...baseGoalSpace, status: "active" }, [{ userId: "user-init" }]);
    const { PATCH } = await import("@/app/api/v1/goal-spaces/[id]/route");
    const response = await PATCH(
      createJsonRequest(
        "/api/v1/goal-spaces/gs-1",
        "PATCH",
        { name: "X" },
        withTestSession(actorInitiator),
      ),
      { params: Promise.resolve({ id: "gs-1" }) },
    );
    await expectApiError(response, "STATE_CONFLICT", 409);
  });

  it("returns 403 when a non-initiator tries to update", async () => {
    queueSelectResults({ ...baseGoalSpace, initiatorId: "other-init" }, []);
    const { PATCH } = await import("@/app/api/v1/goal-spaces/[id]/route");
    const response = await PATCH(
      createJsonRequest(
        "/api/v1/goal-spaces/gs-1",
        "PATCH",
        { name: "X" },
        withTestSession(actorChainUser),
      ),
      { params: Promise.resolve({ id: "gs-1" }) },
    );
    await expectApiError(response, "FORBIDDEN", 403);
  });
});

// ─── POST /api/v1/goal-spaces/:id/start ─────────────────────────────

describe("POST /api/v1/goal-spaces/:id/start (F2-03)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedUpdates.length = 0;
    capturedInserts.length = 0;
    resetEnv();
  });
  afterEach(() => vi.restoreAllMocks());

  it("returns 200 with StartGoalSpaceResponse from draft", async () => {
    queueSelectResults({ ...baseGoalSpace, status: "draft" }, [{ userId: "user-init" }]);
    captureMutations();
    makeTxHarness({ ...baseGoalSpace, status: "active" });

    const { POST } = await import("@/app/api/v1/goal-spaces/[id]/start/route");
    const response = await POST(
      createJsonRequest(
        "/api/v1/goal-spaces/gs-1/start",
        "POST",
        undefined,
        withTestSession(actorInitiator),
      ),
      { params: Promise.resolve({ id: "gs-1" }) },
    );
    const json = await expectApiOk<{
      status: string;
      started_at: string;
      cards_generated: number;
    }>(response);
    expect(json.data.status).toBe("active");
    expect(typeof json.data.started_at).toBe("string");
    expect(json.data.cards_generated).toBe(0);
  });

  it("returns 409 with STATE_CONFLICT when the goal space is already active", async () => {
    queueSelectResults({ ...baseGoalSpace, status: "active" }, [{ userId: "user-init" }]);
    const { POST } = await import("@/app/api/v1/goal-spaces/[id]/start/route");
    const response = await POST(
      createJsonRequest(
        "/api/v1/goal-spaces/gs-1/start",
        "POST",
        undefined,
        withTestSession(actorInitiator),
      ),
      { params: Promise.resolve({ id: "gs-1" }) },
    );
    await expectApiError(response, "STATE_CONFLICT", 409);
  });

  it("returns 403 for a non-initiator", async () => {
    queueSelectResults({ ...baseGoalSpace, initiatorId: "other-init" }, []);
    const { POST } = await import("@/app/api/v1/goal-spaces/[id]/start/route");
    const response = await POST(
      createJsonRequest(
        "/api/v1/goal-spaces/gs-1/start",
        "POST",
        undefined,
        withTestSession(actorChainUser),
      ),
      { params: Promise.resolve({ id: "gs-1" }) },
    );
    await expectApiError(response, "FORBIDDEN", 403);
  });
});

// ─── POST /api/v1/goal-spaces/:id/complete ──────────────────────────

describe("POST /api/v1/goal-spaces/:id/complete (F2-03)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedUpdates.length = 0;
    capturedInserts.length = 0;
    resetEnv();
  });
  afterEach(() => vi.restoreAllMocks());

  it("returns 200 with the summary when all preconditions are met", async () => {
    // Query order in the service:
    //   1. goal space by id
    //   2. node board members (for authorization)
    //   3. precondition: pending confirmations count
    //   4. precondition: blocked cards count
    //   5. precondition: non-terminal cards count
    //   6. card counts for the summary (inside transaction callback)
    queueSelectResults(
      { ...baseGoalSpace, status: "active", startedAt: "2026-06-19T00:01:00.000Z" },
      [{ userId: "user-init" }],
      { value: 0 }, // pending confirmations
      { value: 0 }, // blocked cards
      { value: 0 }, // non-terminal cards
      [], // card counts for summary
    );
    captureMutations();
    makeTxHarness({ ...baseGoalSpace, status: "completed" });

    const { POST } = await import("@/app/api/v1/goal-spaces/[id]/complete/route");
    const response = await POST(
      createJsonRequest(
        "/api/v1/goal-spaces/gs-1/complete",
        "POST",
        undefined,
        withTestSession(actorInitiator),
      ),
      { params: Promise.resolve({ id: "gs-1" }) },
    );
    const json = await expectApiOk<{
      status: string;
      completed_at: string;
      summary: { total_cards: number; done_cards: number; blocked_cards: number };
    }>(response);
    expect(json.data.status).toBe("completed");
    expect(typeof json.data.completed_at).toBe("string");
    expect(json.data.summary).toEqual({ total_cards: 0, done_cards: 0, blocked_cards: 0 });
  });

  it("returns 409 with CONFIRMATION_REQUIRED when a pending confirmation exists", async () => {
    queueSelectResults(
      { ...baseGoalSpace, status: "active" },
      [{ userId: "user-init" }],
      { value: 1 }, // pending confirmations
      { value: 0 },
      { value: 0 },
    );
    const { POST } = await import("@/app/api/v1/goal-spaces/[id]/complete/route");
    const response = await POST(
      createJsonRequest(
        "/api/v1/goal-spaces/gs-1/complete",
        "POST",
        undefined,
        withTestSession(actorInitiator),
      ),
      { params: Promise.resolve({ id: "gs-1" }) },
    );
    await expectApiError(response, "CONFIRMATION_REQUIRED", 409);
  });

  it("returns 409 with STATE_CONFLICT when any card is blocked", async () => {
    queueSelectResults(
      { ...baseGoalSpace, status: "active" },
      [{ userId: "user-init" }],
      { value: 0 },
      { value: 1 }, // blocked card
      { value: 0 },
    );
    const { POST } = await import("@/app/api/v1/goal-spaces/[id]/complete/route");
    const response = await POST(
      createJsonRequest(
        "/api/v1/goal-spaces/gs-1/complete",
        "POST",
        undefined,
        withTestSession(actorInitiator),
      ),
      { params: Promise.resolve({ id: "gs-1" }) },
    );
    await expectApiError(response, "STATE_CONFLICT", 409);
  });

  it("returns 422 with VALIDATION_ERROR when not all cards are done or cancelled", async () => {
    queueSelectResults(
      { ...baseGoalSpace, status: "active" },
      [{ userId: "user-init" }],
      { value: 0 },
      { value: 0 },
      { value: 1 }, // one card still in non-terminal state
    );
    const { POST } = await import("@/app/api/v1/goal-spaces/[id]/complete/route");
    const response = await POST(
      createJsonRequest(
        "/api/v1/goal-spaces/gs-1/complete",
        "POST",
        undefined,
        withTestSession(actorInitiator),
      ),
      { params: Promise.resolve({ id: "gs-1" }) },
    );
    await expectApiError(response, "VALIDATION_ERROR", 422);
  });

  it("returns 409 with STATE_CONFLICT when the goal space is draft (cannot complete from draft)", async () => {
    queueSelectResults({ ...baseGoalSpace, status: "draft" }, [{ userId: "user-init" }]);
    const { POST } = await import("@/app/api/v1/goal-spaces/[id]/complete/route");
    const response = await POST(
      createJsonRequest(
        "/api/v1/goal-spaces/gs-1/complete",
        "POST",
        undefined,
        withTestSession(actorInitiator),
      ),
      { params: Promise.resolve({ id: "gs-1" }) },
    );
    await expectApiError(response, "STATE_CONFLICT", 409);
  });
});

// ─── POST /api/v1/goal-spaces/:id/cancel ────────────────────────────

describe("POST /api/v1/goal-spaces/:id/cancel (F2-03)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedUpdates.length = 0;
    capturedInserts.length = 0;
    resetEnv();
  });
  afterEach(() => vi.restoreAllMocks());

  it("returns 200 with the cancel summary from active", async () => {
    // Query order in the service:
    //   1. goal space by id
    //   2. node board members (for authorization)
    //   3. card counts grouped by state (for summary, inside transaction callback)
    queueSelectResults(
      { ...baseGoalSpace, status: "active" },
      [{ userId: "user-init" }],
      [
        { state: "done", value: 2 },
        { state: "cancelled", value: 1 },
      ],
    );
    captureMutations();
    makeTxHarness({ ...baseGoalSpace, status: "cancelled" });

    const { POST } = await import("@/app/api/v1/goal-spaces/[id]/cancel/route");
    const response = await POST(
      createJsonRequest(
        "/api/v1/goal-spaces/gs-1/cancel",
        "POST",
        { reason: "scope change" },
        withTestSession(actorInitiator),
      ),
      { params: Promise.resolve({ id: "gs-1" }) },
    );
    const json = await expectApiOk<{
      status: string;
      cancel_reason: string;
      summary: {
        total_cards: number;
        done_cards: number;
        cancelled_cards: number;
        blocked_cards: number;
      };
    }>(response);
    expect(json.data.status).toBe("cancelled");
    expect(json.data.cancel_reason).toBe("scope change");
    expect(json.data.summary).toEqual({
      total_cards: 3,
      done_cards: 2,
      cancelled_cards: 1,
      blocked_cards: 0,
    });
  });

  it("returns 200 with the cancel summary from draft", async () => {
    queueSelectResults({ ...baseGoalSpace, status: "draft" }, [{ userId: "user-init" }], []);
    captureMutations();
    makeTxHarness({ ...baseGoalSpace, status: "cancelled" });

    const { POST } = await import("@/app/api/v1/goal-spaces/[id]/cancel/route");
    const response = await POST(
      createJsonRequest(
        "/api/v1/goal-spaces/gs-1/cancel",
        "POST",
        { reason: "abandon before start" },
        withTestSession(actorInitiator),
      ),
      { params: Promise.resolve({ id: "gs-1" }) },
    );
    const json = await expectApiOk<{ status: string }>(response);
    expect(json.data.status).toBe("cancelled");
  });

  it("returns 400 when reason is missing", async () => {
    const { POST } = await import("@/app/api/v1/goal-spaces/[id]/cancel/route");
    const response = await POST(
      createJsonRequest(
        "/api/v1/goal-spaces/gs-1/cancel",
        "POST",
        {},
        withTestSession(actorInitiator),
      ),
      { params: Promise.resolve({ id: "gs-1" }) },
    );
    await expectApiError(response, "INVALID_FIELD", 400);
  });

  it("returns 400 when reason is empty", async () => {
    const { POST } = await import("@/app/api/v1/goal-spaces/[id]/cancel/route");
    const response = await POST(
      createJsonRequest(
        "/api/v1/goal-spaces/gs-1/cancel",
        "POST",
        { reason: "   " },
        withTestSession(actorInitiator),
      ),
      { params: Promise.resolve({ id: "gs-1" }) },
    );
    await expectApiError(response, "INVALID_FIELD", 400);
  });

  it("returns 409 with STATE_CONFLICT when the goal space is already completed", async () => {
    queueSelectResults({ ...baseGoalSpace, status: "completed" }, [{ userId: "user-init" }]);
    const { POST } = await import("@/app/api/v1/goal-spaces/[id]/cancel/route");
    const response = await POST(
      createJsonRequest(
        "/api/v1/goal-spaces/gs-1/cancel",
        "POST",
        { reason: "x" },
        withTestSession(actorInitiator),
      ),
      { params: Promise.resolve({ id: "gs-1" }) },
    );
    await expectApiError(response, "STATE_CONFLICT", 409);
  });

  it("returns 403 for a non-initiator", async () => {
    queueSelectResults({ ...baseGoalSpace, initiatorId: "other-init" }, []);
    const { POST } = await import("@/app/api/v1/goal-spaces/[id]/cancel/route");
    const response = await POST(
      createJsonRequest(
        "/api/v1/goal-spaces/gs-1/cancel",
        "POST",
        { reason: "x" },
        withTestSession(actorChainUser),
      ),
      { params: Promise.resolve({ id: "gs-1" }) },
    );
    await expectApiError(response, "FORBIDDEN", 403);
  });
});
