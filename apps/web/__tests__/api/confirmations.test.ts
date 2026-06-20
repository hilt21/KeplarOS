/**
 * F2-06 Human Confirmation API contract tests (TDD, RED-first).
 *
 * Covers the two documented endpoints in docs/specs/interface_spec.md § 6:
 *   - GET    /api/v1/confirmations?status=pending
 *   - POST   /api/v1/confirmations/:id/decide
 *
 * Authorization: canDecideConfirmation (F-003) — initiator only, pending only.
 * State machine: assertTransition with human_confirm / human_reject triggers.
 * Realtime event types: HUMAN_CONFIRMATION_REALTIME_EVENTS exported constants.
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

const capturedInserts: Array<{ table: string; values: Record<string, unknown> }> = [];

function captureMutations(): void {
  mockDb.update.mockImplementation((_table: unknown) => ({
    set: (_values: Record<string, unknown>) => ({
      where: (_where: unknown) => ({
        run: () => undefined,
        returning: () => ({ get: () => ({}) }),
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

function makeTxHarness(updatedRow: Record<string, unknown>): void {
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
          returning: () => ({ get: () => ({ ...updatedRow }) }),
          run: () => {
            capturedInserts.push({ table: "table", values });
          },
        }),
      }),
      update: (_table: unknown) => ({
        set: (_values: Record<string, unknown>) => ({
          where: (_where: unknown) => ({
            run: () => undefined,
            returning: () => ({ get: () => ({ ...updatedRow }) }),
          }),
        }),
      }),
    };
    return fn(mockTx);
  });
}

const actorInitiator: Actor = { id: "user-init", role: "initiator" };
const actorChainUser: Actor = { id: "user-chain", role: "chain_user" };

const baseConfirmation = {
  id: "conf-1",
  cardId: "card-1",
  triggerType: "high_risk",
  targetState: "todo",
  triggerReason: "AI marked output high risk",
  triggeredBy: "ai-role",
  triggeredAt: "2026-06-19T00:00:00.000Z",
  aiSummary: "Output touches external system",
  riskFactors: [],
  recommendations: [],
  aiConfidence: 0.45,
  riskLevel: "high",
  context: {},
  status: "pending",
  decisionOutcome: null,
  decisionBy: null,
  decisionReason: null,
  decisionComment: null,
  decidedAt: null,
  resolvedAt: null,
  expiresAt: "2026-06-26T00:00:00.000Z",
  createdAt: "2026-06-19T00:00:00.000Z",
  updatedAt: "2026-06-19T00:00:00.000Z",
};

const baseCard = {
  id: "card-1",
  goalSpaceId: "gs-1",
  nodeBoardId: "nb-1",
  displayId: "CARD-001",
  title: "Implement login",
  description: null,
  state: "dev",
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

function expectStateTransitionCall(
  captured: Array<{ values: Record<string, unknown> }>,
  trigger: string,
  toState: string,
): void {
  const call = captured.find(
    (c) =>
      c.values &&
      (c.values as Record<string, unknown>).trigger === trigger &&
      (c.values as Record<string, unknown>).toState === toState,
  );
  expect(call).toBeDefined();
}

beforeEach(() => {
  vi.clearAllMocks();
  capturedInserts.length = 0;
  resetEnv();
});
afterEach(() => vi.restoreAllMocks());

// ─── GET /api/v1/confirmations ──────────────────────────────────────

describe("GET /api/v1/confirmations (F2-06)", () => {
  it("returns 401 without a session", async () => {
    const { GET } = await import("@/app/api/v1/confirmations/route");
    const response = await GET(createJsonRequest("/api/v1/confirmations?status=pending", "GET"), {
      params: Promise.resolve({}),
    });
    await expectApiError(response, "UNAUTHORIZED", 401);
  });

  it("returns 200 with the pending confirmations for the initiator", async () => {
    // listConfirmationsForActor: 1 query (join).
    queueSelectResults([
      {
        ...baseConfirmation,
        cardTitle: baseCard.title,
      },
    ]);
    const { GET } = await import("@/app/api/v1/confirmations/route");
    const response = await GET(
      createJsonRequest(
        "/api/v1/confirmations?status=pending",
        "GET",
        undefined,
        withTestSession(actorInitiator),
      ),
      { params: Promise.resolve({}) },
    );
    const json = await expectApiOk<{
      items: Array<{ id: string; card_title: string; status: string; decision?: unknown }>;
      total: number;
    }>(response);
    expect(json.data.items).toHaveLength(1);
    expect(json.data.items[0]).toMatchObject({
      id: "conf-1",
      card_title: "Implement login",
      status: "pending",
    });
    expect(json.data.items[0]!.decision).toBeUndefined();
    expect(json.data.total).toBe(1);
  });

  it("returns 400 when status is invalid", async () => {
    const { GET } = await import("@/app/api/v1/confirmations/route");
    const response = await GET(
      createJsonRequest(
        "/api/v1/confirmations?status=foo",
        "GET",
        undefined,
        withTestSession(actorInitiator),
      ),
      { params: Promise.resolve({}) },
    );
    await expectApiError(response, "INVALID_FIELD", 400);
  });
});

// ─── POST /api/v1/confirmations/:id/decide ─────────────────────────

describe("POST /api/v1/confirmations/:id/decide (F2-06)", () => {
  it("returns 401 without a session", async () => {
    const { POST } = await import("@/app/api/v1/confirmations/[id]/decide/route");
    const response = await POST(
      createJsonRequest("/api/v1/confirmations/conf-1/decide", "POST", { outcome: "approved" }),
      { params: Promise.resolve({ id: "conf-1" }) },
    );
    await expectApiError(response, "UNAUTHORIZED", 401);
  });

  it("returns 404 when the confirmation does not exist", async () => {
    queueSelectResults(null);
    const { POST } = await import("@/app/api/v1/confirmations/[id]/decide/route");
    const response = await POST(
      createJsonRequest(
        "/api/v1/confirmations/conf-missing/decide",
        "POST",
        { outcome: "approved" },
        withTestSession(actorInitiator),
      ),
      { params: Promise.resolve({ id: "conf-missing" }) },
    );
    await expectApiError(response, "NOT_FOUND", 404);
  });

  it("returns 403 when a non-initiator tries to decide", async () => {
    // getConfirmationContext: 1 query (confirmation + card + goal space joined).
    queueSelectResults({
      ...baseConfirmation,
      cardTitle: baseCard.title,
      goalSpaceInitiatorId: "user-init",
      memberIds: ["user-chain"],
      cardState: baseCard.state,
    });
    const { POST } = await import("@/app/api/v1/confirmations/[id]/decide/route");
    const response = await POST(
      createJsonRequest(
        "/api/v1/confirmations/conf-1/decide",
        "POST",
        { outcome: "approved" },
        withTestSession(actorChainUser),
      ),
      { params: Promise.resolve({ id: "conf-1" }) },
    );
    await expectApiError(response, "FORBIDDEN", 403);
  });

  it("returns 409 STATE_CONFLICT when the confirmation is already decided", async () => {
    queueSelectResults({
      ...baseConfirmation,
      status: "approved",
      cardTitle: baseCard.title,
      goalSpaceInitiatorId: "user-init",
      memberIds: [],
      cardState: baseCard.state,
    });
    const { POST } = await import("@/app/api/v1/confirmations/[id]/decide/route");
    const response = await POST(
      createJsonRequest(
        "/api/v1/confirmations/conf-1/decide",
        "POST",
        { outcome: "rejected", reason: "x" },
        withTestSession(actorInitiator),
      ),
      { params: Promise.resolve({ id: "conf-1" }) },
    );
    await expectApiError(response, "STATE_CONFLICT", 409);
  });

  it("returns 422 when outcome is invalid", async () => {
    queueSelectResults({
      ...baseConfirmation,
      cardTitle: baseCard.title,
      goalSpaceInitiatorId: "user-init",
      memberIds: [],
      cardState: baseCard.state,
    });
    const { POST } = await import("@/app/api/v1/confirmations/[id]/decide/route");
    const response = await POST(
      createJsonRequest(
        "/api/v1/confirmations/conf-1/decide",
        "POST",
        { outcome: "maybe" },
        withTestSession(actorInitiator),
      ),
      { params: Promise.resolve({ id: "conf-1" }) },
    );
    await expectApiError(response, "VALIDATION_ERROR", 422);
  });

  it("returns 422 when reason is missing on reject", async () => {
    queueSelectResults({
      ...baseConfirmation,
      cardTitle: baseCard.title,
      goalSpaceInitiatorId: "user-init",
      memberIds: [],
      cardState: baseCard.state,
    });
    const { POST } = await import("@/app/api/v1/confirmations/[id]/decide/route");
    const response = await POST(
      createJsonRequest(
        "/api/v1/confirmations/conf-1/decide",
        "POST",
        { outcome: "rejected" },
        withTestSession(actorInitiator),
      ),
      { params: Promise.resolve({ id: "conf-1" }) },
    );
    await expectApiError(response, "VALIDATION_ERROR", 422);
  });

  it("returns 409 STATE_CONFLICT when target_state is unreachable from current state", async () => {
    // Card is in 'done' (terminal). target_state is 'todo'.
    queueSelectResults({
      ...baseConfirmation,
      targetState: "todo",
      cardTitle: baseCard.title,
      goalSpaceInitiatorId: "user-init",
      memberIds: [],
      cardState: "done",
    });
    const { POST } = await import("@/app/api/v1/confirmations/[id]/decide/route");
    const response = await POST(
      createJsonRequest(
        "/api/v1/confirmations/conf-1/decide",
        "POST",
        { outcome: "approved" },
        withTestSession(actorInitiator),
      ),
      { params: Promise.resolve({ id: "conf-1" }) },
    );
    await expectApiError(response, "STATE_CONFLICT", 409);
  });

  it("returns 200 with card_state_changed on approve (with target_state)", async () => {
    queueSelectResults({
      ...baseConfirmation,
      targetState: "todo",
      cardTitle: baseCard.title,
      goalSpaceInitiatorId: "user-init",
      memberIds: [],
      cardState: "dev",
    });
    captureMutations();
    makeTxHarness({ ...baseConfirmation, status: "approved", decisionOutcome: "approved" });

    const { POST } = await import("@/app/api/v1/confirmations/[id]/decide/route");
    const response = await POST(
      createJsonRequest(
        "/api/v1/confirmations/conf-1/decide",
        "POST",
        { outcome: "approved", comment: "looks good" },
        withTestSession(actorInitiator),
      ),
      { params: Promise.resolve({ id: "conf-1" }) },
    );
    const json = await expectApiOk<{
      id: string;
      status: string;
      card_state_changed: boolean;
      new_card_state?: string;
    }>(response);
    expect(json.data).toMatchObject({
      id: "conf-1",
      status: "approved",
      card_state_changed: true,
      new_card_state: "todo",
    });
    expectAuditCall(capturedInserts, "confirm", "approve");
    expectRealtimeCall(capturedInserts, "human_confirmation.approved", "confirmation");
    expectStateTransitionCall(capturedInserts, "human_confirm", "todo");
  });

  it("returns 200 with card_state_changed on reject", async () => {
    queueSelectResults({
      ...baseConfirmation,
      targetState: "todo",
      cardTitle: baseCard.title,
      goalSpaceInitiatorId: "user-init",
      memberIds: [],
      cardState: "dev",
    });
    captureMutations();
    makeTxHarness({ ...baseConfirmation, status: "rejected", decisionOutcome: "rejected" });

    const { POST } = await import("@/app/api/v1/confirmations/[id]/decide/route");
    const response = await POST(
      createJsonRequest(
        "/api/v1/confirmations/conf-1/decide",
        "POST",
        { outcome: "rejected", reason: "insufficient evidence" },
        withTestSession(actorInitiator),
      ),
      { params: Promise.resolve({ id: "conf-1" }) },
    );
    const json = await expectApiOk<{
      id: string;
      status: string;
      card_state_changed: boolean;
      new_card_state?: string;
    }>(response);
    expect(json.data).toMatchObject({
      id: "conf-1",
      status: "rejected",
      card_state_changed: true,
      new_card_state: "blocked",
    });
    expectAuditCall(capturedInserts, "confirm", "reject");
    expectRealtimeCall(capturedInserts, "human_confirmation.rejected", "confirmation");
    expectStateTransitionCall(capturedInserts, "human_reject", "blocked");
  });

  it("returns 200 with card_state_changed=false on approve without target_state", async () => {
    queueSelectResults({
      ...baseConfirmation,
      targetState: null,
      cardTitle: baseCard.title,
      goalSpaceInitiatorId: "user-init",
      memberIds: [],
      cardState: "dev",
    });
    captureMutations();
    makeTxHarness({
      ...baseConfirmation,
      status: "approved",
      decisionOutcome: "approved",
      targetState: null,
    });

    const { POST } = await import("@/app/api/v1/confirmations/[id]/decide/route");
    const response = await POST(
      createJsonRequest(
        "/api/v1/confirmations/conf-1/decide",
        "POST",
        { outcome: "approved" },
        withTestSession(actorInitiator),
      ),
      { params: Promise.resolve({ id: "conf-1" }) },
    );
    const json = await expectApiOk<{ card_state_changed: boolean; new_card_state?: string }>(
      response,
    );
    expect(json.data.card_state_changed).toBe(false);
    expect(json.data.new_card_state).toBeUndefined();
  });
});

// ─── Realtime event constants snapshot ─────────────────────────────

describe("HUMAN_CONFIRMATION_REALTIME_EVENTS snapshot (F2-06 handoff)", () => {
  it("pins the documented event type strings for F2-08 SSE filtering", async () => {
    const { HUMAN_CONFIRMATION_REALTIME_EVENTS, HUMAN_CONFIRMATION_AUDIT_ENTITY_TYPE } =
      await import("@/lib/services/confirmations");
    expect(HUMAN_CONFIRMATION_REALTIME_EVENTS).toEqual({
      approved: "human_confirmation.approved",
      rejected: "human_confirmation.rejected",
    });
    expect(HUMAN_CONFIRMATION_AUDIT_ENTITY_TYPE).toBe("confirm");
  });
});
