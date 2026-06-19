/**
 * Node Board service (F2-04).
 *
 * Transactional application services for the documented REST endpoints
 * in `docs/specs/interface_spec.md § 3.8`. Each lifecycle write is
 * wrapped in `runWithAudit` so the business change, audit entry, and
 * realtime event share a single `better-sqlite3` transaction.
 *
 * Authorization: `canReadNodeBoard` / `canManageNodeBoard` /
 * `canManageNodeBoardMembers` (per `docs/specs/authorization_matrix.md § 3`
 * and § 4). The goal space access check uses F2-03's
 * `getGoalSpaceWithMembers` for the list endpoint.
 *
 * Realtime event type names are exported as constants so F2-08 SSE
 * filtering and downstream consumers have a single source of truth.
 */

import { randomUUID } from "node:crypto";

import { ApiRequestError } from "@/lib/api/errors";
import { runWithAudit, type AuditContext } from "@/lib/audit/run-with-audit";
import {
  canManageNodeBoard,
  canManageNodeBoardMembers,
  canReadNodeBoard,
} from "@/lib/authorization/node-board";
import type { Actor, NodeBoardContext } from "@/lib/authorization/types";
import { getDb, type DrizzleDb } from "@/lib/db/client";
import { getGoalSpaceWithMembers } from "@/lib/db/repositories/goal-spaces";
import {
  createNodeBoard as createNodeBoardRow,
  findActiveMember,
  findRemovedMember,
  getNodeBoardWithContext,
  insertNodeBoardMember,
  listActiveMembersForBoard,
  listActiveMembersForBoards,
  listNodeBoardsForGoalSpace as listNodeBoardsForGoalSpaceRows,
  NODE_BOARD_STATUS_VALUES,
  reactivateNodeBoardMember,
  softRemoveNodeBoardMember as softRemoveNodeBoardMemberRow,
  updateNodeBoard as updateNodeBoardRow,
  type NodeBoardMemberRow,
  type NodeBoardRow,
} from "@/lib/db/repositories/node-boards";

// ─── realtime event constants (F2-08 handoff) ──────────────────────

export const NODE_BOARD_REALTIME_EVENTS = {
  created: "node_board.created",
  updated: "node_board.updated",
  memberAdded: "node_board_member.added",
  memberRemoved: "node_board_member.removed",
} as const;

export const NODE_BOARD_AUDIT_ENTITY_TYPE = "node_board" as const;
export const NODE_BOARD_MEMBER_AUDIT_ENTITY_TYPE = "node_board_member" as const;

// ─── response shapes (per docs/specs/interface_spec.md § 3.8) ────────

export interface NodeBoardMemberResponse {
  readonly user_id: string;
  readonly role: "owner" | "member" | "viewer";
  readonly board_id: string;
}

export interface NodeBoardResponse {
  readonly id: string;
  readonly goal_space_id: string;
  readonly key: string;
  readonly name: string;
  readonly description: string;
  readonly members: readonly NodeBoardMemberResponse[];
  readonly status: NodeBoardStatus;
  readonly created_at: string;
  readonly updated_at: string;
}

export interface NodeBoardListResponse {
  readonly items: readonly NodeBoardResponse[];
  readonly total: number;
}

type NodeBoardStatus = NodeBoardRow["status"];

// ─── input shapes ────────────────────────────────────────────────

export interface CreateNodeBoardInput {
  readonly key: string;
  readonly name: string;
  readonly description?: string;
  readonly members?: ReadonlyArray<{ user_id: string; role: "owner" | "member" | "viewer" }>;
}

export interface UpdateNodeBoardInput {
  readonly name?: string;
  readonly description?: string | null;
  readonly status?: NodeBoardStatus;
}

export interface AddNodeBoardMemberInput {
  readonly user_id: string;
  readonly role: "owner" | "member" | "viewer";
}

// ─── helpers ─────────────────────────────────────────────────────

function nowIso(): string {
  return new Date().toISOString();
}

function toMemberResponse(member: NodeBoardMemberRow): NodeBoardMemberResponse {
  return {
    user_id: member.userId,
    role: member.role,
    board_id: member.boardId,
  };
}

function toResponse(
  board: NodeBoardRow,
  members: readonly NodeBoardMemberRow[],
): NodeBoardResponse {
  return {
    id: board.id,
    goal_space_id: board.goalSpaceId,
    key: board.key,
    name: board.name,
    description: board.description ?? "",
    members: members.map(toMemberResponse),
    status: board.status,
    created_at: board.createdAt,
    updated_at: board.updatedAt,
  };
}

function asBoardContext(
  board: NodeBoardRow,
  goalSpaceInitiatorId: string,
  memberIds: readonly string[],
): NodeBoardContext {
  return {
    nodeBoardId: board.id,
    goalSpaceId: board.goalSpaceId,
    goalSpaceInitiatorId,
    memberIds,
  };
}

function ensureReadableBoard(
  actor: Actor,
  board: NodeBoardRow,
  goalSpaceInitiatorId: string,
  memberIds: readonly string[],
): void {
  if (!canReadNodeBoard(actor, asBoardContext(board, goalSpaceInitiatorId, memberIds))) {
    throw new ApiRequestError("FORBIDDEN", "Cannot read this node board.");
  }
}

function ensureManageableBoard(
  actor: Actor,
  board: NodeBoardRow,
  goalSpaceInitiatorId: string,
  memberIds: readonly string[],
): void {
  if (!canManageNodeBoard(actor, asBoardContext(board, goalSpaceInitiatorId, memberIds))) {
    throw new ApiRequestError(
      "FORBIDDEN",
      "Only the goal space initiator can manage this node board.",
    );
  }
}

function ensureManageableMembers(
  actor: Actor,
  board: NodeBoardRow,
  goalSpaceInitiatorId: string,
  memberIds: readonly string[],
): void {
  if (!canManageNodeBoardMembers(actor, asBoardContext(board, goalSpaceInitiatorId, memberIds))) {
    throw new ApiRequestError(
      "FORBIDDEN",
      "Only the goal space initiator can manage node board members.",
    );
  }
}

function validateStatus(value: unknown): NodeBoardStatus {
  if (typeof value !== "string") {
    throw new ApiRequestError(
      "VALIDATION_ERROR",
      "status must be one of: active, completed, archived.",
    );
  }
  if (!(NODE_BOARD_STATUS_VALUES as readonly string[]).includes(value)) {
    throw new ApiRequestError(
      "VALIDATION_ERROR",
      `status must be one of: ${NODE_BOARD_STATUS_VALUES.join(", ")}.`,
    );
  }
  return value as NodeBoardStatus;
}

function validateRole(value: unknown): "owner" | "member" | "viewer" {
  if (value !== "owner" && value !== "member" && value !== "viewer") {
    throw new ApiRequestError("VALIDATION_ERROR", "role must be one of: owner, member, viewer.");
  }
  return value;
}

// ─── service: list boards in a goal space ─────────────────────────

export function listNodeBoardsForGoalSpaceService(
  goalSpaceId: string,
  actor: Actor,
  db: DrizzleDb = getDb(),
): NodeBoardListResponse {
  const loaded = getGoalSpaceWithMembers(db, goalSpaceId);
  if (!loaded) {
    throw new ApiRequestError("NOT_FOUND", "Goal space not found.");
  }

  // Goal space read check: initiator sees own goal space; non-initiator
  // needs to be a node board member.
  if (
    actor.role === "initiator"
      ? actor.id !== loaded.row.initiatorId
      : !loaded.memberIds.includes(actor.id)
  ) {
    throw new ApiRequestError("FORBIDDEN", "Cannot read this goal space.");
  }

  const { items, total } = listNodeBoardsForGoalSpaceRows(db, goalSpaceId, actor);
  const memberLists = listActiveMembersForBoards(
    db,
    items.map((b) => b.id),
  );

  const grouped = new Map<string, NodeBoardMemberRow[]>();
  for (const m of memberLists) {
    const list = grouped.get(m.boardId) ?? [];
    list.push(m);
    grouped.set(m.boardId, list);
  }

  return {
    items: items.map((b) => toResponse(b, grouped.get(b.id) ?? [])),
    total,
  };
}

// ─── service: create board ───────────────────────────────────────

export function createNodeBoardService(
  goalSpaceId: string,
  input: CreateNodeBoardInput,
  actor: Actor,
  db: DrizzleDb = getDb(),
): NodeBoardResponse {
  const loaded = getGoalSpaceWithMembers(db, goalSpaceId);
  if (!loaded) {
    throw new ApiRequestError("NOT_FOUND", "Goal space not found.");
  }
  if (actor.role !== "initiator" || actor.id !== loaded.row.initiatorId) {
    throw new ApiRequestError("FORBIDDEN", "Only the goal space initiator can create boards.");
  }

  const id = randomUUID();
  const ctx: AuditContext = {
    entityType: NODE_BOARD_AUDIT_ENTITY_TYPE,
    entityId: id,
    actor: "human",
    actorId: actor.id,
    action: "create",
    goalSpaceId: loaded.row.id,
    type: NODE_BOARD_REALTIME_EVENTS.created,
    resourceType: "node_board",
    resourceId: id,
    data: { key: input.key, name: input.name },
  };

  return runWithAudit(db, ctx, (tx) => {
    let board: NodeBoardRow;
    try {
      board = createNodeBoardRow(tx, {
        id,
        goalSpaceId: loaded.row.id,
        key: input.key,
        name: input.name,
        description: input.description ?? null,
      });
    } catch (error) {
      // Map Drizzle UNIQUE constraint violation to STATE_CONFLICT.
      if (error instanceof Error && /UNIQUE constraint failed/i.test(error.message)) {
        throw new ApiRequestError(
          "STATE_CONFLICT",
          `Node board key already exists in goal space: ${input.key}.`,
        );
      }
      throw error;
    }

    const members: NodeBoardMemberRow[] = [];
    if (input.members !== undefined) {
      const joinedAt = nowIso();
      for (const m of input.members) {
        const memberId = randomUUID();
        try {
          const row = insertNodeBoardMember(tx, {
            id: memberId,
            boardId: board.id,
            userId: m.user_id,
            role: m.role,
            invitedBy: actor.id,
            joinedAt,
          });
          members.push(row);
        } catch (error) {
          if (error instanceof Error && /UNIQUE constraint failed/i.test(error.message)) {
            // Re-activate an existing removed row in place
            const reactivated = reactivateNodeBoardMember(tx, board.id, m.user_id, {
              role: m.role,
              invitedBy: actor.id,
              joinedAt,
            });
            if (reactivated) {
              members.push(reactivated);
              continue;
            }
            throw new ApiRequestError(
              "STATE_CONFLICT",
              `Member already active on node board: ${m.user_id}.`,
            );
          }
          throw error;
        }
      }
    }

    return toResponse(board, members);
  });
}

// ─── service: get board detail ───────────────────────────────────

export function getNodeBoardDetailService(
  boardId: string,
  actor: Actor,
  db: DrizzleDb = getDb(),
): NodeBoardResponse {
  const loaded = getNodeBoardWithContext(db, boardId);
  if (!loaded) {
    throw new ApiRequestError("NOT_FOUND", "Node board not found.");
  }
  ensureReadableBoard(actor, loaded.board, loaded.goalSpaceInitiatorId, loaded.memberIds);

  const members = listActiveMembersForBoard(db, boardId);
  return toResponse(loaded.board, members);
}

// ─── service: update board ───────────────────────────────────────

export function updateNodeBoardService(
  boardId: string,
  input: UpdateNodeBoardInput,
  actor: Actor,
  db: DrizzleDb = getDb(),
): NodeBoardResponse {
  const loaded = getNodeBoardWithContext(db, boardId);
  if (!loaded) {
    throw new ApiRequestError("NOT_FOUND", "Node board not found.");
  }
  ensureManageableBoard(actor, loaded.board, loaded.goalSpaceInitiatorId, loaded.memberIds);

  if (input.status !== undefined) {
    input = { ...input, status: validateStatus(input.status) };
  }

  const ctx: AuditContext = {
    entityType: NODE_BOARD_AUDIT_ENTITY_TYPE,
    entityId: boardId,
    actor: "human",
    actorId: actor.id,
    action: "update",
    goalSpaceId: loaded.goalSpaceId,
    type: NODE_BOARD_REALTIME_EVENTS.updated,
    resourceType: "node_board",
    resourceId: boardId,
    details: { patch: { ...input } },
  };

  return runWithAudit(db, ctx, (tx) => {
    const updated = updateNodeBoardRow(tx, boardId, input);
    if (!updated) {
      throw new ApiRequestError("NOT_FOUND", "Node board not found.");
    }
    const members = listActiveMembersForBoard(db, boardId);
    return toResponse(updated, members);
  });
}

// ─── service: add member ─────────────────────────────────────────

export function addNodeBoardMemberService(
  boardId: string,
  input: AddNodeBoardMemberInput,
  actor: Actor,
  db: DrizzleDb = getDb(),
): NodeBoardMemberResponse {
  const loaded = getNodeBoardWithContext(db, boardId);
  if (!loaded) {
    throw new ApiRequestError("NOT_FOUND", "Node board not found.");
  }
  ensureManageableMembers(actor, loaded.board, loaded.goalSpaceInitiatorId, loaded.memberIds);

  const role = validateRole(input.role);

  // Idempotency: if an active member already exists, return it.
  const existing = findActiveMember(db, boardId, input.user_id);
  if (existing) {
    throw new ApiRequestError(
      "STATE_CONFLICT",
      `Member already active on node board: ${input.user_id}.`,
    );
  }

  const memberId = randomUUID();
  const joinedAt = nowIso();

  const ctx: AuditContext = {
    entityType: NODE_BOARD_MEMBER_AUDIT_ENTITY_TYPE,
    entityId: memberId,
    actor: "human",
    actorId: actor.id,
    action: "add",
    goalSpaceId: loaded.goalSpaceId,
    type: NODE_BOARD_REALTIME_EVENTS.memberAdded,
    resourceType: "node_board_member",
    resourceId: memberId,
    details: { boardId, userId: input.user_id, role },
  };

  return runWithAudit(db, ctx, (tx) => {
    const reactivated = findRemovedMember(db, boardId, input.user_id);
    let member: NodeBoardMemberRow;
    try {
      if (reactivated) {
        const r = reactivateNodeBoardMember(tx, boardId, input.user_id, {
          role,
          invitedBy: actor.id,
          joinedAt,
        });
        if (!r) {
          throw new ApiRequestError("INTERNAL_ERROR", "Failed to reactivate member.");
        }
        member = r;
      } else {
        member = insertNodeBoardMember(tx, {
          id: memberId,
          boardId,
          userId: input.user_id,
          role,
          invitedBy: actor.id,
          joinedAt,
        });
      }
    } catch (error) {
      if (error instanceof Error && /UNIQUE constraint failed/i.test(error.message)) {
        throw new ApiRequestError(
          "STATE_CONFLICT",
          `Member already active on node board: ${input.user_id}.`,
        );
      }
      throw error;
    }
    return toMemberResponse(member);
  });
}

// ─── service: remove member ──────────────────────────────────────

export function removeNodeBoardMemberService(
  boardId: string,
  userId: string,
  actor: Actor,
  db: DrizzleDb = getDb(),
): void {
  const loaded = getNodeBoardWithContext(db, boardId);
  if (!loaded) {
    throw new ApiRequestError("NOT_FOUND", "Node board not found.");
  }
  ensureManageableMembers(actor, loaded.board, loaded.goalSpaceInitiatorId, loaded.memberIds);

  const member = findActiveMember(db, boardId, userId);
  if (!member) {
    // Already removed (or never added) — idempotent 204.
    return;
  }

  const removedAt = nowIso();
  const ctx: AuditContext = {
    entityType: NODE_BOARD_MEMBER_AUDIT_ENTITY_TYPE,
    entityId: member.id,
    actor: "human",
    actorId: actor.id,
    action: "remove",
    goalSpaceId: loaded.goalSpaceId,
    type: NODE_BOARD_REALTIME_EVENTS.memberRemoved,
    resourceType: "node_board_member",
    resourceId: member.id,
    details: { boardId, userId },
  };

  runWithAudit(db, ctx, (tx) => {
    softRemoveNodeBoardMemberRow(tx, boardId, userId, removedAt);
  });
}
