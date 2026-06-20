/**
 * Card repository (F2-05).
 *
 * Focused query/write helpers used by `apps/web/src/lib/services/cards.ts`.
 * Read helpers take the production `DrizzleDb`; write helpers take the
 * `AuditTx` produced by `runWithAudit` so the lifecycle write shares a
 * single transaction with the audit entry, realtime event, and (for
 * state-changing writes) the state_transitions row.
 *
 * Soft delete: `cards.deleted_at IS NULL` on all reads. No restore path
 * in F2-05.
 */

import { and, eq, isNull, sql } from "drizzle-orm";
import {
  cards,
  goalSpaces,
  humanConfirmations,
  nodeBoardMembers,
  stateTransitions,
  type CardState,
  type RiskLevel,
} from "@db/schema";
import type { DrizzleDb } from "@/lib/db/client";
import type { AuditTx } from "@/lib/audit/run-with-audit";

// ─── types ─────────────────────────────────────────────────────────

export interface CardRow {
  readonly id: string;
  readonly goalSpaceId: string;
  readonly nodeBoardId: string;
  readonly displayId: string;
  readonly title: string;
  readonly description: string | null;
  readonly state: CardState;
  readonly assignedTo: string | null;
  readonly priority: number;
  readonly riskLevel: RiskLevel;
  readonly evidence: Record<string, unknown>[];
  readonly confidence: number | null;
  readonly dependencies: string[];
  readonly tags: string[];
  readonly context: Record<string, unknown>;
  readonly blockedReason: string | null;
  readonly blockedAt: string | null;
  readonly cancelledReason: string | null;
  readonly cancelledAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly deletedAt: string | null;
}

export interface CreateCardInput {
  readonly id: string;
  readonly goalSpaceId: string;
  readonly nodeBoardId: string;
  readonly displayId: string;
  readonly title: string;
  readonly description: string | null;
  readonly assignedTo: string | null;
  readonly priority: number;
  readonly riskLevel: RiskLevel;
  readonly dependencies: string[];
  readonly tags: string[];
}

export interface UpdateCardInput {
  readonly title?: string;
  readonly description?: string | null;
  readonly assignedTo?: string | null;
  readonly priority?: number;
  readonly riskLevel?: RiskLevel;
  readonly tags?: string[];
}

export interface BlockCardInput {
  readonly blockedReason: string;
  readonly blockedAt: string;
}

export interface UnblockCardInput {
  readonly blockedReason: null;
  readonly blockedAt: null;
}

export interface ListCardsQuery {
  readonly state?: CardState;
  readonly assignedTo?: string;
  readonly tags?: readonly string[];
}

export interface CardContextRow {
  readonly card: CardRow;
  readonly goalSpaceId: string;
  readonly goalSpaceInitiatorId: string;
  readonly nodeBoardMemberIds: readonly string[];
  readonly hasPendingConfirmation: boolean;
}

// ─── write helpers (inside runWithAudit transaction) ──────────────

export function createCard(tx: AuditTx, input: CreateCardInput): CardRow {
  const row = tx
    .insert(cards)
    .values({
      id: input.id,
      goalSpaceId: input.goalSpaceId,
      nodeBoardId: input.nodeBoardId,
      displayId: input.displayId,
      title: input.title,
      description: input.description,
      state: "backlog",
      assignedTo: input.assignedTo,
      priority: input.priority,
      riskLevel: input.riskLevel,
      dependencies: input.dependencies,
      tags: input.tags,
    })
    .returning()
    .get();
  return row as CardRow;
}

export function updateCard(tx: AuditTx, id: string, input: UpdateCardInput): CardRow | null {
  const patch: Record<string, unknown> = {
    updatedAt: sql`(datetime('now'))`,
  };
  if (input.title !== undefined) patch.title = input.title;
  if (input.description !== undefined) patch.description = input.description;
  if (input.assignedTo !== undefined) patch.assignedTo = input.assignedTo;
  if (input.priority !== undefined) patch.priority = input.priority;
  if (input.riskLevel !== undefined) patch.riskLevel = input.riskLevel;
  if (input.tags !== undefined) patch.tags = input.tags;

  const row = tx
    .update(cards)
    .set(patch)
    .where(and(eq(cards.id, id), isNull(cards.deletedAt)))
    .returning()
    .get();
  return (row as CardRow | undefined) ?? null;
}

export function updateCardState(
  tx: AuditTx,
  id: string,
  patch: Record<string, unknown>,
): CardRow | null {
  const fullPatch = { ...patch, updatedAt: sql`(datetime('now'))` };
  const row = tx
    .update(cards)
    .set(fullPatch)
    .where(and(eq(cards.id, id), isNull(cards.deletedAt)))
    .returning()
    .get();
  return (row as CardRow | undefined) ?? null;
}

export function insertStateTransition(
  tx: AuditTx,
  input: {
    readonly cardId: string;
    readonly entityType: "card";
    readonly entityId: string;
    readonly fromState: string | null;
    readonly toState: string;
    readonly trigger: string;
    readonly actor: "human" | "ai_role" | "system";
    readonly actorId: string | null;
    readonly actorName: string | null;
    readonly reason: string | null;
  },
): void {
  tx.insert(stateTransitions)
    .values({
      cardId: input.cardId,
      entityType: input.entityType,
      entityId: input.entityId,
      fromState: input.fromState,
      toState: input.toState,
      trigger: input.trigger,
      actor: input.actor,
      actorId: input.actorId,
      actorName: input.actorName,
      reason: input.reason,
    })
    .run();
}

// ─── read helpers ────────────────────────────────────────────────

export function getCardById(db: DrizzleDb | AuditTx, id: string): CardRow | null {
  const row = db
    .select()
    .from(cards)
    .where(and(eq(cards.id, id), isNull(cards.deletedAt)))
    .get();
  return (row as CardRow | undefined) ?? null;
}

/**
 * Compute the next `display_id` for a goal space. Returns `"CARD-001"` when
 * the goal space has no cards yet. Uses MAX(CAST(SUBSTR(display_id, 6) AS INTEGER))
 * which is safe under better-sqlite3's single-threaded model.
 */
export function nextCardDisplayId(tx: AuditTx, goalSpaceId: string): string {
  const row = tx
    .select({
      max: sql<number | null>`MAX(CAST(SUBSTR(${cards.displayId}, 6) AS INTEGER))`,
    })
    .from(cards)
    .where(and(eq(cards.goalSpaceId, goalSpaceId), isNull(cards.deletedAt)))
    .get();
  const next = (row?.max ?? 0) + 1;
  return `CARD-${String(next).padStart(3, "0")}`;
}

/**
 * Build the goal-space context for a card. Returns `null` when the goal
 * space is missing or the card's node board is missing.
 *
 * Performs 4 queries (in order):
 *   1. cards row
 *   2. node board member ids (the card's node board only)
 *   3. goal space initiator id
 *   4. pending human confirmation count for the card
 */
export function getCardContext(db: DrizzleDb | AuditTx, cardId: string): CardContextRow | null {
  const card = getCardById(db, cardId);
  if (!card) return null;

  const memberRows = db
    .selectDistinct({ userId: nodeBoardMembers.userId })
    .from(nodeBoardMembers)
    .where(and(eq(nodeBoardMembers.boardId, card.nodeBoardId), isNull(nodeBoardMembers.removedAt)))
    .all() as Array<{ userId: string }>;

  const goalSpaceRow = db
    .select({ initiatorId: goalSpaces.initiatorId })
    .from(goalSpaces)
    .where(and(eq(goalSpaces.id, card.goalSpaceId), isNull(goalSpaces.deletedAt)))
    .get() as { initiatorId: string } | undefined;

  if (!goalSpaceRow) return null;

  const pendingRow = db
    .select({ value: sql<number>`COUNT(*)` })
    .from(humanConfirmations)
    .where(and(eq(humanConfirmations.cardId, cardId), eq(humanConfirmations.status, "pending")))
    .get();

  return {
    card,
    goalSpaceId: card.goalSpaceId,
    goalSpaceInitiatorId: goalSpaceRow.initiatorId,
    nodeBoardMemberIds: memberRows.map((m) => m.userId),
    hasPendingConfirmation: (pendingRow?.value ?? 0) > 0,
  };
}

/**
 * List cards in a goal space.
 *   - initiator: returns every non-deleted card.
 *   - non-initiator: returns cards whose `node_board_id` matches a node
 *     board the actor is a member of, OR whose `assigned_to === actor.id`.
 *   - Optional filters: state, assignedTo, tags (comma-separated).
 */
export function listCardsForGoalSpace(
  db: DrizzleDb,
  goalSpaceId: string,
  actor: { id: string; role: "initiator" | "chain_user" | "viewer" },
  filters: ListCardsQuery,
): { items: CardRow[]; total: number } {
  const conds = [eq(cards.goalSpaceId, goalSpaceId), isNull(cards.deletedAt)];

  if (filters.state !== undefined) {
    conds.push(eq(cards.state, filters.state));
  }
  if (filters.assignedTo !== undefined) {
    conds.push(eq(cards.assignedTo, filters.assignedTo));
  }
  if (filters.tags && filters.tags.length > 0) {
    // SQLite has no native JSONB operators; LIKE on JSON-serialized tags is
    // the documented F-001 adaptation.
    for (const tag of filters.tags) {
      conds.push(sql`${cards.tags} LIKE ${`%"${tag}"%`}`);
    }
  }

  if (actor.role !== "initiator") {
    const memberBoardIds = db
      .selectDistinct({ boardId: nodeBoardMembers.boardId })
      .from(nodeBoardMembers)
      .where(and(eq(nodeBoardMembers.userId, actor.id), isNull(nodeBoardMembers.removedAt)))
      .all() as Array<{ boardId: string }>;
    const boardIds = memberBoardIds.map((m) => m.boardId);
    if (boardIds.length === 0) {
      // No board memberships — only cards explicitly assigned to the actor
      // would be visible.
      conds.push(sql`(${cards.assignedTo} = ${actor.id} AND FALSE)`);
    } else {
      const placeholders = boardIds.map((b) => sql`${b}`);
      conds.push(
        sql`(${cards.nodeBoardId} IN (${sql.join(placeholders, sql`, `)}) OR ${cards.assignedTo} = ${actor.id})`,
      );
    }
  }

  const items = db
    .select()
    .from(cards)
    .where(and(...conds))
    .orderBy(sql`${cards.createdAt} ASC`)
    .all() as CardRow[];
  return { items, total: items.length };
}

export function listTransitionsForCard(
  db: DrizzleDb | AuditTx,
  cardId: string,
): Array<{
  readonly id: string;
  readonly cardId: string;
  readonly sessionId: string | null;
  readonly entityType: string;
  readonly entityId: string;
  readonly fromState: string | null;
  readonly toState: string;
  readonly trigger: string;
  readonly actor: string;
  readonly actorName: string | null;
  readonly actorId: string | null;
  readonly reason: string | null;
  readonly metadata: Record<string, unknown>;
  readonly timestamp: string;
}> {
  return db
    .select()
    .from(stateTransitions)
    .where(and(eq(stateTransitions.cardId, cardId), eq(stateTransitions.entityType, "card")))
    .orderBy(sql`${stateTransitions.timestamp} ASC`)
    .all() as Array<{
    readonly id: string;
    readonly cardId: string;
    readonly sessionId: string | null;
    readonly entityType: string;
    readonly entityId: string;
    readonly fromState: string | null;
    readonly toState: string;
    readonly trigger: string;
    readonly actor: string;
    readonly actorName: string | null;
    readonly actorId: string | null;
    readonly reason: string | null;
    readonly metadata: Record<string, unknown>;
    readonly timestamp: string;
  }>;
}

export function listConfirmationsForCard(
  db: DrizzleDb | AuditTx,
  cardId: string,
): Array<{
  readonly id: string;
  readonly cardId: string;
  readonly status: string;
  readonly triggerType: string;
  readonly targetState: string | null;
  readonly triggeredAt: string | null;
}> {
  // Minimal shape: only what the detail endpoint surfaces inline.
  return db
    .select({
      id: humanConfirmations.id,
      cardId: humanConfirmations.cardId,
      status: humanConfirmations.status,
      triggerType: humanConfirmations.triggerType,
      targetState: humanConfirmations.targetState,
      triggeredAt: humanConfirmations.triggeredAt,
    })
    .from(humanConfirmations)
    .where(eq(humanConfirmations.cardId, cardId))
    .orderBy(sql`${humanConfirmations.triggeredAt} ASC`)
    .all() as Array<{
    readonly id: string;
    readonly cardId: string;
    readonly status: string;
    readonly triggerType: string;
    readonly targetState: string | null;
    readonly triggeredAt: string | null;
  }>;
}

export function listAuditTrailForCard(
  db: DrizzleDb | AuditTx,
  cardId: string,
  limit = 50,
): Array<{
  readonly id: string;
  readonly entityType: string;
  readonly entityId: string;
  readonly action: string;
  readonly actor: string;
  readonly actorId: string | null;
  readonly beforeState: Record<string, unknown> | null;
  readonly afterState: Record<string, unknown> | null;
  readonly details: Record<string, unknown>;
  readonly timestamp: string;
}> {
  return db
    .select({
      id: sql<string>`audit_entries.id`,
      entityType: sql<string>`audit_entries.entity_type`,
      entityId: sql<string>`audit_entries.entity_id`,
      action: sql<string>`audit_entries.action`,
      actor: sql<string>`audit_entries.actor`,
      actorId: sql<string | null>`audit_entries.actor_id`,
      beforeState: sql<Record<string, unknown> | null>`audit_entries.before_state`,
      afterState: sql<Record<string, unknown> | null>`audit_entries.after_state`,
      details: sql<Record<string, unknown>>`audit_entries.details`,
      timestamp: sql<string>`audit_entries.timestamp`,
    })
    .from(sql`audit_entries`)
    .where(and(sql`audit_entries.entity_type = 'card'`, sql`audit_entries.entity_id = ${cardId}`))
    .orderBy(sql`audit_entries.timestamp DESC`)
    .limit(limit)
    .all() as Array<{
    readonly id: string;
    readonly entityType: string;
    readonly entityId: string;
    readonly action: string;
    readonly actor: string;
    readonly actorId: string | null;
    readonly beforeState: Record<string, unknown> | null;
    readonly afterState: Record<string, unknown> | null;
    readonly details: Record<string, unknown>;
    readonly timestamp: string;
  }>;
}
