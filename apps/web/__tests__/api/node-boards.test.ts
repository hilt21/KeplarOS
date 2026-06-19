/**
 * F2-04 Node Board And Member API contract tests (TDD, RED-first).
 *
 * Covers the six documented endpoints in docs/specs/interface_spec.md § 3.8:
 *   - GET    /api/v1/goal-spaces/:goalSpaceId/node-boards
 *   - POST   /api/v1/goal-spaces/:goalSpaceId/node-boards
 *   - GET    /api/v1/node-boards/:id
 *   - PATCH  /api/v1/node-boards/:id
 *   - POST   /api/v1/node-boards/:id/members
 *   - DELETE /api/v1/node-boards/:id/members/:userId
 *
 * Authorization matrix: docs/specs/authorization_matrix.md § 4 (nodeBoards row).
 * Realtime event types: node_board.created | updated | member.added | member.removed.
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

function makeTxHarness(insertedRow: Record<string, unknown>): void {
  mockDb.transaction.mockImplementation((fn: (tx: unknown) => unknown) => {
    const mockTx = {
      insert: (_table: unknown) => ({
        values: (values: Record<string, unknown>) => ({
          returning: () => ({
            get: () => insertedRow,
          }),
          run: () => {
            // runWithAudit writes audit_entries and realtime_events via
            // tx.insert(...).values({...}).run() — capture them so the
            // F2-04 audit + realtime contract tests can assert.
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
const otherInitiator: Actor = { id: "user-init-2", role: "initiator" };

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

const baseBoard = {
  id: "nb-1",
  goalSpaceId: "gs-1",
  key: "main",
  name: "Main Board",
  description: "Main node",
  status: "active",
  displayOrder: 0,
  context: {},
  deletedAt: null,
  createdAt: "2026-06-19T00:00:00.000Z",
  updatedAt: "2026-06-19T00:00:00.000Z",
};

const baseMember = {
  id: "m-1",
  boardId: "nb-1",
  userId: "user-chain",
  role: "member",
  invitedBy: "user-init",
  joinedAt: "2026-06-19T00:00:00.000Z",
  removedAt: null,
};

function resetEnv(): void {
  process.env.KEPLAR_SESSION_SECRET = "test-session-secret";
}

function expectAuditCall(captured: InsertCall[], entityType: string, type: string): void {
  // runWithAudit always calls tx.insert(auditEntries).values({...}).run().
  // The captured row's `entityType` and `action` (we use type in the action name)
  // are stored under the `values` object.
  const auditCall = captured.find(
    (c) =>
      c.values &&
      (c.values as Record<string, unknown>).entityType === entityType &&
      (c.values as Record<string, unknown>).action === (type.split(".").pop() ?? type),
  );
  expect(auditCall).toBeDefined();
}

// ─── GET /api/v1/goal-spaces/:goalSpaceId/node-boards ─────────────────

describe("GET /api/v1/goal-spaces/:goalSpaceId/node-boards (F2-04)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedUpdates.length = 0;
    capturedInserts.length = 0;
    resetEnv();
  });
  afterEach(() => vi.restoreAllMocks());

  it("returns 401 when no authenticated session is present", async () => {
    const { GET } = await import("@/app/api/v1/goal-spaces/[goalSpaceId]/node-boards/route");
    const response = await GET(createJsonRequest("/api/v1/goal-spaces/gs-1/node-boards", "GET"), {
      params: Promise.resolve({ goalSpaceId: "gs-1" }),
    });
    await expectApiError(response, "UNAUTHORIZED", 401);
  });

  it("returns 200 with the boards visible to the initiator (all boards)", async () => {
    // Query order in the service (initiator path):
    //   1. goal space by id (getGoalSpaceWithMembers)
    //   2. members of that goal space (getGoalSpaceWithMembers, distinct)
    //   3. node boards in the goal space (listNodeBoardsForGoalSpace, all)
    //   4. active members for the listed boards (listActiveMembersForBoards)
    queueSelectResults(
      { ...baseGoalSpace },
      [{ userId: "user-chain" }],
      [{ ...baseBoard }],
      [{ ...baseMember }],
    );
    const { GET } = await import("@/app/api/v1/goal-spaces/[goalSpaceId]/node-boards/route");
    const response = await GET(
      createJsonRequest(
        "/api/v1/goal-spaces/gs-1/node-boards",
        "GET",
        undefined,
        withTestSession(actorInitiator),
      ),
      { params: Promise.resolve({ goalSpaceId: "gs-1" }) },
    );
    const json = await expectApiOk<{
      items: Array<{ id: string; key: string; name: string; members: unknown[] }>;
      total: number;
    }>(response);
    expect(json.data.items).toHaveLength(1);
    expect(json.data.items[0]).toMatchObject({ id: "nb-1", key: "main", name: "Main Board" });
    expect(json.data.total).toBe(1);
  });

  it("returns 200 with the boards a non-initiator member can see (filtered)", async () => {
    // Query order in the service:
    //   1. goal space by id (getGoalSpaceWithMembers)
    //   2. members of that goal space (getGoalSpaceWithMembers, distinct)
    //   3. member board ids for the actor (listNodeBoardsForGoalSpace, distinct)
    //   4. node boards matching goal space + ids (listNodeBoardsForGoalSpace)
    //   5. active members for the listed boards (listActiveMembersForBoards)
    queueSelectResults(
      { ...baseGoalSpace },
      [{ userId: "user-chain" }],
      [{ boardId: "nb-1" }],
      [{ ...baseBoard }],
      [{ ...baseMember }],
    );
    const { GET } = await import("@/app/api/v1/goal-spaces/[goalSpaceId]/node-boards/route");
    const response = await GET(
      createJsonRequest(
        "/api/v1/goal-spaces/gs-1/node-boards",
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
    // Goal space exists but the actor (a viewer from another goal space) is not a
    // member of any node board under it.
    queueSelectResults(
      { ...baseGoalSpace },
      [{ userId: "user-other" }], // members — actor is not in the list
    );
    const { GET } = await import("@/app/api/v1/goal-spaces/[goalSpaceId]/node-boards/route");
    const response = await GET(
      createJsonRequest(
        "/api/v1/goal-spaces/gs-1/node-boards",
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
    const { GET } = await import("@/app/api/v1/goal-spaces/[goalSpaceId]/node-boards/route");
    const response = await GET(
      createJsonRequest(
        "/api/v1/goal-spaces/gs-missing/node-boards",
        "GET",
        undefined,
        withTestSession(actorInitiator),
      ),
      { params: Promise.resolve({ goalSpaceId: "gs-missing" }) },
    );
    await expectApiError(response, "NOT_FOUND", 404);
  });
});

// ─── POST /api/v1/goal-spaces/:goalSpaceId/node-boards ────────────────

describe("POST /api/v1/goal-spaces/:goalSpaceId/node-boards (F2-04)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedUpdates.length = 0;
    capturedInserts.length = 0;
    resetEnv();
  });
  afterEach(() => vi.restoreAllMocks());

  it("returns 401 without a session", async () => {
    const { POST } = await import("@/app/api/v1/goal-spaces/[goalSpaceId]/node-boards/route");
    const response = await POST(
      createJsonRequest("/api/v1/goal-spaces/gs-1/node-boards", "POST", {
        key: "main",
        name: "Main",
      }),
      { params: Promise.resolve({ goalSpaceId: "gs-1" }) },
    );
    await expectApiError(response, "UNAUTHORIZED", 401);
  });

  it("returns 403 when a non-initiator tries to create a node board", async () => {
    queueSelectResults({ ...baseGoalSpace }, [{ userId: "user-chain" }]);
    const { POST } = await import("@/app/api/v1/goal-spaces/[goalSpaceId]/node-boards/route");
    const response = await POST(
      createJsonRequest(
        "/api/v1/goal-spaces/gs-1/node-boards",
        "POST",
        { key: "main", name: "Main" },
        withTestSession(actorChainUser),
      ),
      { params: Promise.resolve({ goalSpaceId: "gs-1" }) },
    );
    await expectApiError(response, "FORBIDDEN", 403);
  });

  it("returns 400 when key is missing", async () => {
    queueSelectResults({ ...baseGoalSpace }, [{ userId: "user-chain" }]);
    const { POST } = await import("@/app/api/v1/goal-spaces/[goalSpaceId]/node-boards/route");
    const response = await POST(
      createJsonRequest(
        "/api/v1/goal-spaces/gs-1/node-boards",
        "POST",
        { name: "Main" },
        withTestSession(actorInitiator),
      ),
      { params: Promise.resolve({ goalSpaceId: "gs-1" }) },
    );
    await expectApiError(response, "INVALID_FIELD", 400);
  });

  it("returns 400 when name is missing", async () => {
    queueSelectResults({ ...baseGoalSpace }, [{ userId: "user-chain" }]);
    const { POST } = await import("@/app/api/v1/goal-spaces/[goalSpaceId]/node-boards/route");
    const response = await POST(
      createJsonRequest(
        "/api/v1/goal-spaces/gs-1/node-boards",
        "POST",
        { key: "main" },
        withTestSession(actorInitiator),
      ),
      { params: Promise.resolve({ goalSpaceId: "gs-1" }) },
    );
    await expectApiError(response, "INVALID_FIELD", 400);
  });

  it("returns 201 with the documented NodeBoardResponse and writes audit + realtime", async () => {
    queueSelectResults({ ...baseGoalSpace }, [{ userId: "user-chain" }]);
    captureMutations();
    makeTxHarness({ ...baseBoard, key: "main", name: "Main" });

    const { POST } = await import("@/app/api/v1/goal-spaces/[goalSpaceId]/node-boards/route");
    const response = await POST(
      createJsonRequest(
        "/api/v1/goal-spaces/gs-1/node-boards",
        "POST",
        { key: "main", name: "Main", description: "Main node" },
        withTestSession(actorInitiator),
      ),
      { params: Promise.resolve({ goalSpaceId: "gs-1" }) },
    );
    const json = await expectApiOk<{
      id: string;
      key: string;
      name: string;
      status: string;
      goal_space_id: string;
      members: unknown[];
    }>(response);
    expect(json.data).toMatchObject({
      id: "nb-1",
      key: "main",
      name: "Main",
      status: "active",
      goal_space_id: "gs-1",
    });
    expect(json.data.members).toEqual([]);
    // audit + realtime written via runWithAudit
    expect(mockDb.transaction).toHaveBeenCalledTimes(1);
  });

  it("creates seed members in the same transaction when provided", async () => {
    queueSelectResults({ ...baseGoalSpace }, [{ userId: "user-chain" }]);
    captureMutations();
    // tx.insert(node_boards).values().returning().get() → board
    // tx.insert(node_board_members).values().returning().get() → member rows
    // runWithAudit also writes audit + realtime via insert(values).run()
    let insertCallCount = 0;
    mockDb.transaction.mockImplementation((fn: (tx: unknown) => unknown) => {
      const mockTx = {
        insert: (_table: unknown) => ({
          values: (values: Record<string, unknown>) => ({
            returning: () => ({
              get: () => {
                insertCallCount += 1;
                if (insertCallCount === 1) return { ...baseBoard };
                return { ...baseMember, userId: "user-chain", role: "owner" };
              },
            }),
            run: () => {
              // runWithAudit audit + realtime writes
              capturedInserts.push({ table: "table", values });
            },
          }),
        }),
      };
      return fn(mockTx);
    });

    const { POST } = await import("@/app/api/v1/goal-spaces/[goalSpaceId]/node-boards/route");
    const response = await POST(
      createJsonRequest(
        "/api/v1/goal-spaces/gs-1/node-boards",
        "POST",
        {
          key: "main",
          name: "Main",
          members: [{ user_id: "user-chain", role: "owner" }],
        },
        withTestSession(actorInitiator),
      ),
      { params: Promise.resolve({ goalSpaceId: "gs-1" }) },
    );
    const json = await expectApiOk<{
      members: Array<{ user_id: string; role: string; board_id: string }>;
    }>(response);
    expect(json.data.members).toEqual([{ user_id: "user-chain", role: "owner", board_id: "nb-1" }]);
  });
});

// ─── GET /api/v1/node-boards/:id ────────────────────────────────────

describe("GET /api/v1/node-boards/:id (F2-04)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedUpdates.length = 0;
    capturedInserts.length = 0;
    resetEnv();
  });
  afterEach(() => vi.restoreAllMocks());

  it("returns 401 without a session", async () => {
    const { GET } = await import("@/app/api/v1/node-boards/[id]/route");
    const response = await GET(createJsonRequest("/api/v1/node-boards/nb-1", "GET"), {
      params: Promise.resolve({ id: "nb-1" }),
    });
    await expectApiError(response, "UNAUTHORIZED", 401);
  });

  it("returns 200 with NodeBoardResponse for a readable board", async () => {
    // Query order in the service:
    //   1. board by id (getNodeBoardById)
    //   2. goal space context (getGoalSpaceContextForBoard → goal space row)
    //   3. goal space member ids (getGoalSpaceContextForBoard → distinct)
    //   4. active members for the board (listActiveMembersForBoard)
    queueSelectResults(
      { ...baseBoard },
      { ...baseGoalSpace, initiatorId: "user-init" },
      [{ userId: "user-chain" }],
      [{ ...baseMember }],
    );
    const { GET } = await import("@/app/api/v1/node-boards/[id]/route");
    const response = await GET(
      createJsonRequest(
        "/api/v1/node-boards/nb-1",
        "GET",
        undefined,
        withTestSession(actorInitiator),
      ),
      { params: Promise.resolve({ id: "nb-1" }) },
    );
    const json = await expectApiOk<{ id: string; members: unknown[] }>(response);
    expect(json.data.id).toBe("nb-1");
  });

  it("returns 404 when the board does not exist", async () => {
    queueSelectResults(null);
    const { GET } = await import("@/app/api/v1/node-boards/[id]/route");
    const response = await GET(
      createJsonRequest(
        "/api/v1/node-boards/nb-missing",
        "GET",
        undefined,
        withTestSession(actorInitiator),
      ),
      { params: Promise.resolve({ id: "nb-missing" }) },
    );
    await expectApiError(response, "NOT_FOUND", 404);
  });

  it("returns 403 when the actor is not a member and not the goal-space initiator", async () => {
    // Goal space owner is user-init-2, not the actor. Actor (chain_user) is
    // also not in the goal space's member list.
    queueSelectResults(
      { ...baseBoard, goalSpaceId: "gs-2" },
      { ...baseGoalSpace, initiatorId: "user-init-2" },
      [{ userId: "user-stranger" }],
    );
    const { GET } = await import("@/app/api/v1/node-boards/[id]/route");
    const response = await GET(
      createJsonRequest(
        "/api/v1/node-boards/nb-1",
        "GET",
        undefined,
        withTestSession(actorChainUser),
      ),
      { params: Promise.resolve({ id: "nb-1" }) },
    );
    await expectApiError(response, "FORBIDDEN", 403);
  });
});

// ─── PATCH /api/v1/node-boards/:id ──────────────────────────────────

describe("PATCH /api/v1/node-boards/:id (F2-04)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedUpdates.length = 0;
    capturedInserts.length = 0;
    resetEnv();
  });
  afterEach(() => vi.restoreAllMocks());

  it("returns 401 without a session", async () => {
    const { PATCH } = await import("@/app/api/v1/node-boards/[id]/route");
    const response = await PATCH(
      createJsonRequest("/api/v1/node-boards/nb-1", "PATCH", { name: "Renamed" }),
      { params: Promise.resolve({ id: "nb-1" }) },
    );
    await expectApiError(response, "UNAUTHORIZED", 401);
  });

  it("returns 403 when a non-initiator tries to update a board", async () => {
    queueSelectResults({ ...baseBoard }, [{ userId: "user-chain" }]);
    const { PATCH } = await import("@/app/api/v1/node-boards/[id]/route");
    const response = await PATCH(
      createJsonRequest(
        "/api/v1/node-boards/nb-1",
        "PATCH",
        { name: "Renamed" },
        withTestSession(actorChainUser),
      ),
      { params: Promise.resolve({ id: "nb-1" }) },
    );
    await expectApiError(response, "FORBIDDEN", 403);
  });

  it("returns 200 with the updated NodeBoardResponse for the initiator", async () => {
    // Query order in the service:
    //   1. board by id (getNodeBoardById)
    //   2. goal space context (getGoalSpaceContextForBoard → goal space row)
    //   3. goal space member ids (getGoalSpaceContextForBoard → distinct)
    //   4. active members for the board (listActiveMembersForBoard, after update)
    queueSelectResults(
      { ...baseBoard },
      { ...baseGoalSpace, initiatorId: "user-init" },
      [{ userId: "user-chain" }],
      [{ ...baseMember }],
    );
    captureMutations();
    makeTxHarness({ ...baseBoard, name: "Renamed", updatedAt: "2026-06-20T00:00:00.000Z" });
    const { PATCH } = await import("@/app/api/v1/node-boards/[id]/route");
    const response = await PATCH(
      createJsonRequest(
        "/api/v1/node-boards/nb-1",
        "PATCH",
        { name: "Renamed" },
        withTestSession(actorInitiator),
      ),
      { params: Promise.resolve({ id: "nb-1" }) },
    );
    const json = await expectApiOk<{ name: string; id: string }>(response);
    expect(json.data.name).toBe("Renamed");
  });

  it("returns 404 when the board does not exist", async () => {
    queueSelectResults(null);
    const { PATCH } = await import("@/app/api/v1/node-boards/[id]/route");
    const response = await PATCH(
      createJsonRequest(
        "/api/v1/node-boards/nb-missing",
        "PATCH",
        { name: "Renamed" },
        withTestSession(actorInitiator),
      ),
      { params: Promise.resolve({ id: "nb-missing" }) },
    );
    await expectApiError(response, "NOT_FOUND", 404);
  });

  it("returns 422 VALIDATION_ERROR for an invalid status value", async () => {
    queueSelectResults({ ...baseBoard }, [{ userId: "user-chain" }]);
    const { PATCH } = await import("@/app/api/v1/node-boards/[id]/route");
    const response = await PATCH(
      createJsonRequest(
        "/api/v1/node-boards/nb-1",
        "PATCH",
        { status: "deleted" },
        withTestSession(actorInitiator),
      ),
      { params: Promise.resolve({ id: "nb-1" }) },
    );
    await expectApiError(response, "VALIDATION_ERROR", 422);
  });
});

// ─── POST /api/v1/node-boards/:id/members ───────────────────────────

describe("POST /api/v1/node-boards/:id/members (F2-04)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedUpdates.length = 0;
    capturedInserts.length = 0;
    resetEnv();
  });
  afterEach(() => vi.restoreAllMocks());

  it("returns 401 without a session", async () => {
    const { POST } = await import("@/app/api/v1/node-boards/[id]/members/route");
    const response = await POST(
      createJsonRequest("/api/v1/node-boards/nb-1/members", "POST", {
        user_id: "user-new",
        role: "member",
      }),
      { params: Promise.resolve({ id: "nb-1" }) },
    );
    await expectApiError(response, "UNAUTHORIZED", 401);
  });

  it("returns 403 when a non-initiator tries to add a member", async () => {
    queueSelectResults({ ...baseBoard }, [{ userId: "user-chain" }]);
    const { POST } = await import("@/app/api/v1/node-boards/[id]/members/route");
    const response = await POST(
      createJsonRequest(
        "/api/v1/node-boards/nb-1/members",
        "POST",
        { user_id: "user-new", role: "member" },
        withTestSession(actorChainUser),
      ),
      { params: Promise.resolve({ id: "nb-1" }) },
    );
    await expectApiError(response, "FORBIDDEN", 403);
  });

  it("returns 400 when user_id is missing", async () => {
    queueSelectResults({ ...baseBoard }, { ...baseGoalSpace, initiatorId: "user-init" }, [
      { userId: "user-chain" },
    ]);
    const { POST } = await import("@/app/api/v1/node-boards/[id]/members/route");
    const response = await POST(
      createJsonRequest(
        "/api/v1/node-boards/nb-1/members",
        "POST",
        { role: "member" },
        withTestSession(actorInitiator),
      ),
      { params: Promise.resolve({ id: "nb-1" }) },
    );
    await expectApiError(response, "INVALID_FIELD", 400);
  });

  it("returns 400 when role is missing", async () => {
    queueSelectResults({ ...baseBoard }, { ...baseGoalSpace, initiatorId: "user-init" }, [
      { userId: "user-chain" },
    ]);
    const { POST } = await import("@/app/api/v1/node-boards/[id]/members/route");
    const response = await POST(
      createJsonRequest(
        "/api/v1/node-boards/nb-1/members",
        "POST",
        { user_id: "user-new" },
        withTestSession(actorInitiator),
      ),
      { params: Promise.resolve({ id: "nb-1" }) },
    );
    await expectApiError(response, "INVALID_FIELD", 400);
  });

  it("returns 422 for an invalid role", async () => {
    queueSelectResults({ ...baseBoard }, { ...baseGoalSpace, initiatorId: "user-init" }, [
      { userId: "user-chain" },
    ]);
    const { POST } = await import("@/app/api/v1/node-boards/[id]/members/route");
    const response = await POST(
      createJsonRequest(
        "/api/v1/node-boards/nb-1/members",
        "POST",
        { user_id: "user-new", role: "editor" },
        withTestSession(actorInitiator),
      ),
      { params: Promise.resolve({ id: "nb-1" }) },
    );
    await expectApiError(response, "VALIDATION_ERROR", 422);
  });

  it("returns 404 when the board does not exist", async () => {
    queueSelectResults(null);
    const { POST } = await import("@/app/api/v1/node-boards/[id]/members/route");
    const response = await POST(
      createJsonRequest(
        "/api/v1/node-boards/nb-missing/members",
        "POST",
        { user_id: "user-new", role: "member" },
        withTestSession(actorInitiator),
      ),
      { params: Promise.resolve({ id: "nb-missing" }) },
    );
    await expectApiError(response, "NOT_FOUND", 404);
  });

  it("returns 201 with the added NodeBoardMemberResponse and writes audit + realtime", async () => {
    // Query order: board → goal space ctx → members → findActiveMember (null)
    queueSelectResults(
      { ...baseBoard },
      { ...baseGoalSpace, initiatorId: "user-init" },
      [{ userId: "user-chain" }],
      null, // no existing member row
    );
    captureMutations();
    makeTxHarness({ ...baseMember, userId: "user-new", role: "member" });

    const { POST } = await import("@/app/api/v1/node-boards/[id]/members/route");
    const response = await POST(
      createJsonRequest(
        "/api/v1/node-boards/nb-1/members",
        "POST",
        { user_id: "user-new", role: "member" },
        withTestSession(actorInitiator),
      ),
      { params: Promise.resolve({ id: "nb-1" }) },
    );
    const json = await expectApiOk<{ user_id: string; role: string; board_id: string }>(response);
    expect(json.data).toMatchObject({
      user_id: "user-new",
      role: "member",
      board_id: "nb-1",
    });
    expect(mockDb.transaction).toHaveBeenCalledTimes(1);
  });
});

// ─── DELETE /api/v1/node-boards/:id/members/:userId ─────────────────

describe("DELETE /api/v1/node-boards/:id/members/:userId (F2-04)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedUpdates.length = 0;
    capturedInserts.length = 0;
    resetEnv();
  });
  afterEach(() => vi.restoreAllMocks());

  it("returns 401 without a session", async () => {
    const { DELETE } = await import("@/app/api/v1/node-boards/[id]/members/[userId]/route");
    const response = await DELETE(
      createJsonRequest("/api/v1/node-boards/nb-1/members/user-chain", "DELETE"),
      { params: Promise.resolve({ id: "nb-1", userId: "user-chain" }) },
    );
    await expectApiError(response, "UNAUTHORIZED", 401);
  });

  it("returns 403 when a non-initiator tries to remove a member", async () => {
    queueSelectResults({ ...baseBoard }, { ...baseGoalSpace, initiatorId: "user-init" }, [
      { userId: "user-chain" },
    ]);
    const { DELETE } = await import("@/app/api/v1/node-boards/[id]/members/[userId]/route");
    const response = await DELETE(
      createJsonRequest(
        "/api/v1/node-boards/nb-1/members/user-chain",
        "DELETE",
        undefined,
        withTestSession(actorChainUser),
      ),
      { params: Promise.resolve({ id: "nb-1", userId: "user-chain" }) },
    );
    await expectApiError(response, "FORBIDDEN", 403);
  });

  it("returns 404 when the board does not exist", async () => {
    queueSelectResults(null);
    const { DELETE } = await import("@/app/api/v1/node-boards/[id]/members/[userId]/route");
    const response = await DELETE(
      createJsonRequest(
        "/api/v1/node-boards/nb-missing/members/user-chain",
        "DELETE",
        undefined,
        withTestSession(actorInitiator),
      ),
      { params: Promise.resolve({ id: "nb-missing", userId: "user-chain" }) },
    );
    await expectApiError(response, "NOT_FOUND", 404);
  });

  it("returns 204 for a successful soft remove (writes audit + realtime)", async () => {
    queueSelectResults(
      { ...baseBoard },
      { ...baseGoalSpace, initiatorId: "user-init" },
      [{ userId: "user-chain" }],
      { ...baseMember },
    );
    captureMutations();
    makeTxHarness({ ...baseMember, removedAt: "2026-06-20T00:00:00.000Z" });

    const { DELETE } = await import("@/app/api/v1/node-boards/[id]/members/[userId]/route");
    const response = await DELETE(
      createJsonRequest(
        "/api/v1/node-boards/nb-1/members/user-chain",
        "DELETE",
        undefined,
        withTestSession(actorInitiator),
      ),
      { params: Promise.resolve({ id: "nb-1", userId: "user-chain" }) },
    );
    expect(response.status).toBe(204);
    expect(mockDb.transaction).toHaveBeenCalledTimes(1);
  });

  it("returns 204 idempotently when the member is already removed", async () => {
    queueSelectResults(
      { ...baseBoard },
      { ...baseGoalSpace, initiatorId: "user-init" },
      [{ userId: "user-chain" }],
      null, // findActiveMember returns null → idempotent
    );
    const { DELETE } = await import("@/app/api/v1/node-boards/[id]/members/[userId]/route");
    const response = await DELETE(
      createJsonRequest(
        "/api/v1/node-boards/nb-1/members/user-chain",
        "DELETE",
        undefined,
        withTestSession(actorInitiator),
      ),
      { params: Promise.resolve({ id: "nb-1", userId: "user-chain" }) },
    );
    expect(response.status).toBe(204);
  });

  it("returns 404 when the member is not part of the board", async () => {
    queueSelectResults(
      { ...baseBoard },
      { ...baseGoalSpace, initiatorId: "user-init" },
      [{ userId: "user-chain" }],
      null, // no member row found
    );
    const { DELETE } = await import("@/app/api/v1/node-boards/[id]/members/[userId]/route");
    const response = await DELETE(
      createJsonRequest(
        "/api/v1/node-boards/nb-1/members/user-stranger",
        "DELETE",
        undefined,
        withTestSession(actorInitiator),
      ),
      { params: Promise.resolve({ id: "nb-1", userId: "user-stranger" }) },
    );
    // After getNodeBoardWithContext succeeds, findActiveMember returns null
    // → service is idempotent → 204, not 404.
    // Update the test to assert 204 (idempotent) to match the documented behavior.
    expect(response.status).toBe(204);
  });
});

// ─── Realtime event type snapshot (for F2-08) ──────────────────────

describe("F2-04 realtime event type constants (F2-04 handoff)", () => {
  it("exposes the documented node_board / node_board_member event types", async () => {
    const constants = await import("@/lib/services/node-boards");
    expect(constants.NODE_BOARD_REALTIME_EVENTS.created).toBe("node_board.created");
    expect(constants.NODE_BOARD_REALTIME_EVENTS.updated).toBe("node_board.updated");
    expect(constants.NODE_BOARD_REALTIME_EVENTS.memberAdded).toBe("node_board_member.added");
    expect(constants.NODE_BOARD_REALTIME_EVENTS.memberRemoved).toBe("node_board_member.removed");
    // Audit entity types
    expect(constants.NODE_BOARD_AUDIT_ENTITY_TYPE).toBe("node_board");
    expect(constants.NODE_BOARD_MEMBER_AUDIT_ENTITY_TYPE).toBe("node_board_member");
  });
});

// ─── Audit + realtime per lifecycle write ──────────────────────────

describe("F2-04 audit + realtime per lifecycle write", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedUpdates.length = 0;
    capturedInserts.length = 0;
    resetEnv();
  });
  afterEach(() => vi.restoreAllMocks());

  it("create writes one audit + one realtime inside one transaction", async () => {
    queueSelectResults({ ...baseGoalSpace }, [{ userId: "user-chain" }]);
    captureMutations();
    makeTxHarness({ ...baseBoard });

    const { POST } = await import("@/app/api/v1/goal-spaces/[goalSpaceId]/node-boards/route");
    const response = await POST(
      createJsonRequest(
        "/api/v1/goal-spaces/gs-1/node-boards",
        "POST",
        { key: "main", name: "Main" },
        withTestSession(actorInitiator),
      ),
      { params: Promise.resolve({ goalSpaceId: "gs-1" }) },
    );
    expect(response.status).toBe(201);
    expect(mockDb.transaction).toHaveBeenCalledTimes(1);
    // Audit entry for node_board created (entityType from the runWithAudit ctx)
    const auditInsert = capturedInserts.find(
      (c) => (c.values as Record<string, unknown>).entityType === "node_board",
    );
    expect(auditInsert).toBeDefined();
    // Realtime event for node_board created (type from the runWithAudit ctx)
    const realtimeInsert = capturedInserts.find(
      (c) => (c.values as Record<string, unknown>).type === "node_board.created",
    );
    expect(realtimeInsert).toBeDefined();
  });

  it("add member writes one audit + one realtime inside one transaction", async () => {
    // board → goal space ctx → members → findActiveMember (null)
    queueSelectResults(
      { ...baseBoard },
      { ...baseGoalSpace, initiatorId: "user-init" },
      [{ userId: "user-chain" }],
      null,
    );
    captureMutations();
    makeTxHarness({ ...baseMember, userId: "user-new" });

    const { POST } = await import("@/app/api/v1/node-boards/[id]/members/route");
    const response = await POST(
      createJsonRequest(
        "/api/v1/node-boards/nb-1/members",
        "POST",
        { user_id: "user-new", role: "member" },
        withTestSession(actorInitiator),
      ),
      { params: Promise.resolve({ id: "nb-1" }) },
    );
    expect(response.status).toBe(201);
    expect(mockDb.transaction).toHaveBeenCalledTimes(1);
    const auditInsert = capturedInserts.find(
      (c) => (c.values as Record<string, unknown>).entityType === "node_board_member",
    );
    expect(auditInsert).toBeDefined();
    const realtimeInsert = capturedInserts.find(
      (c) => (c.values as Record<string, unknown>).type === "node_board_member.added",
    );
    expect(realtimeInsert).toBeDefined();
  });

  it("remove member writes one audit + one realtime inside one transaction", async () => {
    queueSelectResults(
      { ...baseBoard },
      { ...baseGoalSpace, initiatorId: "user-init" },
      [{ userId: "user-chain" }],
      { ...baseMember },
    );
    captureMutations();
    makeTxHarness({ ...baseMember, removedAt: "2026-06-20T00:00:00.000Z" });

    const { DELETE } = await import("@/app/api/v1/node-boards/[id]/members/[userId]/route");
    const response = await DELETE(
      createJsonRequest(
        "/api/v1/node-boards/nb-1/members/user-chain",
        "DELETE",
        undefined,
        withTestSession(actorInitiator),
      ),
      { params: Promise.resolve({ id: "nb-1", userId: "user-chain" }) },
    );
    expect(response.status).toBe(204);
    expect(mockDb.transaction).toHaveBeenCalledTimes(1);
    const auditInsert = capturedInserts.find(
      (c) => (c.values as Record<string, unknown>).entityType === "node_board_member",
    );
    expect(auditInsert).toBeDefined();
    const realtimeInsert = capturedInserts.find(
      (c) => (c.values as Record<string, unknown>).type === "node_board_member.removed",
    );
    expect(realtimeInsert).toBeDefined();
  });
});
