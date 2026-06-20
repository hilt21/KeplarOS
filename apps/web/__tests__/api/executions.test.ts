/**
 * F2-07 Deterministic AI Lane Executor API contract tests (TDD, RED-first).
 *
 * Covers the two documented endpoints in docs/specs/interface_spec.md § 7:
 *   - POST /api/v1/cards/:id/execute
 *   - GET  /api/v1/execute/:taskId
 *
 * Authorization: canExecuteCard (F-003) — viewer rejected, no pending confirmation,
 * card must be in an executable state.
 * State machine: assertTransition (F-002) — only legal (from, to, trigger) tuples.
 * Realtime event types: AGENT_EXECUTION_REALTIME_EVENTS exported constants.
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
const actorViewer: Actor = { id: "user-viewer", role: "viewer" };

const baseCard = {
  id: "card-1",
  goalSpaceId: "gs-1",
  nodeBoardId: "nb-1",
  displayId: "CARD-001",
  title: "Implement login",
  description: null,
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

const baseExecution = {
  id: "task-1",
  goalSpaceId: "gs-1",
  cardId: "card-1",
  sessionId: null,
  agentRole: "Backlog Refiner",
  trigger: "Backlog Refiner",
  status: "completed",
  attempt: 1,
  maxAttempts: 2,
  requestedByType: "human",
  requestedById: "user-init",
  requestedByName: "user-init",
  inputContext: {},
  result: {
    new_state: "todo",
    confidence: 0.85,
    evidence: [],
    message: "Backlog Refiner prepared dependencies and context",
  },
  errorCode: null,
  errorMessage: null,
  durationMs: 0,
  startedAt: "2026-06-19T00:00:00.000Z",
  completedAt: "2026-06-19T00:00:00.000Z",
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

// ─── POST /api/v1/cards/:id/execute ───────────────────────────────

describe("POST /api/v1/cards/:id/execute (F2-07)", () => {
  it("returns 401 without a session", async () => {
    const { POST } = await import("@/app/api/v1/cards/[id]/execute/route");
    const response = await POST(
      createJsonRequest("/api/v1/cards/card-1/execute", "POST", { role: "Backlog Refiner" }),
      { params: Promise.resolve({ id: "card-1" }) },
    );
    await expectApiError(response, "UNAUTHORIZED", 401);
  });

  it("returns 404 when the card does not exist", async () => {
    queueSelectResults(null);
    const { POST } = await import("@/app/api/v1/cards/[id]/execute/route");
    const response = await POST(
      createJsonRequest(
        "/api/v1/cards/card-missing/execute",
        "POST",
        { role: "Backlog Refiner" },
        withTestSession(actorInitiator),
      ),
      { params: Promise.resolve({ id: "card-missing" }) },
    );
    await expectApiError(response, "NOT_FOUND", 404);
  });

  it("returns 403 for a viewer", async () => {
    // getCardContext query order: card, members, goal space, pending count
    queueSelectResults(
      { ...baseCard },
      [{ userId: "user-chain" }],
      { ...baseCard, initiatorId: "user-init", goalSpaceId: "gs-1" },
      [],
    );
    const { POST } = await import("@/app/api/v1/cards/[id]/execute/route");
    const response = await POST(
      createJsonRequest(
        "/api/v1/cards/card-1/execute",
        "POST",
        { role: "Backlog Refiner" },
        withTestSession(actorViewer),
      ),
      { params: Promise.resolve({ id: "card-1" }) },
    );
    await expectApiError(response, "FORBIDDEN", 403);
  });

  it("returns 422 when role is invalid", async () => {
    queueSelectResults(
      { ...baseCard },
      [{ userId: "user-chain" }],
      { ...baseCard, initiatorId: "user-init", goalSpaceId: "gs-1" },
      [],
    );
    const { POST } = await import("@/app/api/v1/cards/[id]/execute/route");
    const response = await POST(
      createJsonRequest(
        "/api/v1/cards/card-1/execute",
        "POST",
        { role: "Unknown Role" },
        withTestSession(actorInitiator),
      ),
      { params: Promise.resolve({ id: "card-1" }) },
    );
    await expectApiError(response, "VALIDATION_ERROR", 422);
  });

  it("returns 409 STATE_CONFLICT when card is in a terminal state", async () => {
    queueSelectResults(
      { ...baseCard, state: "done" },
      [{ userId: "user-chain" }],
      { ...baseCard, initiatorId: "user-init", goalSpaceId: "gs-1" },
      [],
    );
    const { POST } = await import("@/app/api/v1/cards/[id]/execute/route");
    const response = await POST(
      createJsonRequest(
        "/api/v1/cards/card-1/execute",
        "POST",
        { role: "Backlog Refiner" },
        withTestSession(actorInitiator),
      ),
      { params: Promise.resolve({ id: "card-1" }) },
    );
    await expectApiError(response, "STATE_CONFLICT", 409);
  });

  it("returns 202 with task_id for a Backlog Refiner on a backlog card", async () => {
    queueSelectResults(
      { ...baseCard, state: "backlog" },
      [{ userId: "user-chain" }],
      { ...baseCard, initiatorId: "user-init", goalSpaceId: "gs-1" },
      [],
    );
    captureMutations();
    makeTxHarness({ ...baseExecution });

    const { POST } = await import("@/app/api/v1/cards/[id]/execute/route");
    const response = await POST(
      createJsonRequest(
        "/api/v1/cards/card-1/execute",
        "POST",
        { role: "Backlog Refiner" },
        withTestSession(actorInitiator),
      ),
      { params: Promise.resolve({ id: "card-1" }) },
    );
    const json = await expectApiOk<{
      task_id: string;
      status: string;
      role: string;
      card_id: string;
      polling_url: string;
    }>(response);
    expect(json.data).toMatchObject({
      status: "queued",
      role: "Backlog Refiner",
      card_id: "card-1",
    });
    expect(typeof json.data.task_id).toBe("string");
    expect(json.data.task_id.length).toBeGreaterThan(0);
    expect(json.data.polling_url).toContain(json.data.task_id);
    expectAuditCall(capturedInserts, "agent_execution", "execute");
    expectRealtimeCall(capturedInserts, "agent_execution.queued", "agent_execution");
    expectStateTransitionCall(capturedInserts, "dependencies_ready", "todo");
  });

  it("returns 202 with task_id for a Review Guard on a high-risk card", async () => {
    queueSelectResults(
      { ...baseCard, state: "review", riskLevel: "high" },
      [{ userId: "user-chain" }],
      { ...baseCard, initiatorId: "user-init", goalSpaceId: "gs-1" },
      [],
    );
    captureMutations();
    makeTxHarness({
      ...baseExecution,
      status: "needs_confirmation",
      agentRole: "Review Guard",
      result: {
        new_state: null,
        confidence: 0.6,
        evidence: [],
        message: "Review Guard flagged output as high risk",
      },
    });

    const { POST } = await import("@/app/api/v1/cards/[id]/execute/route");
    const response = await POST(
      createJsonRequest(
        "/api/v1/cards/card-1/execute",
        "POST",
        { role: "Review Guard" },
        withTestSession(actorInitiator),
      ),
      { params: Promise.resolve({ id: "card-1" }) },
    );
    const json = await expectApiOk<{ task_id: string; status: string; role: string }>(response);
    expect(json.data.role).toBe("Review Guard");
    expect(typeof json.data.task_id).toBe("string");
    expectAuditCall(capturedInserts, "agent_execution", "execute");
    // No state transition on needs_confirmation.
  });
});

// ─── GET /api/v1/execute/:taskId ───────────────────────────────────

describe("GET /api/v1/execute/:taskId (F2-07)", () => {
  it("returns 401 without a session", async () => {
    const { GET } = await import("@/app/api/v1/execute/[taskId]/route");
    const response = await GET(createJsonRequest("/api/v1/execute/task-1", "GET"), {
      params: Promise.resolve({ taskId: "task-1" }),
    });
    await expectApiError(response, "UNAUTHORIZED", 401);
  });

  it("returns 404 when the task does not exist", async () => {
    queueSelectResults(null);
    const { GET } = await import("@/app/api/v1/execute/[taskId]/route");
    const response = await GET(
      createJsonRequest(
        "/api/v1/execute/task-missing",
        "GET",
        undefined,
        withTestSession(actorInitiator),
      ),
      { params: Promise.resolve({ taskId: "task-missing" }) },
    );
    await expectApiError(response, "NOT_FOUND", 404);
  });

  it("returns 200 with the documented ExecuteStatusResponse", async () => {
    // Query order in getExecutionStatusService:
    //   1. agent_executions row
    //   2. card context (getCardContext: card, members, goal space, pending count)
    queueSelectResults(
      { ...baseExecution },
      { ...baseCard },
      [{ userId: "user-chain" }],
      { ...baseCard, initiatorId: "user-init", goalSpaceId: "gs-1" },
      [],
    );
    const { GET } = await import("@/app/api/v1/execute/[taskId]/route");
    const response = await GET(
      createJsonRequest(
        "/api/v1/execute/task-1",
        "GET",
        undefined,
        withTestSession(actorInitiator),
      ),
      { params: Promise.resolve({ taskId: "task-1" }) },
    );
    const json = await expectApiOk<{
      task_id: string;
      card_id: string;
      role: string;
      status: string;
      attempt: number;
      max_attempts: number;
      result?: { new_state?: string; confidence?: number; message: string };
      started_at: string;
    }>(response);
    expect(json.data).toMatchObject({
      task_id: "task-1",
      card_id: "card-1",
      role: "Backlog Refiner",
      status: "completed",
      attempt: 1,
      max_attempts: 2,
    });
    expect(json.data.result?.new_state).toBe("todo");
    expect(json.data.result?.confidence).toBe(0.85);
  });

  it("returns 403 for a non-readable card", async () => {
    queueSelectResults(
      { ...baseExecution },
      { ...baseCard, goalSpaceId: "gs-2" },
      [{ userId: "user-stranger" }],
      { initiatorId: "user-init-2", goalSpaceId: "gs-2" },
      [],
    );
    const { GET } = await import("@/app/api/v1/execute/[taskId]/route");
    const response = await GET(
      createJsonRequest(
        "/api/v1/execute/task-1",
        "GET",
        undefined,
        withTestSession(actorChainUser),
      ),
      { params: Promise.resolve({ taskId: "task-1" }) },
    );
    await expectApiError(response, "FORBIDDEN", 403);
  });
});

// ─── Realtime event constants snapshot ─────────────────────────────

describe("AGENT_EXECUTION_REALTIME_EVENTS snapshot (F2-07 handoff)", () => {
  it("pins the documented event type strings for F2-08 SSE filtering", async () => {
    const { AGENT_EXECUTION_REALTIME_EVENTS, AGENT_EXECUTION_AUDIT_ENTITY_TYPE } =
      await import("@/lib/services/executions");
    expect(AGENT_EXECUTION_REALTIME_EVENTS).toEqual({
      queued: "agent_execution.queued",
      completed: "agent_execution.completed",
      failed: "agent_execution.failed",
      needsConfirmation: "agent_execution.needs_confirmation",
    });
    expect(AGENT_EXECUTION_AUDIT_ENTITY_TYPE).toBe("agent_execution");
  });
});
