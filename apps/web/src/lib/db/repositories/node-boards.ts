/**
 * Node Board repository (F2-04).
 *
 * Focused query/write helpers used by `apps/web/src/lib/services/node-boards.ts`.
 * Read helpers take the production `DrizzleDb`; write helpers take the
 * `AuditTx` produced by `runWithAudit` so the lifecycle write shares a
 * single transaction with the audit entry and realtime event.
 *
 * Soft delete / soft remove conventions:
 *   - `node_boards.deleted_at` IS NULL on reads
 *   - `node_board_members.removed_at` IS NULL on active-membership reads
 *   - `softRemoveNodeBoardMember` UPDATEs `removed_at` (never DELETE)
 *   - `addNodeBoardMember` reactivate-on-conflict: if a removed row
 *     already exists, update it in place instead of inserting a new one
 *     (the partial unique index `idx_node_board_members_board_user_active`
 *     would otherwise block re-adding)
 */

import { and, eq, isNull, sql } from "drizzle-orm";
import { goalSpaces, nodeBoards, nodeBoardMembers, type NodeBoardStatus } from "@db/schema";
import type { DrizzleDb } from "@/lib/db/client";
import type { AuditTx } from "@/lib/audit/run-with-audit";

// ─── enums ─────────────────────────────────────────────────────────

export const NODE_BOARD_STATUS_VALUES: readonly NodeBoardStatus[] = [
  "active",
  "completed",
  "archived",
] as const;

// ─── types ─────────────────────────────────────────────────────────

export interface NodeBoardRow {
  readonly id: string;
  readonly goalSpaceId: string;
  readonly key: string;
  readonly name: string;
  readonly description: string | null;
  readonly status: NodeBoardStatus;
  readonly displayOrder: number;
  readonly context: Record<string, unknown>;
  readonly deletedAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface NodeBoardMemberRow {
  readonly id: string;
  readonly boardId: string;
  readonly userId: string;
  readonly role: "owner" | "member" | "viewer";
  readonly invitedBy: string | null;
  readonly joinedAt: string;
  readonly removedAt: string | null;
}

export interface CreateNodeBoardInput {
  readonly id: string;
  readonly goalSpaceId: string;
  readonly key: string;
  readonly name: string;
  readonly description: string | null;
}

export interface UpdateNodeBoardInput {
  readonly name?: string;
  readonly description?: string | null;
  readonly status?: NodeBoardStatus;
}

export interface AddNodeBoardMemberInput {
  readonly id: string;
  readonly boardId: string;
  readonly userId: string;
  readonly role: "owner" | "member" | "viewer";
  readonly invitedBy: string;
  readonly joinedAt: string;
}

// ─── write helpers (inside runWithAudit transaction) ──────────────

export function createNodeBoard(tx: AuditTx, input: CreateNodeBoardInput): NodeBoardRow {
  const row = tx
    .insert(nodeBoards)
    .values({
      id: input.id,
      goalSpaceId: input.goalSpaceId,
      key: input.key,
      name: input.name,
      description: input.description,
      status: "active",
      displayOrder: 0,
    })
    .returning()
    .get();
  return row as NodeBoardRow;
}

export function updateNodeBoard(
  tx: AuditTx,
  id: string,
  input: UpdateNodeBoardInput,
): NodeBoardRow | null {
  const patch: Record<string, unknown> = {
    updatedAt: sql`(datetime('now'))`,
  };
  if (input.name !== undefined) patch.name = input.name;
  if (input.description !== undefined) patch.description = input.description;
  if (input.status !== undefined) patch.status = input.status;

  const row = tx
    .update(nodeBoards)
    .set(patch)
    .where(and(eq(nodeBoards.id, id), isNull(nodeBoards.deletedAt)))
    .returning()
    .get();
  return (row as NodeBoardRow | undefined) ?? null;
}

/**
 * Insert a fresh member row. Throws on UNIQUE constraint violation;
 * the service should call `reactivateNodeBoardMember` first if it
 * suspects a previously removed member is being re-added.
 */
export function insertNodeBoardMember(
  tx: AuditTx,
  input: AddNodeBoardMemberInput,
): NodeBoardMemberRow {
  const row = tx
    .insert(nodeBoardMembers)
    .values({
      id: input.id,
      boardId: input.boardId,
      userId: input.userId,
      role: input.role,
      invitedBy: input.invitedBy,
      joinedAt: input.joinedAt,
    })
    .returning()
    .get();
  return row as NodeBoardMemberRow;
}

/**
 * Reactivate a previously removed member row (set `removed_at` to null,
 * update role + invited_by + joined_at). Returns null if no removed row
 * exists for this (board, user) pair.
 */
export function reactivateNodeBoardMember(
  tx: AuditTx,
  boardId: string,
  userId: string,
  patch: { role: "owner" | "member" | "viewer"; invitedBy: string; joinedAt: string },
): NodeBoardMemberRow | null {
  const row = tx
    .update(nodeBoardMembers)
    .set({
      removedAt: null,
      role: patch.role,
      invitedBy: patch.invitedBy,
      joinedAt: patch.joinedAt,
    })
    .where(
      and(
        eq(nodeBoardMembers.boardId, boardId),
        eq(nodeBoardMembers.userId, userId),
        sql`${nodeBoardMembers.removedAt} IS NOT NULL`,
      ),
    )
    .returning()
    .get();
  return (row as NodeBoardMemberRow | undefined) ?? null;
}

/**
 * Soft-remove a member. Updates `removed_at` (idempotent: re-running
 * on an already-removed row just refreshes the timestamp).
 */
export function softRemoveNodeBoardMember(
  tx: AuditTx,
  boardId: string,
  userId: string,
  removedAt: string,
): NodeBoardMemberRow | null {
  const row = tx
    .update(nodeBoardMembers)
    .set({ removedAt })
    .where(
      and(
        eq(nodeBoardMembers.boardId, boardId),
        eq(nodeBoardMembers.userId, userId),
        isNull(nodeBoardMembers.removedAt),
      ),
    )
    .returning()
    .get();
  return (row as NodeBoardMemberRow | undefined) ?? null;
}

// ─── read helpers ────────────────────────────────────────────────

export function getNodeBoardById(db: DrizzleDb | AuditTx, id: string): NodeBoardRow | null {
  const row = db
    .select()
    .from(nodeBoards)
    .where(and(eq(nodeBoards.id, id), isNull(nodeBoards.deletedAt)))
    .get();
  return (row as NodeBoardRow | undefined) ?? null;
}

export function findActiveMember(
  db: DrizzleDb | AuditTx,
  boardId: string,
  userId: string,
): NodeBoardMemberRow | null {
  const row = db
    .select()
    .from(nodeBoardMembers)
    .where(
      and(
        eq(nodeBoardMembers.boardId, boardId),
        eq(nodeBoardMembers.userId, userId),
        isNull(nodeBoardMembers.removedAt),
      ),
    )
    .get();
  return (row as NodeBoardMemberRow | undefined) ?? null;
}

export function findRemovedMember(
  db: DrizzleDb | AuditTx,
  boardId: string,
  userId: string,
): NodeBoardMemberRow | null {
  const row = db
    .select()
    .from(nodeBoardMembers)
    .where(
      and(
        eq(nodeBoardMembers.boardId, boardId),
        eq(nodeBoardMembers.userId, userId),
        sql`${nodeBoardMembers.removedAt} IS NOT NULL`,
      ),
    )
    .get();
  return (row as NodeBoardMemberRow | undefined) ?? null;
}

export function listActiveMembersForBoard(db: DrizzleDb, boardId: string): NodeBoardMemberRow[] {
  return db
    .select()
    .from(nodeBoardMembers)
    .where(and(eq(nodeBoardMembers.boardId, boardId), isNull(nodeBoardMembers.removedAt)))
    .all() as NodeBoardMemberRow[];
}

export function listActiveMembersForBoards(
  db: DrizzleDb,
  boardIds: readonly string[],
): NodeBoardMemberRow[] {
  if (boardIds.length === 0) return [];
  const placeholders = boardIds.map((b) => sql`${b}`);
  return db
    .select()
    .from(nodeBoardMembers)
    .where(
      and(
        sql`${nodeBoardMembers.boardId} IN (${sql.join(placeholders, sql`, `)})`,
        isNull(nodeBoardMembers.removedAt),
      ),
    )
    .all() as NodeBoardMemberRow[];
}

/**
 * List boards for a goal space.
 *   - initiator: returns every non-deleted board in the goal space
 *   - non-initiator: returns only the boards where the actor is an
 *     active member (uses `selectDistinct` to avoid duplicates)
 */
export function listNodeBoardsForGoalSpace(
  db: DrizzleDb,
  goalSpaceId: string,
  actor: { id: string; role: "initiator" | "chain_user" | "viewer" },
): { items: NodeBoardRow[]; total: number } {
  if (actor.role === "initiator") {
    const items = db
      .select()
      .from(nodeBoards)
      .where(and(eq(nodeBoards.goalSpaceId, goalSpaceId), isNull(nodeBoards.deletedAt)))
      .orderBy(sql`${nodeBoards.createdAt} ASC`)
      .all() as NodeBoardRow[];
    return { items, total: items.length };
  }

  // non-initiator: only boards where the actor is an active member
  const memberBoardIds = db
    .selectDistinct({ boardId: nodeBoardMembers.boardId })
    .from(nodeBoardMembers)
    .where(and(eq(nodeBoardMembers.userId, actor.id), isNull(nodeBoardMembers.removedAt)))
    .all() as Array<{ boardId: string }>;

  if (memberBoardIds.length === 0) {
    return { items: [], total: 0 };
  }

  const placeholders = memberBoardIds.map((m) => sql`${m.boardId}`);
  const items = db
    .select()
    .from(nodeBoards)
    .where(
      and(
        eq(nodeBoards.goalSpaceId, goalSpaceId),
        isNull(nodeBoards.deletedAt),
        sql`${nodeBoards.id} IN (${sql.join(placeholders, sql`, `)})`,
      ),
    )
    .orderBy(sql`${nodeBoards.createdAt} ASC`)
    .all() as NodeBoardRow[];
  return { items, total: items.length };
}

/**
 * Build the goal-space context for the board's authorization check.
 * Returns `null` when the goal space is missing.
 */
export function getGoalSpaceContextForBoard(
  db: DrizzleDb,
  goalSpaceId: string,
): { goalSpaceId: string; initiatorId: string; nodeBoardMemberIds: string[] } | null {
  // Two queries: (1) the goal space's initiator, (2) the distinct
  // member ids across all node boards in the goal space.
  const goalSpaceRow = db
    .select({ initiatorId: goalSpaces.initiatorId })
    .from(goalSpaces)
    .where(and(eq(goalSpaces.id, goalSpaceId), isNull(goalSpaces.deletedAt)))
    .get() as { initiatorId: string } | undefined;

  if (!goalSpaceRow) return null;

  const memberRows = db
    .selectDistinct({ userId: nodeBoardMembers.userId })
    .from(nodeBoardMembers)
    .innerJoin(nodeBoards, eq(nodeBoards.id, nodeBoardMembers.boardId))
    .where(and(eq(nodeBoards.goalSpaceId, goalSpaceId), isNull(nodeBoardMembers.removedAt)))
    .all() as Array<{ userId: string }>;

  return {
    goalSpaceId,
    initiatorId: goalSpaceRow.initiatorId,
    nodeBoardMemberIds: memberRows.map((m) => m.userId),
  };
}

/**
 * Load a board plus the goal-space context needed for authorization.
 */
export function getNodeBoardWithContext(
  db: DrizzleDb,
  boardId: string,
): {
  board: NodeBoardRow;
  goalSpaceId: string;
  goalSpaceInitiatorId: string;
  memberIds: string[];
} | null {
  const board = getNodeBoardById(db, boardId);
  if (!board) return null;

  const goalSpaceCtx = getGoalSpaceContextForBoard(db, board.goalSpaceId);
  if (!goalSpaceCtx) return null;

  return {
    board,
    goalSpaceId: board.goalSpaceId,
    goalSpaceInitiatorId: goalSpaceCtx.initiatorId,
    memberIds: goalSpaceCtx.nodeBoardMemberIds,
  };
}
