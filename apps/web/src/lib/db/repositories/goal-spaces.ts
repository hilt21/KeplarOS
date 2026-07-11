/**
 * Goal Space repository (F2-03).
 *
 * Focused query/write helpers used by `apps/web/src/lib/services/goal-spaces.ts`.
 * Each function accepts the db (or a transaction handle) explicitly so the
 * caller controls whether the write is part of a `runWithAudit` transaction.
 *
 * Read helpers take the production `DrizzleDb`; write helpers take the
 * `AuditTx` produced by `runWithAudit`. This keeps lifecycle writes inside
 * the same transaction as the audit + realtime event.
 */

import { and, count, eq, isNull, sql } from "drizzle-orm";
import {
  cards,
  goalSpaces,
  humanConfirmations,
  nodeBoardMembers,
  nodeBoards,
  users,
  type GoalSpaceStatus,
} from "@db/schema";
import type { DrizzleDb } from "@/lib/db/client";
import type { AuditTx } from "@/lib/audit/run-with-audit";

// ─── types ─────────────────────────────────────────────────────────

export interface CreateGoalSpaceRow {
  readonly name: string;
  readonly description: string | null;
  readonly constraints: Record<string, unknown>[];
  readonly acceptanceCriteria: Record<string, unknown>[] | null;
}

export interface GoalSpaceRow {
  readonly id: string;
  readonly initiatorId: string;
  readonly name: string;
  readonly description: string | null;
  readonly constraints: Record<string, unknown>[];
  readonly acceptanceCriteria: Record<string, unknown>[] | null;
  readonly status: GoalSpaceStatus;
  readonly progress: number;
  readonly templateId: string | null;
  readonly storyApplicationId?: string | null;
  readonly tags: string[];
  readonly startedAt: string | null;
  readonly completedAt: string | null;
  readonly cancelledAt: string | null;
  readonly cancelReason: string | null;
  readonly deletedAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface UpdateGoalSpaceInput {
  readonly name?: string;
  readonly description?: string;
  readonly constraints?: string[];
  readonly acceptanceCriteria?: Array<{ criterion: string; evidence: string[] }>;
}

export interface ListGoalSpacesQuery {
  readonly status?: GoalSpaceStatus;
  readonly page: number;
  readonly limit: number;
  readonly actor: { id: string; role: "initiator" | "chain_user" | "viewer" };
}

export interface NodeBoardCounts {
  readonly total: number;
  readonly active: number;
  readonly completed: number;
}

export type CardCounts = {
  [K in "backlog" | "todo" | "dev" | "review" | "done" | "blocked" | "cancelled"]: number;
};

// ─── write helpers (inside runWithAudit transaction) ──────────────

export function createGoalSpace(
  tx: AuditTx,
  initiatorId: string,
  input: CreateGoalSpaceRow,
  id: string,
  storyApplicationId?: string,
): GoalSpaceRow {
  const row = tx
    .insert(goalSpaces)
    .values({
      id,
      initiatorId,
      name: input.name,
      description: input.description,
      constraints: input.constraints,
      acceptanceCriteria: input.acceptanceCriteria,
      status: "draft",
      progress: 0,
      tags: [],
      storyApplicationId: storyApplicationId ?? null,
    })
    .returning()
    .get();
  return row as GoalSpaceRow;
}

export function updateGoalSpace(
  tx: AuditTx,
  id: string,
  input: UpdateGoalSpaceInput,
): GoalSpaceRow | null {
  const patch: Record<string, unknown> = {
    updatedAt: sql`(datetime('now'))`,
  };
  if (input.name !== undefined) patch.name = input.name;
  if (input.description !== undefined) patch.description = input.description;
  if (input.constraints !== undefined) patch.constraints = input.constraints;
  if (input.acceptanceCriteria !== undefined) patch.acceptanceCriteria = input.acceptanceCriteria;

  const row = tx
    .update(goalSpaces)
    .set(patch)
    .where(and(eq(goalSpaces.id, id), isNull(goalSpaces.deletedAt)))
    .returning()
    .get();
  return (row as GoalSpaceRow | undefined) ?? null;
}

export function startGoalSpace(tx: AuditTx, id: string, now: string): GoalSpaceRow | null {
  const row = tx
    .update(goalSpaces)
    .set({
      status: "active",
      startedAt: now,
      updatedAt: sql`(datetime('now'))`,
    })
    .where(and(eq(goalSpaces.id, id), isNull(goalSpaces.deletedAt)))
    .returning()
    .get();
  return (row as GoalSpaceRow | undefined) ?? null;
}

export function completeGoalSpace(tx: AuditTx, id: string, now: string): GoalSpaceRow | null {
  const row = tx
    .update(goalSpaces)
    .set({
      status: "completed",
      completedAt: now,
      updatedAt: sql`(datetime('now'))`,
    })
    .where(and(eq(goalSpaces.id, id), isNull(goalSpaces.deletedAt)))
    .returning()
    .get();
  return (row as GoalSpaceRow | undefined) ?? null;
}

export function cancelGoalSpace(
  tx: AuditTx,
  id: string,
  reason: string,
  now: string,
): GoalSpaceRow | null {
  const row = tx
    .update(goalSpaces)
    .set({
      status: "cancelled",
      cancelledAt: now,
      cancelReason: reason,
      updatedAt: sql`(datetime('now'))`,
    })
    .where(and(eq(goalSpaces.id, id), isNull(goalSpaces.deletedAt)))
    .returning()
    .get();
  return (row as GoalSpaceRow | undefined) ?? null;
}

// ─── read helpers ────────────────────────────────────────────────

export function getGoalSpaceById(db: DrizzleDb | AuditTx, id: string): GoalSpaceRow | null {
  const row = db
    .select()
    .from(goalSpaces)
    .where(and(eq(goalSpaces.id, id), isNull(goalSpaces.deletedAt)))
    .get();
  return (row as GoalSpaceRow | undefined) ?? null;
}

export function listGoalSpaces(
  db: DrizzleDb,
  query: ListGoalSpacesQuery,
): { items: GoalSpaceRow[]; total: number } {
  const filters = [isNull(goalSpaces.deletedAt)];

  if (query.status !== undefined) {
    filters.push(eq(goalSpaces.status, query.status));
  }

  // Per ADR-001: initiator sees own goal spaces; chain_user / viewer see
  // only goal spaces where they have a node_board membership.
  if (query.actor.role !== "initiator") {
    const memberGoalSpaceIds = db
      .select({ goalSpaceId: nodeBoards.goalSpaceId })
      .from(nodeBoardMembers)
      .innerJoin(nodeBoards, eq(nodeBoards.id, nodeBoardMembers.boardId))
      .where(and(eq(nodeBoardMembers.userId, query.actor.id), isNull(nodeBoardMembers.removedAt)));
    filters.push(sql`${goalSpaces.id} IN ${memberGoalSpaceIds}`);
  } else {
    filters.push(eq(goalSpaces.initiatorId, query.actor.id));
  }

  const totalRow = db
    .select({ value: count() })
    .from(goalSpaces)
    .where(and(...filters))
    .get();
  const total = totalRow?.value ?? 0;

  const items = db
    .select()
    .from(goalSpaces)
    .where(and(...filters))
    .orderBy(sql`${goalSpaces.createdAt} DESC`)
    .limit(query.limit)
    .offset((query.page - 1) * query.limit)
    .all() as GoalSpaceRow[];

  return { items, total };
}

export function countNodeBoardsForGoalSpace(db: DrizzleDb, goalSpaceId: string): NodeBoardCounts {
  const rows = db
    .select({ status: nodeBoards.status, value: count() })
    .from(nodeBoards)
    .where(and(eq(nodeBoards.goalSpaceId, goalSpaceId), isNull(nodeBoards.deletedAt)))
    .groupBy(nodeBoards.status)
    .all() as Array<{ status: string; value: number }>;

  let total = 0;
  let active = 0;
  let completed = 0;
  for (const row of rows) {
    total += row.value;
    if (row.status === "active") active += row.value;
    if (row.status === "completed") completed += row.value;
  }
  return { total, active, completed };
}

export function countCardsForGoalSpace(db: DrizzleDb, goalSpaceId: string): CardCounts {
  const rows = db
    .select({ state: cards.state, value: count() })
    .from(cards)
    .where(and(eq(cards.goalSpaceId, goalSpaceId), isNull(cards.deletedAt)))
    .groupBy(cards.state)
    .all() as Array<{ state: string; value: number }>;

  const counts: CardCounts = {
    backlog: 0,
    todo: 0,
    dev: 0,
    review: 0,
    done: 0,
    blocked: 0,
    cancelled: 0,
  };
  for (const row of rows) {
    if (row.state in counts) {
      (counts as Record<string, number>)[row.state] = row.value;
    }
  }
  return counts;
}

// ─── authorization context ────────────────────────────────────────

/**
 * Resolve the goal space and its node_board member ids in a single
 * query path. The first select is the goal space row; the second is
 * the distinct member ids. Callers that only need the row can stop
 * after the first; callers that need `GoalSpaceContext` for
 * authorization must consume both.
 */
export function getGoalSpaceWithMembers(
  db: DrizzleDb,
  goalSpaceId: string,
): { row: GoalSpaceRow; memberIds: string[] } | null {
  const row = getGoalSpaceById(db, goalSpaceId);
  if (!row) return null;

  const memberRows = db
    .selectDistinct({ userId: nodeBoardMembers.userId })
    .from(nodeBoardMembers)
    .innerJoin(nodeBoards, eq(nodeBoards.id, nodeBoardMembers.boardId))
    .where(and(eq(nodeBoards.goalSpaceId, goalSpaceId), isNull(nodeBoardMembers.removedAt)))
    .all() as Array<{ userId: string }>;

  return { row, memberIds: memberRows.map((m) => m.userId) };
}

/**
 * Build a `GoalSpaceContext` for `canReadGoalSpace` / `canManageGoalSpace`.
 * The context carries the goal space's initiator id and the set of
 * node_board member ids for the goal space.
 */
export function getGoalSpaceContext(
  db: DrizzleDb,
  goalSpaceId: string,
): {
  goalSpaceId: string;
  initiatorId: string;
  nodeBoardMemberIds: string[];
} | null {
  const result = getGoalSpaceWithMembers(db, goalSpaceId);
  if (!result) return null;
  return {
    goalSpaceId,
    initiatorId: result.row.initiatorId,
    nodeBoardMemberIds: result.memberIds,
  };
}

// ─── complete preconditions (read inside the same transaction) ────

export interface CompletePreconditions {
  readonly hasPendingConfirmation: boolean;
  readonly hasBlockedCard: boolean;
  readonly allCardsDoneOrCancelled: boolean;
}

export function readCompletePreconditions(
  db: DrizzleDb | AuditTx,
  goalSpaceId: string,
): CompletePreconditions {
  // pending human_confirmations on any card of this goal space
  const pendingRow = db
    .select({ value: count() })
    .from(humanConfirmations)
    .innerJoin(cards, eq(cards.id, humanConfirmations.cardId))
    .where(
      and(
        eq(cards.goalSpaceId, goalSpaceId),
        eq(humanConfirmations.status, "pending"),
        isNull(cards.deletedAt),
      ),
    )
    .get();

  // cards in 'blocked' state
  const blockedRow = db
    .select({ value: count() })
    .from(cards)
    .where(
      and(eq(cards.goalSpaceId, goalSpaceId), eq(cards.state, "blocked"), isNull(cards.deletedAt)),
    )
    .get();

  // non-terminal cards (not done and not cancelled)
  const nonTerminalRow = db
    .select({ value: count() })
    .from(cards)
    .where(
      and(
        eq(cards.goalSpaceId, goalSpaceId),
        isNull(cards.deletedAt),
        sql`${cards.state} NOT IN ('done', 'cancelled')`,
      ),
    )
    .get();

  return {
    hasPendingConfirmation: (pendingRow?.value ?? 0) > 0,
    hasBlockedCard: (blockedRow?.value ?? 0) > 0,
    allCardsDoneOrCancelled: (nonTerminalRow?.value ?? 0) === 0,
  };
}

// ─── cancel summary counts (read inside the same transaction) ─────

export interface CancelSummaryCounts {
  readonly total: number;
  readonly done: number;
  readonly cancelled: number;
  readonly blocked: number;
}

export function readCancelSummary(
  db: DrizzleDb | AuditTx,
  goalSpaceId: string,
): CancelSummaryCounts {
  const rows = db
    .select({ state: cards.state, value: count() })
    .from(cards)
    .where(and(eq(cards.goalSpaceId, goalSpaceId), isNull(cards.deletedAt)))
    .groupBy(cards.state)
    .all() as Array<{ state: string; value: number }>;

  let total = 0;
  let done = 0;
  let cancelled = 0;
  let blocked = 0;
  for (const row of rows) {
    total += row.value;
    if (row.state === "done") done += row.value;
    if (row.state === "cancelled") cancelled += row.value;
    if (row.state === "blocked") blocked += row.value;
  }
  return { total, done, cancelled, blocked };
}

// ─── unused-but-referenced symbols (keep import site clean) ────────

// `users` is imported above to make the dependency explicit for the
// authorization context even though we currently rely on
// `goal_spaces.initiator_id` directly. Removing the import would force
// the next maintainer to re-add it; keep it as a comment for the linter.
void users;
