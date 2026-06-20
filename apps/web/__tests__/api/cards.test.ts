/**
 * F2-05 Card And Transition API contract tests (TDD, RED-first).
 *
 * Covers the eight documented endpoints in docs/specs/interface_spec.md § 4 + § 5.1:
 *   - GET    /api/v1/goal-spaces/:goalSpaceId/cards
 *   - POST   /api/v1/goal-spaces/:goalSpaceId/cards
 *   - GET    /api/v1/cards/:id
 *   - PATCH  /api/v1/cards/:id
 *   - POST   /api/v1/cards/:id/assign
 *   - POST   /api/v1/cards/:id/block
 *   - POST   /api/v1/cards/:id/unblock
 *   - GET    /api/v1/cards/:id/transitions
 *
 * Authorization matrix: docs/specs/authorization_matrix.md § 4 (cards row).
 * Realtime event types: CARD_REALTIME_EVENTS constants exported from services.
 * State machine: canTransition / assertTransition (F-002).
 * Pending confirmation gate: canMutateCard('unblock') returns false when
 * hasPendingConfirmation=true (F-003 + spec § 5 mandatory gate).
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
  const selectLike = () => ({
    from: (_table: unknown) => makeChain(),
  });
  mockDb.select.mockImplementation(selectLike);
  (mockDb as Record<string, unknown>).selectDistinct = selectLike;
}

const capturedInserts: Array<{ table: string; values: Record<string, unknown> }> = [];

function captureMutations(): void {
  mockDb.update.mockImplementation((_table: unknown) => ({
    set: (_values: Record<string, unknown>) => ({
      where: (_where: unknown) => ({
        run: () => {
          /* captured via makeTxHarness */
        },
        returning: () => ({
          get: () => ({}),
        }),
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
}

/**
 * Build a tx mock that returns the supplied row for the first insert-with-returning
 * (the cards row). Subsequent insert-with-returning calls return the same shape.
 * runWithAudit writes audit_entries and realtime_events via insert(values).run()
 * without returning — capture those too.
 */
function makeTxHarness(insertedRow: Record<string, unknown>): void {
  mockDb.transaction.mockImplementation((fn: (tx: unknown) => unknown) => {
    const makeSelectChain = (): Record<string, unknown> => {
      const chain: Record<string, unknown> = {};
      chain.get = () => ({ max: null });
      chain.all = () => [];
      chain.where = () => makeSelectChain();
      chain.orderBy = () => makeSelectChain();
      chain.limit = () => makeSelectChain();
      return chain;
    };
    const mockTx = {
      select: (_table?: unknown) => ({ from: () => makeSelectChain() }),
      insert: (_table: unknown) => ({
        values: (values: Record<string, unknown>) => ({
          returning: () => ({
            get: () => ({ ...insertedRow }),
          }),
          run: () => {
            capturedInserts.push({ table: "table", values });
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
              get: () => ({ ...insertedRow }),
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
  status: "active",
  progress: 0,
  templateId: null,
  tags: [],
  startedAt: "2026-06-19T00:00:00.000Z",
  completedAt: null,
  cancelledAt: null,
  cancelReason: null,
  deletedAt: null,
  createdAt: "2026-06-19T00:00:00.000Z",
  updatedAt: "2026-06-19T00:00:00.000Z",
};

const baseCard = {
  id: "card-1",
  goalSpaceId: "gs-1",
  nodeBoardId: "nb-1",
  displayId: "CARD-001",
  title: "Implement login",
  description: "Wire up auth flow",
  state: "backlog",
  assignedTo: null,
  priority: 0,
  riskLevel: "medium",
  evidence: [],
  confidence: null,
  dependencies: [],
  tags: [],
  context: {},
  blockedReason: null,
  blockedAt: null,
  cancelledReason: null,
  cancelledAt: null,
  createdAt: "2026-06-19T00:00:00.000Z",
  updatedAt: "2026-06-19T00:00:00.000Z",
  deletedAt: null,
};

function resetEnv(): void {
  process.env.KEPLAR_SESSION_SECRET = "test-session-secret";
}

function expectAuditCall(
  captured: Array<{ values: Record<string, unknown> }>,
  entityType: string,
  action: string,
): void {
  const auditCall = captured.find(
    (c) =>
      c.values &&
      (c.values as Record<string, unknown>).entityType === entityType &&
      (c.values as Record<string, unknown>).action === action,
  );
  expect(auditCall).toBeDefined();
}

function expectRealtimeCall(
  captured: Array<{ values: Record<string, unknown> }>,
  type: string,
  resourceType: string,
): void {
  const realtimeCall = captured.find(
    (c) =>
      c.values &&
      (c.values as Record<string, unknown>).type === type &&
      (c.values as Record<string, unknown>).resourceType === resourceType,
  );
  expect(realtimeCall).toBeDefined();
}

beforeEach(() => {
  vi.clearAllMocks();
  capturedInserts.length = 0;
  resetEnv();
});
afterEach(() => vi.restoreAllMocks());

// ─── POST /api/v1/goal-spaces/:goalSpaceId/cards ────────────────────

describe("POST /api/v1/goal-spaces/:goalSpaceId/cards (F2-05)", () => {
  it("returns 401 without a session", async () => {
    const { POST } = await import("@/app/api/v1/goal-spaces/[goalSpaceId]/cards/route");
    const response = await POST(
      createJsonRequest("/api/v1/goal-spaces/gs-1/cards", "POST", {
        title: "Card",
        node_board_id: "nb-1",
      }),
      { params: Promise.resolve({ goalSpaceId: "gs-1" }) },
    );
    await expectApiError(response, "UNAUTHORIZED", 401);
  });

  it("returns 403 when a viewer tries to create a card", async () => {
    queueSelectResults({ ...baseGoalSpace }, [{ userId: "user-chain" }]);
    const { POST } = await import("@/app/api/v1/goal-spaces/[goalSpaceId]/cards/route");
    const response = await POST(
      createJsonRequest(
        "/api/v1/goal-spaces/gs-1/cards",
        "POST",
        { title: "Card", node_board_id: "nb-1" },
        withTestSession(actorViewer),
      ),
      { params: Promise.resolve({ goalSpaceId: "gs-1" }) },
    );
    await expectApiError(response, "FORBIDDEN", 403);
  });

  it("returns 400 when title is missing", async () => {
    queueSelectResults({ ...baseGoalSpace }, [{ userId: "user-chain" }]);
    const { POST } = await import("@/app/api/v1/goal-spaces/[goalSpaceId]/cards/route");
    const response = await POST(
      createJsonRequest(
        "/api/v1/goal-spaces/gs-1/cards",
        "POST",
        { node_board_id: "nb-1" },
        withTestSession(actorInitiator),
      ),
      { params: Promise.resolve({ goalSpaceId: "gs-1" }) },
    );
    await expectApiError(response, "INVALID_FIELD", 400);
  });

  it("returns 400 when node_board_id is missing", async () => {
    queueSelectResults({ ...baseGoalSpace }, [{ userId: "user-chain" }]);
    const { POST } = await import("@/app/api/v1/goal-spaces/[goalSpaceId]/cards/route");
    const response = await POST(
      createJsonRequest(
        "/api/v1/goal-spaces/gs-1/cards",
        "POST",
        { title: "Card" },
        withTestSession(actorInitiator),
      ),
      { params: Promise.resolve({ goalSpaceId: "gs-1" }) },
    );
    await expectApiError(response, "INVALID_FIELD", 400);
  });

  it("returns 404 when goal space does not exist", async () => {
    queueSelectResults(null);
    const { POST } = await import("@/app/api/v1/goal-spaces/[goalSpaceId]/cards/route");
    const response = await POST(
      createJsonRequest(
        "/api/v1/goal-spaces/gs-missing/cards",
        "POST",
        { title: "Card", node_board_id: "nb-1" },
        withTestSession(actorInitiator),
      ),
      { params: Promise.resolve({ goalSpaceId: "gs-missing" }) },
    );
    await expectApiError(response, "NOT_FOUND", 404);
  });

  it("returns 201 with CardResponse and writes audit + realtime", async () => {
    // Query order in createCardService:
    //   1. goal space by id (getGoalSpaceWithMembers → goal space row)
    //   2. members of goal space (getGoalSpaceWithMembers → distinct user_id)
    //   3. node board by id (verify it exists in this goal space) — we skip that here
    //   4. display id counter (MAX(SUBSTR(display_id, 6))) inside the tx
    queueSelectResults({ ...baseGoalSpace }, [{ userId: "user-chain" }]);
    captureMutations();
    makeTxHarness({ ...baseCard });

    const { POST } = await import("@/app/api/v1/goal-spaces/[goalSpaceId]/cards/route");
    const response = await POST(
      createJsonRequest(
        "/api/v1/goal-spaces/gs-1/cards",
        "POST",
        { title: "Implement login", description: "Wire up auth flow", node_board_id: "nb-1" },
        withTestSession(actorInitiator),
      ),
      { params: Promise.resolve({ goalSpaceId: "gs-1" }) },
    );
    const json = await expectApiOk<{
      id: string;
      title: string;
      state: string;
      goal_space_id: string;
      display_id: string;
    }>(response);
    expect(json.data).toMatchObject({
      id: "card-1",
      title: "Implement login",
      state: "backlog",
      goal_space_id: "gs-1",
    });
    expect(mockDb.transaction).toHaveBeenCalledTimes(1);
    expectAuditCall(capturedInserts, "card", "create");
    expectRealtimeCall(capturedInserts, "card.created", "card");
  });
});

// ─── GET /api/v1/goal-spaces/:goalSpaceId/cards ─────────────────────

describe("GET /api/v1/goal-spaces/:goalSpaceId/cards (F2-05)", () => {
  it("returns 401 without a session", async () => {
    const { GET } = await import("@/app/api/v1/goal-spaces/[goalSpaceId]/cards/route");
    const response = await GET(createJsonRequest("/api/v1/goal-spaces/gs-1/cards", "GET"), {
      params: Promise.resolve({ goalSpaceId: "gs-1" }),
    });
    await expectApiError(response, "UNAUTHORIZED", 401);
  });

  it("returns 200 with the cards visible to the initiator", async () => {
    // Query order:
    //   1. goal space by id (getGoalSpaceWithMembers → row)
    //   2. members (getGoalSpaceWithMembers → distinct)
    //   3. cards (listActiveCardsForGoalSpace → initiator path)
    queueSelectResults({ ...baseGoalSpace }, [{ userId: "user-chain" }], [{ ...baseCard }]);
    const { GET } = await import("@/app/api/v1/goal-spaces/[goalSpaceId]/cards/route");
    const response = await GET(
      createJsonRequest(
        "/api/v1/goal-spaces/gs-1/cards",
        "GET",
        undefined,
        withTestSession(actorInitiator),
      ),
      { params: Promise.resolve({ goalSpaceId: "gs-1" }) },
    );
    const json = await expectApiOk<{ items: unknown[]; total: number }>(response);
    expect(json.data.items).toHaveLength(1);
    expect(json.data.total).toBe(1);
  });

  it("returns 200 with the cards visible to a chain_user member", async () => {
    // Query order (chain_user path):
    //   1. goal space row
    //   2. goal space members
    //   3. member board ids for actor (distinct)
    //   4. cards matching goal space + ids (or assigned_to)
    queueSelectResults(
      { ...baseGoalSpace },
      [{ userId: "user-chain" }],
      [{ boardId: "nb-1" }],
      [{ ...baseCard }],
    );
    const { GET } = await import("@/app/api/v1/goal-spaces/[goalSpaceId]/cards/route");
    const response = await GET(
      createJsonRequest(
        "/api/v1/goal-spaces/gs-1/cards",
        "GET",
        undefined,
        withTestSession(actorChainUser),
      ),
      { params: Promise.resolve({ goalSpaceId: "gs-1" }) },
    );
    const json = await expectApiOk<{ items: unknown[]; total: number }>(response);
    expect(json.data.items).toHaveLength(1);
  });

  it("returns 403 when the actor has no access to the goal space", async () => {
    queueSelectResults({ ...baseGoalSpace }, [{ userId: "user-other" }]);
    const { GET } = await import("@/app/api/v1/goal-spaces/[goalSpaceId]/cards/route");
    const response = await GET(
      createJsonRequest(
        "/api/v1/goal-spaces/gs-1/cards",
        "GET",
        undefined,
        withTestSession(actorViewer),
      ),
      { params: Promise.resolve({ goalSpaceId: "gs-1" }) },
    );
    await expectApiError(response, "FORBIDDEN", 403);
  });

  it("returns 404 when the goal space does not exist", async () => {
    queueSelectResults(null);
    const { GET } = await import("@/app/api/v1/goal-spaces/[goalSpaceId]/cards/route");
    const response = await GET(
      createJsonRequest(
        "/api/v1/goal-spaces/gs-missing/cards",
        "GET",
        undefined,
        withTestSession(actorInitiator),
      ),
      { params: Promise.resolve({ goalSpaceId: "gs-missing" }) },
    );
    await expectApiError(response, "NOT_FOUND", 404);
  });
});

// ─── GET /api/v1/cards/:id ─────────────────────────────────────────

describe("GET /api/v1/cards/:id (F2-05)", () => {
  it("returns 401 without a session", async () => {
    const { GET } = await import("@/app/api/v1/cards/[id]/route");
    const response = await GET(createJsonRequest("/api/v1/cards/card-1", "GET"), {
      params: Promise.resolve({ id: "card-1" }),
    });
    await expectApiError(response, "UNAUTHORIZED", 401);
  });

  it("returns 200 with CardDetailResponse for a readable card", async () => {
    // Query order in getCardDetailService:
    //   1. card by id (getCardById)
    //   2. members of the card's node board (getCardContext)
    //   3. goal space initiator (getCardContext)
    //   4. pending confirmation count (getCardContext)
    //   5. transitions for card
    //   6. confirmations for card
    //   7. audit trail (last 50)
    queueSelectResults(
      { ...baseCard },
      [{ userId: "user-chain" }],
      { ...baseGoalSpace, initiatorId: "user-init" },
      [],
      [],
      [],
      [],
    );
    const { GET } = await import("@/app/api/v1/cards/[id]/route");
    const response = await GET(
      createJsonRequest("/api/v1/cards/card-1", "GET", undefined, withTestSession(actorInitiator)),
      { params: Promise.resolve({ id: "card-1" }) },
    );
    const json = await expectApiOk<{
      id: string;
      transitions: unknown[];
      confirmations: unknown[];
      audit_trail: unknown[];
    }>(response);
    expect(json.data.id).toBe("card-1");
    expect(json.data.transitions).toEqual([]);
  });

  it("returns 404 when the card does not exist", async () => {
    queueSelectResults(null);
    const { GET } = await import("@/app/api/v1/cards/[id]/route");
    const response = await GET(
      createJsonRequest(
        "/api/v1/cards/card-missing",
        "GET",
        undefined,
        withTestSession(actorInitiator),
      ),
      { params: Promise.resolve({ id: "card-missing" }) },
    );
    await expectApiError(response, "NOT_FOUND", 404);
  });
});

// ─── PATCH /api/v1/cards/:id ───────────────────────────────────────

describe("PATCH /api/v1/cards/:id (F2-05)", () => {
  it("returns 401 without a session", async () => {
    const { PATCH } = await import("@/app/api/v1/cards/[id]/route");
    const response = await PATCH(
      createJsonRequest("/api/v1/cards/card-1", "PATCH", { title: "New" }),
      {
        params: Promise.resolve({ id: "card-1" }),
      },
    );
    await expectApiError(response, "UNAUTHORIZED", 401);
  });

  it("returns 422 when risk_level is invalid", async () => {
    // getCardContext query order:
    //   1. card by id
    //   2. members of card's node board
    //   3. goal space initiator
    //   4. pending confirmation count
    queueSelectResults(
      { ...baseCard },
      [{ userId: "user-chain" }],
      { ...baseGoalSpace, initiatorId: "user-init" },
      [],
    );
    const { PATCH } = await import("@/app/api/v1/cards/[id]/route");
    const response = await PATCH(
      createJsonRequest(
        "/api/v1/cards/card-1",
        "PATCH",
        { risk_level: "extreme" },
        withTestSession(actorInitiator),
      ),
      { params: Promise.resolve({ id: "card-1" }) },
    );
    await expectApiError(response, "VALIDATION_ERROR", 422);
  });

  it("returns 200 with the updated CardResponse for the initiator", async () => {
    queueSelectResults(
      { ...baseCard },
      [{ userId: "user-chain" }],
      { ...baseGoalSpace, initiatorId: "user-init" },
      [],
    );
    captureMutations();
    makeTxHarness({ ...baseCard, title: "New title", updatedAt: "2026-06-20T00:00:00.000Z" });

    const { PATCH } = await import("@/app/api/v1/cards/[id]/route");
    const response = await PATCH(
      createJsonRequest(
        "/api/v1/cards/card-1",
        "PATCH",
        { title: "New title" },
        withTestSession(actorInitiator),
      ),
      { params: Promise.resolve({ id: "card-1" }) },
    );
    const json = await expectApiOk<{ title: string }>(response);
    expect(json.data.title).toBe("New title");
    expectAuditCall(capturedInserts, "card", "update");
    expectRealtimeCall(capturedInserts, "card.updated", "card");
  });
});

// ─── POST /api/v1/cards/:id/assign ─────────────────────────────────

describe("POST /api/v1/cards/:id/assign (F2-05)", () => {
  it("returns 401 without a session", async () => {
    const { POST } = await import("@/app/api/v1/cards/[id]/assign/route");
    const response = await POST(
      createJsonRequest("/api/v1/cards/card-1/assign", "POST", { assigned_to: "user-chain" }),
      { params: Promise.resolve({ id: "card-1" }) },
    );
    await expectApiError(response, "UNAUTHORIZED", 401);
  });

  it("returns 400 when assigned_to is missing", async () => {
    queueSelectResults(
      { ...baseCard },
      [{ userId: "user-chain" }],
      { ...baseGoalSpace, initiatorId: "user-init" },
      [],
    );
    const { POST } = await import("@/app/api/v1/cards/[id]/assign/route");
    const response = await POST(
      createJsonRequest("/api/v1/cards/card-1/assign", "POST", {}, withTestSession(actorInitiator)),
      { params: Promise.resolve({ id: "card-1" }) },
    );
    await expectApiError(response, "INVALID_FIELD", 400);
  });

  it("returns 200 with the assigned CardResponse for the initiator", async () => {
    queueSelectResults(
      { ...baseCard },
      [{ userId: "user-chain" }],
      { ...baseGoalSpace, initiatorId: "user-init" },
      [],
    );
    captureMutations();
    makeTxHarness({ ...baseCard, assignedTo: "user-chain" });

    const { POST } = await import("@/app/api/v1/cards/[id]/assign/route");
    const response = await POST(
      createJsonRequest(
        "/api/v1/cards/card-1/assign",
        "POST",
        { assigned_to: "user-chain" },
        withTestSession(actorInitiator),
      ),
      { params: Promise.resolve({ id: "card-1" }) },
    );
    const json = await expectApiOk<{ assigned_to: string | null }>(response);
    expect(json.data.assigned_to).toBe("user-chain");
    expectAuditCall(capturedInserts, "card", "assign");
    expectRealtimeCall(capturedInserts, "card.assigned", "card");
  });

  it("is idempotent on the same assigned_to (no audit write)", async () => {
    queueSelectResults(
      { ...baseCard, assignedTo: "user-chain" },
      [{ userId: "user-chain" }],
      { ...baseGoalSpace, initiatorId: "user-init" },
      [],
    );
    captureMutations();
    makeTxHarness({ ...baseCard, assignedTo: "user-chain" });

    const { POST } = await import("@/app/api/v1/cards/[id]/assign/route");
    const response = await POST(
      createJsonRequest(
        "/api/v1/cards/card-1/assign",
        "POST",
        { assigned_to: "user-chain" },
        withTestSession(actorInitiator),
      ),
      { params: Promise.resolve({ id: "card-1" }) },
    );
    await expectApiOk(response);
    // No transaction started — service short-circuits.
    expect(mockDb.transaction).not.toHaveBeenCalled();
  });
});

// ─── POST /api/v1/cards/:id/block ──────────────────────────────────

describe("POST /api/v1/cards/:id/block (F2-05)", () => {
  it("returns 401 without a session", async () => {
    const { POST } = await import("@/app/api/v1/cards/[id]/block/route");
    const response = await POST(
      createJsonRequest("/api/v1/cards/card-1/block", "POST", { reason: "stuck" }),
      { params: Promise.resolve({ id: "card-1" }) },
    );
    await expectApiError(response, "UNAUTHORIZED", 401);
  });

  it("returns 422 when reason is missing", async () => {
    queueSelectResults(
      { ...baseCard },
      [{ userId: "user-chain" }],
      { ...baseGoalSpace, initiatorId: "user-init" },
      [],
    );
    const { POST } = await import("@/app/api/v1/cards/[id]/block/route");
    const response = await POST(
      createJsonRequest("/api/v1/cards/card-1/block", "POST", {}, withTestSession(actorInitiator)),
      { params: Promise.resolve({ id: "card-1" }) },
    );
    await expectApiError(response, "VALIDATION_ERROR", 422);
  });

  it("returns 409 STATE_CONFLICT when card is in a terminal state", async () => {
    queueSelectResults(
      { ...baseCard, state: "done" },
      [{ userId: "user-chain" }],
      { ...baseGoalSpace, initiatorId: "user-init" },
      [],
    );
    const { POST } = await import("@/app/api/v1/cards/[id]/block/route");
    const response = await POST(
      createJsonRequest(
        "/api/v1/cards/card-1/block",
        "POST",
        { reason: "stuck" },
        withTestSession(actorInitiator),
      ),
      { params: Promise.resolve({ id: "card-1" }) },
    );
    await expectApiError(response, "STATE_CONFLICT", 409);
  });

  it("returns 200 with the blocked CardResponse and writes state_transitions", async () => {
    queueSelectResults(
      { ...baseCard, state: "todo" },
      [{ userId: "user-chain" }],
      { ...baseGoalSpace, initiatorId: "user-init" },
      [],
    );
    captureMutations();
    makeTxHarness({ ...baseCard, state: "blocked", blockedReason: "stuck" });

    const { POST } = await import("@/app/api/v1/cards/[id]/block/route");
    const response = await POST(
      createJsonRequest(
        "/api/v1/cards/card-1/block",
        "POST",
        { reason: "stuck" },
        withTestSession(actorInitiator),
      ),
      { params: Promise.resolve({ id: "card-1" }) },
    );
    const json = await expectApiOk<{ state: string; blocked_reason: string }>(response);
    expect(json.data.state).toBe("blocked");
    expect(json.data.blocked_reason).toBe("stuck");
    expectAuditCall(capturedInserts, "card", "block");
    expectRealtimeCall(capturedInserts, "card.blocked", "card");
  });
});

// ─── POST /api/v1/cards/:id/unblock ────────────────────────────────

describe("POST /api/v1/cards/:id/unblock (F2-05)", () => {
  it("returns 401 without a session", async () => {
    const { POST } = await import("@/app/api/v1/cards/[id]/unblock/route");
    const response = await POST(
      createJsonRequest("/api/v1/cards/card-1/unblock", "POST", { target_state: "todo" }),
      { params: Promise.resolve({ id: "card-1" }) },
    );
    await expectApiError(response, "UNAUTHORIZED", 401);
  });

  it("returns 422 when target_state is invalid", async () => {
    queueSelectResults(
      { ...baseCard, state: "blocked" },
      [{ userId: "user-chain" }],
      { ...baseGoalSpace, initiatorId: "user-init" },
      [],
    );
    const { POST } = await import("@/app/api/v1/cards/[id]/unblock/route");
    const response = await POST(
      createJsonRequest(
        "/api/v1/cards/card-1/unblock",
        "POST",
        { target_state: "done" },
        withTestSession(actorInitiator),
      ),
      { params: Promise.resolve({ id: "card-1" }) },
    );
    await expectApiError(response, "VALIDATION_ERROR", 422);
  });

  it("returns 409 STATE_CONFLICT when card is not blocked", async () => {
    queueSelectResults(
      { ...baseCard, state: "todo" },
      [{ userId: "user-chain" }],
      { ...baseGoalSpace, initiatorId: "user-init" },
      [],
    );
    const { POST } = await import("@/app/api/v1/cards/[id]/unblock/route");
    const response = await POST(
      createJsonRequest(
        "/api/v1/cards/card-1/unblock",
        "POST",
        { target_state: "todo" },
        withTestSession(actorInitiator),
      ),
      { params: Promise.resolve({ id: "card-1" }) },
    );
    await expectApiError(response, "STATE_CONFLICT", 409);
  });

  it("returns 409 CONFIRMATION_REQUIRED when a pending confirmation exists", async () => {
    queueSelectResults(
      { ...baseCard, state: "blocked" },
      [{ userId: "user-chain" }],
      { ...baseGoalSpace, initiatorId: "user-init" },
      { value: 1 }, // pending confirmation count (single row, .get())
    );
    const { POST } = await import("@/app/api/v1/cards/[id]/unblock/route");
    const response = await POST(
      createJsonRequest(
        "/api/v1/cards/card-1/unblock",
        "POST",
        { target_state: "todo" },
        withTestSession(actorInitiator),
      ),
      { params: Promise.resolve({ id: "card-1" }) },
    );
    await expectApiError(response, "CONFIRMATION_REQUIRED", 409);
  });

  it("returns 200 with the unblocked CardResponse and writes state_transitions", async () => {
    queueSelectResults(
      { ...baseCard, state: "blocked", blockedReason: "stuck" },
      [{ userId: "user-chain" }],
      { ...baseGoalSpace, initiatorId: "user-init" },
      [],
    );
    captureMutations();
    makeTxHarness({ ...baseCard, state: "todo", blockedReason: null, blockedAt: null });

    const { POST } = await import("@/app/api/v1/cards/[id]/unblock/route");
    const response = await POST(
      createJsonRequest(
        "/api/v1/cards/card-1/unblock",
        "POST",
        { target_state: "todo" },
        withTestSession(actorInitiator),
      ),
      { params: Promise.resolve({ id: "card-1" }) },
    );
    const json = await expectApiOk<{ state: string }>(response);
    expect(json.data.state).toBe("todo");
    expectAuditCall(capturedInserts, "card", "unblock");
    expectRealtimeCall(capturedInserts, "card.unblocked", "card");
  });
});

// ─── GET /api/v1/cards/:id/transitions ─────────────────────────────

describe("GET /api/v1/cards/:id/transitions (F2-05)", () => {
  it("returns 401 without a session", async () => {
    const { GET } = await import("@/app/api/v1/cards/[id]/transitions/route");
    const response = await GET(createJsonRequest("/api/v1/cards/card-1/transitions", "GET"), {
      params: Promise.resolve({ id: "card-1" }),
    });
    await expectApiError(response, "UNAUTHORIZED", 401);
  });

  it("returns 200 with the documented StateTransitionResponse[]", async () => {
    queueSelectResults(
      { ...baseCard },
      [{ userId: "user-chain" }],
      { ...baseGoalSpace, initiatorId: "user-init" },
      [],
      [
        {
          id: "t-1",
          cardId: "card-1",
          sessionId: null,
          entityType: "card",
          entityId: "card-1",
          fromState: "backlog",
          toState: "todo",
          trigger: "dependencies_ready",
          actor: "ai_role",
          actorName: "Backlog Refiner",
          actorId: null,
          reason: null,
          metadata: {},
          timestamp: "2026-06-19T00:00:00.000Z",
        },
      ],
    );
    const { GET } = await import("@/app/api/v1/cards/[id]/transitions/route");
    const response = await GET(
      createJsonRequest(
        "/api/v1/cards/card-1/transitions",
        "GET",
        undefined,
        withTestSession(actorInitiator),
      ),
      { params: Promise.resolve({ id: "card-1" }) },
    );
    const json =
      await expectApiOk<Array<{ id: string; from_state: string; to_state: string }>>(response);
    expect(json.data).toHaveLength(1);
    expect(json.data[0]).toMatchObject({ id: "t-1", from_state: "backlog", to_state: "todo" });
  });

  it("returns 404 when the card does not exist", async () => {
    queueSelectResults(null);
    const { GET } = await import("@/app/api/v1/cards/[id]/transitions/route");
    const response = await GET(
      createJsonRequest(
        "/api/v1/cards/card-missing/transitions",
        "GET",
        undefined,
        withTestSession(actorInitiator),
      ),
      { params: Promise.resolve({ id: "card-missing" }) },
    );
    await expectApiError(response, "NOT_FOUND", 404);
  });
});

// ─── Realtime event constants snapshot ─────────────────────────────

describe("CARD_REALTIME_EVENTS snapshot (F2-05 handoff)", () => {
  it("pins the documented event type strings for F2-08 SSE filtering", async () => {
    const { CARD_REALTIME_EVENTS, CARD_AUDIT_ENTITY_TYPE } = await import("@/lib/services/cards");
    expect(CARD_REALTIME_EVENTS).toEqual({
      created: "card.created",
      updated: "card.updated",
      assigned: "card.assigned",
      blocked: "card.blocked",
      unblocked: "card.unblocked",
    });
    expect(CARD_AUDIT_ENTITY_TYPE).toBe("card");
  });
});
