/**
 * Human Confirmation repository (F2-06).
 *
 * Focused query/write helpers used by
 * `apps/web/src/lib/services/confirmations.ts`. Read helpers take the
 * production `DrizzleDb`; write helpers take the `AuditTx` produced by
 * `runWithAudit` so the confirmation update shares a single transaction
 * with the audit entry, realtime event, and (for state-changing
 * decisions) the card update + state_transitions row.
 *
 * Soft delete on `cards.deleted_at`: confirmation reads filter
 * `cards.deleted_at IS NULL`. The partial unique index
 * `idx_human_confirmations_card_pending` enforces at most one `pending`
 * confirmation per card — created-side guarantee, not enforced here.
 */

import { and, eq, isNull, sql } from "drizzle-orm";
import {
  cards,
  goalSpaces,
  humanConfirmations,
  nodeBoardMembers,
  type ConfirmationStatus,
} from "@db/schema";
import type { DrizzleDb } from "@/lib/db/client";
import type { AuditTx } from "@/lib/audit/run-with-audit";

// ─── types ─────────────────────────────────────────────────────────

export interface ConfirmationRow {
  readonly id: string;
  readonly cardId: string;
  readonly triggerType: string;
  readonly targetState: string | null;
  readonly triggerReason: string | null;
  readonly triggeredBy: string | null;
  readonly triggeredAt: string | null;
  readonly aiSummary: string | null;
  readonly riskFactors: Record<string, unknown>[];
  readonly recommendations: Record<string, unknown>[];
  readonly aiConfidence: number | null;
  readonly riskLevel: string;
  readonly context: Record<string, unknown>;
  readonly status: ConfirmationStatus;
  readonly decisionOutcome: string | null;
  readonly decisionBy: string | null;
  readonly decisionReason: string | null;
  readonly decisionComment: string | null;
  readonly decidedAt: string | null;
  readonly resolvedAt: string | null;
  readonly expiresAt: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface ConfirmationListRow extends ConfirmationRow {
  readonly cardTitle: string;
  readonly cardState: string;
}

export interface DecisionUpdateInput {
  readonly status: ConfirmationStatus;
  readonly decisionOutcome: "approved" | "rejected";
  readonly decisionBy: string;
  readonly decisionReason: string | null;
  readonly decisionComment: string | null;
  readonly decidedAt: string;
  readonly resolvedAt: string;
}

export interface ConfirmationContextRow {
  readonly confirmation: ConfirmationRow;
  readonly cardId: string;
  readonly cardState: string;
  readonly goalSpaceId: string;
  readonly goalSpaceInitiatorId: string;
  readonly nodeBoardMemberIds: readonly string[];
  readonly confirmationStatus: ConfirmationStatus;
}

// ─── read helpers ────────────────────────────────────────────────

export function getConfirmationById(db: DrizzleDb, id: string): ConfirmationRow | null {
  const row = db.select().from(humanConfirmations).where(eq(humanConfirmations.id, id)).get();
  return (row as ConfirmationRow | undefined) ?? null;
}

/**
 * Load a confirmation plus the card + goal-space context needed for
 * `canDecideConfirmation`. Performs 1 join query.
 *
 * Returns `null` when the confirmation or its card is missing (including
 * soft-deleted cards or goal spaces — R5 defensive guard).
 */
export function getConfirmationContext(
  db: DrizzleDb,
  confirmationId: string,
): ConfirmationContextRow | null {
  const row = db
    .select({
      id: humanConfirmations.id,
      cardId: humanConfirmations.cardId,
      cardTitle: cards.title,
      cardState: cards.state,
      cardGoalSpaceId: cards.goalSpaceId,
      cardDeletedAt: cards.deletedAt,
      goalSpaceInitiatorId: goalSpaces.initiatorId,
      goalSpaceDeletedAt: goalSpaces.deletedAt,
      triggerType: humanConfirmations.triggerType,
      targetState: humanConfirmations.targetState,
      triggerReason: humanConfirmations.triggerReason,
      triggeredBy: humanConfirmations.triggeredBy,
      triggeredAt: humanConfirmations.triggeredAt,
      aiSummary: humanConfirmations.aiSummary,
      riskFactors: humanConfirmations.riskFactors,
      recommendations: humanConfirmations.recommendations,
      aiConfidence: humanConfirmations.aiConfidence,
      riskLevel: humanConfirmations.riskLevel,
      context: humanConfirmations.context,
      status: humanConfirmations.status,
      decisionOutcome: humanConfirmations.decisionOutcome,
      decisionBy: humanConfirmations.decisionBy,
      decisionReason: humanConfirmations.decisionReason,
      decisionComment: humanConfirmations.decisionComment,
      decidedAt: humanConfirmations.decidedAt,
      resolvedAt: humanConfirmations.resolvedAt,
      expiresAt: humanConfirmations.expiresAt,
      createdAt: humanConfirmations.createdAt,
      updatedAt: humanConfirmations.updatedAt,
    })
    .from(humanConfirmations)
    .innerJoin(cards, eq(cards.id, humanConfirmations.cardId))
    .innerJoin(goalSpaces, eq(goalSpaces.id, cards.goalSpaceId))
    .where(eq(humanConfirmations.id, confirmationId))
    .get() as
    | (ConfirmationRow & {
        cardTitle: string;
        cardState: string;
        cardGoalSpaceId: string;
        cardDeletedAt: string | null;
        goalSpaceInitiatorId: string;
        goalSpaceDeletedAt: string | null;
      })
    | undefined;

  if (!row) return null;
  // Defensive R5: only treat as deleted when the column is a non-null string.
  if (row.cardDeletedAt) return null;
  if (row.goalSpaceDeletedAt) return null;

  return {
    confirmation: row,
    cardId: row.cardId,
    cardState: row.cardState,
    goalSpaceId: row.cardGoalSpaceId,
    goalSpaceInitiatorId: row.goalSpaceInitiatorId,
    // Decide-path authorization (initiator-only) does not require
    // node-board member ids. The field is reserved for S4+ per-member
    // co-sign / approval thread (per COR-012). See ConfirmationContext
    // JSDoc in `apps/web/src/lib/authorization/types.ts`.
    nodeBoardMemberIds: [],
    confirmationStatus: row.status,
  };
}

/**
 * List confirmations visible to an actor.
 *   - initiator: every non-deleted confirmation whose card is in a goal
 *     space they initiated.
 *   - non-initiator: confirmations on cards the actor can read
 *     (`node_board_id` in member boards OR `assigned_to = actor.id`).
 *   - Optional `status` filter.
 *   - Paginated via `page` + `limit`; defaults applied at the route.
 */
export function listConfirmationsForActor(
  db: DrizzleDb,
  actor: { id: string; role: "initiator" | "chain_user" | "viewer" },
  filters: { status?: ConfirmationStatus; page: number; limit: number },
): { items: ConfirmationListRow[]; total: number } {
  const conds: ReturnType<typeof eq>[] = [];
  conds.push(isNull(cards.deletedAt));
  conds.push(isNull(goalSpaces.deletedAt));
  if (filters.status !== undefined) {
    conds.push(eq(humanConfirmations.status, filters.status));
  }

  if (actor.role === "initiator") {
    conds.push(eq(goalSpaces.initiatorId, actor.id));
  } else {
    // chain_user / viewer: card accessibility filter.
    const memberBoardIds = db
      .selectDistinct({ boardId: nodeBoardMembers.boardId })
      .from(nodeBoardMembers)
      .where(and(eq(nodeBoardMembers.userId, actor.id), isNull(nodeBoardMembers.removedAt)))
      .all() as Array<{ boardId: string }>;
    const boardIds = memberBoardIds.map((m) => m.boardId);
    if (boardIds.length === 0) {
      // No board memberships — only cards explicitly assigned to the actor
      // are accessible.
      conds.push(eq(cards.assignedTo, actor.id));
    } else {
      const placeholders = boardIds.map((b) => sql`${b}`);
      conds.push(
        sql`(${cards.nodeBoardId} IN (${sql.join(placeholders, sql`, `)}) OR ${cards.assignedTo} = ${actor.id})`,
      );
    }
  }

  const items = db
    .select({
      id: humanConfirmations.id,
      cardId: humanConfirmations.cardId,
      cardTitle: cards.title,
      cardState: cards.state,
      triggerType: humanConfirmations.triggerType,
      targetState: humanConfirmations.targetState,
      triggerReason: humanConfirmations.triggerReason,
      triggeredBy: humanConfirmations.triggeredBy,
      triggeredAt: humanConfirmations.triggeredAt,
      aiSummary: humanConfirmations.aiSummary,
      riskFactors: humanConfirmations.riskFactors,
      recommendations: humanConfirmations.recommendations,
      aiConfidence: humanConfirmations.aiConfidence,
      riskLevel: humanConfirmations.riskLevel,
      context: humanConfirmations.context,
      status: humanConfirmations.status,
      decisionOutcome: humanConfirmations.decisionOutcome,
      decisionBy: humanConfirmations.decisionBy,
      decisionReason: humanConfirmations.decisionReason,
      decisionComment: humanConfirmations.decisionComment,
      decidedAt: humanConfirmations.decidedAt,
      resolvedAt: humanConfirmations.resolvedAt,
      expiresAt: humanConfirmations.expiresAt,
      createdAt: humanConfirmations.createdAt,
      updatedAt: humanConfirmations.updatedAt,
    })
    .from(humanConfirmations)
    .innerJoin(cards, eq(cards.id, humanConfirmations.cardId))
    .innerJoin(goalSpaces, eq(goalSpaces.id, cards.goalSpaceId))
    .where(and(...conds))
    .orderBy(sql`${humanConfirmations.createdAt} DESC`)
    .limit(filters.limit)
    .offset((filters.page - 1) * filters.limit)
    .all() as ConfirmationListRow[];

  return { items, total: items.length };
}

// ─── write helpers (inside runWithAudit transaction) ──────────────

export function updateConfirmationDecision(
  tx: AuditTx,
  id: string,
  input: DecisionUpdateInput,
): ConfirmationRow | null {
  const row = tx
    .update(humanConfirmations)
    .set({
      status: input.status,
      decisionOutcome: input.decisionOutcome,
      decisionBy: input.decisionBy,
      decisionReason: input.decisionReason,
      decisionComment: input.decisionComment,
      decidedAt: input.decidedAt,
      resolvedAt: input.resolvedAt,
      updatedAt: sql`(datetime('now'))`,
    })
    .where(eq(humanConfirmations.id, id))
    .returning()
    .get();
  return (row as ConfirmationRow | undefined) ?? null;
}
