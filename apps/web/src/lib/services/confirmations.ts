/**
 * Human Confirmation service (F2-06).
 *
 * Transactional application services for the documented REST endpoints
 * in `docs/specs/interface_spec.md § 6`. Each decision write is wrapped
 * in `runWithAudit` so the confirmation status update, audit entry,
 * realtime event, and (for state-changing decisions) the card update +
 * `state_transitions` row share a single `better-sqlite3` transaction.
 *
 * Authorization: `canDecideConfirmation` (per
 * `docs/specs/authorization_matrix.md § 3` and § 4). The helper
 * already encodes two invariants: (1) only the goal-space initiator
 * can decide; (2) only `status === 'pending'` confirmations are
 * decidable.
 *
 * State machine: `assertTransition` (per F-002 + ADR-002):
 *   - approve with `target_state` → tuple `(currentState, target_state, human_confirm)`
 *   - reject → tuple `(currentState, 'blocked', human_reject)`
 *   Both tuples are in `CARD_TRANSITIONS` for all non-terminal from-states.
 *
 * Human decisions bypass the (from, to, trigger) tuple restriction in
 * CARD_TRANSITIONS: the only `(X, Y, human_confirm)` tuple is
 * `(review, done)`, but human approvals can target any non-terminal
 * state (per `docs/specs/interface_spec.md § 6.2` literal text "卡片流转到
 * 确认记录中的 `target_state`"). The service validates `target_state`
 * against `isValidState` and rejects terminal targets.
 *
 * Realtime event type names are exported as constants so F2-08 SSE
 * filtering has a single source of truth. Note the existing schema
 * inconsistency: `audit_entries.entity_type = 'confirm'` (not
 * 'confirmation') while `realtime_events.resource_type = 'confirmation'`.
 */

import { CONFIRMATION_STATUS_VALUES, type ConfirmationStatus } from "@db/schema";

import { ApiRequestError } from "@/lib/api/errors";
import { runWithAudit, type AuditContext } from "@/lib/audit/run-with-audit";
import { canDecideConfirmation } from "@/lib/authorization/confirmation";
import type { Actor, ConfirmationContext } from "@/lib/authorization/types";
import { getDb, type DrizzleDb } from "@/lib/db/client";
import { insertStateTransition, updateCardState } from "@/lib/db/repositories/cards";
import {
  getConfirmationContext,
  listConfirmationsForActor,
  updateConfirmationDecision,
  type ConfirmationListRow,
  type ConfirmationRow,
} from "@/lib/db/repositories/confirmations";
import { isTerminalState, isValidState } from "@/lib/state-machine";

// ─── realtime event constants (F2-08 handoff) ──────────────────────

export const HUMAN_CONFIRMATION_REALTIME_EVENTS = {
  approved: "human_confirmation.approved",
  rejected: "human_confirmation.rejected",
} as const;

export const HUMAN_CONFIRMATION_AUDIT_ENTITY_TYPE = "confirm" as const;

export const HUMAN_CONFIRMATION_REALTIME_RESOURCE_TYPE = "confirmation" as const;

// ─── response shapes (per docs/specs/interface_spec.md § 6) ────────

export interface HumanConfirmationDecision {
  readonly outcome: "approved" | "rejected";
  readonly decided_by: string;
  readonly decided_at: string;
  readonly comment: string | null;
  readonly reason: string | null;
}

export interface HumanConfirmationResponse {
  readonly id: string;
  readonly card_id: string;
  readonly card_title: string;
  readonly status: ConfirmationStatus;
  readonly trigger_type: string;
  readonly trigger_reason: string | null;
  readonly triggered_by: string | null;
  readonly triggered_at: string | null;
  readonly ai_summary: string | null;
  readonly risk_factors: ReadonlyArray<Record<string, unknown>>;
  readonly recommendations: ReadonlyArray<Record<string, unknown>>;
  readonly ai_confidence: number | null;
  readonly target_state: string | null;
  readonly decision?: HumanConfirmationDecision;
  readonly expires_at: string;
  readonly created_at: string;
}

export interface ConfirmationListResponse {
  readonly items: readonly HumanConfirmationResponse[];
  readonly total: number;
}

export interface DecideConfirmationResponse {
  readonly id: string;
  readonly status: "approved" | "rejected";
  readonly decided_by: string;
  readonly decided_at: string;
  readonly card_state_changed: boolean;
  readonly new_card_state?: string;
}

// ─── input shapes ────────────────────────────────────────────────

export interface DecideConfirmationInput {
  readonly outcome: "approved" | "rejected";
  readonly comment?: string;
  readonly reason?: string;
}

// ─── helpers ─────────────────────────────────────────────────────

function nowIso(): string {
  return new Date().toISOString();
}

function toResponse(row: ConfirmationListRow): HumanConfirmationResponse {
  const response: HumanConfirmationResponse = {
    id: row.id,
    card_id: row.cardId,
    card_title: row.cardTitle,
    status: row.status,
    trigger_type: row.triggerType,
    trigger_reason: row.triggerReason,
    triggered_by: row.triggeredBy,
    triggered_at: row.triggeredAt,
    ai_summary: row.aiSummary,
    risk_factors: row.riskFactors,
    recommendations: row.recommendations,
    ai_confidence: row.aiConfidence,
    target_state: row.targetState,
    expires_at: row.expiresAt,
    created_at: row.createdAt,
  };
  if (row.status !== "pending" && row.decisionOutcome && row.decidedAt && row.decisionBy) {
    return {
      ...response,
      decision: {
        outcome: row.decisionOutcome as "approved" | "rejected",
        decided_by: row.decisionBy,
        decided_at: row.decidedAt,
        comment: row.decisionComment,
        reason: row.decisionReason,
      },
    };
  }
  return response;
}

function asConfirmationContext(
  ctx: NonNullable<ReturnType<typeof getConfirmationContext>>,
): ConfirmationContext {
  return {
    confirmationId: ctx.confirmation.id,
    cardId: ctx.cardId,
    goalSpaceId: ctx.goalSpaceId,
    goalSpaceInitiatorId: ctx.goalSpaceInitiatorId,
    nodeBoardMemberIds: ctx.nodeBoardMemberIds,
    confirmationStatus: ctx.confirmationStatus,
  };
}

function validateStatus(value: unknown): ConfirmationStatus {
  if (
    typeof value !== "string" ||
    !(CONFIRMATION_STATUS_VALUES as readonly string[]).includes(value)
  ) {
    throw new ApiRequestError(
      "INVALID_FIELD",
      `status must be one of: ${CONFIRMATION_STATUS_VALUES.join(", ")}.`,
    );
  }
  return value as ConfirmationStatus;
}

function validateOutcome(value: unknown): "approved" | "rejected" {
  if (value !== "approved" && value !== "rejected") {
    throw new ApiRequestError(
      "VALIDATION_ERROR",
      "outcome must be either 'approved' or 'rejected'.",
    );
  }
  return value;
}

// ─── service: list confirmations ──────────────────────────────────

export function listConfirmationsService(
  actor: Actor,
  filters: { status?: ConfirmationStatus; page: number; limit: number },
  db: DrizzleDb = getDb(),
): ConfirmationListResponse {
  let status: ConfirmationStatus | undefined = filters.status;
  if (status !== undefined) {
    status = validateStatus(status);
  }
  const { items, total } = listConfirmationsForActor(db, actor, {
    ...(status !== undefined ? { status } : {}),
    page: filters.page,
    limit: filters.limit,
  });
  return { items: items.map(toResponse), total };
}

// ─── service: decide confirmation ─────────────────────────────────

export function decideConfirmationService(
  confirmationId: string,
  input: DecideConfirmationInput,
  actor: Actor,
  db: DrizzleDb = getDb(),
): DecideConfirmationResponse {
  const outcome = validateOutcome(input.outcome);

  // On reject: reason is required (per interface spec § 6.2).
  if (outcome === "rejected") {
    if (typeof input.reason !== "string" || input.reason.trim().length === 0) {
      throw new ApiRequestError(
        "VALIDATION_ERROR",
        "reason is required when outcome is 'rejected'.",
      );
    }
  }

  const ctx = getConfirmationContext(db, confirmationId);
  if (!ctx) {
    throw new ApiRequestError("NOT_FOUND", "Confirmation not found.");
  }
  if (!canDecideConfirmation(actor, asConfirmationContext(ctx))) {
    // canDecideConfirmation returns false for: non-initiator, non-pending,
    // and cross goal-space. For non-pending the message is more specific.
    if (ctx.confirmationStatus !== "pending") {
      throw new ApiRequestError(
        "STATE_CONFLICT",
        `Confirmation is already ${ctx.confirmationStatus}.`,
      );
    }
    throw new ApiRequestError("FORBIDDEN", "Cannot decide this confirmation.");
  }

  // Defensive R5: terminal-state card cannot be transitioned to blocked.
  if (isTerminalState(ctx.cardState as Parameters<typeof isTerminalState>[0])) {
    throw new ApiRequestError(
      "STATE_CONFLICT",
      `Cannot decide confirmation for a card in terminal state: ${ctx.cardState}.`,
    );
  }

  // Determine the new card state and trigger.
  let newCardState: string | null = null;
  let trigger: "human_confirm" | "human_reject" | null = null;

  if (outcome === "approved" && ctx.confirmation.targetState) {
    // Validate the target_state is a legal CardState enum value.
    // The spec says "确认通过后,卡片流转到确认记录中的 `target_state`" — the
    // caller-supplied target_state is honored as long as it is a valid
    // CardState. The F-002 (from, to, trigger) tuple check does not apply
    // to human decisions because the (from, to, human_confirm) tuple in
    // CARD_TRANSITIONS only allows (review → done); other targets (e.g.,
    // todo, dev, backlog, blocked) are intentionally permitted via the
    // human override path. Defensive: reject terminal states.
    const target = ctx.confirmation.targetState;
    if (!isValidState(target)) {
      throw new ApiRequestError(
        "VALIDATION_ERROR",
        `target_state must be a valid CardState: ${target}.`,
      );
    }
    if (isTerminalState(target)) {
      throw new ApiRequestError("STATE_CONFLICT", `Cannot approve to a terminal state: ${target}.`);
    }
    newCardState = target;
    trigger = "human_confirm";
  } else if (outcome === "rejected") {
    // The state machine guarantees every non-terminal state has a
    // human_reject tuple to 'blocked' (per CARD_TRANSITIONS). The
    // isTerminalState guard above already protects terminal states.
    newCardState = "blocked";
    trigger = "human_reject";
  }

  const cardStateChanged = newCardState !== null && newCardState !== ctx.cardState;
  const realtimeType =
    outcome === "approved"
      ? HUMAN_CONFIRMATION_REALTIME_EVENTS.approved
      : HUMAN_CONFIRMATION_REALTIME_EVENTS.rejected;

  const auditCtx: AuditContext = {
    entityType: HUMAN_CONFIRMATION_AUDIT_ENTITY_TYPE,
    entityId: confirmationId,
    actor: "human",
    actorId: actor.id,
    // Per `docs/specs/interface_spec.md § 6.2`, the action verb is the
    // past tense ("approve" / "reject"), not the outcome noun.
    action: outcome === "approved" ? "approve" : "reject",
    goalSpaceId: ctx.goalSpaceId,
    type: realtimeType,
    resourceType: HUMAN_CONFIRMATION_REALTIME_RESOURCE_TYPE,
    resourceId: confirmationId,
    details: {
      outcome,
      cardId: ctx.cardId,
      cardStateChanged,
      ...(newCardState !== null ? { newCardState } : {}),
      ...(trigger !== null ? { trigger } : {}),
      ...(input.reason !== undefined ? { reason: input.reason } : {}),
      ...(input.comment !== undefined ? { comment: input.comment } : {}),
    },
  };

  const decidedAt = nowIso();
  const resolvedAt = decidedAt;

  return runWithAudit(db, auditCtx, (tx) => {
    // 1) Update the confirmation row.
    updateConfirmationDecision(tx, confirmationId, {
      status: outcome,
      decisionOutcome: outcome,
      decisionBy: actor.id,
      decisionReason: input.reason ?? null,
      decisionComment: input.comment ?? null,
      decidedAt,
      resolvedAt,
    });

    // 2) If a state change is required, update the card and write
    //    state_transitions.
    if (newCardState !== null && trigger !== null) {
      const updatedCard = updateCardState(tx, ctx.cardId, {
        state: newCardState,
        // On reject, clear blocked fields in case the card was previously
        // blocked. On approve, do not touch blocked fields.
        ...(trigger === "human_reject" ? { blockedReason: null, blockedAt: null } : {}),
      });
      if (!updatedCard) {
        throw new ApiRequestError("NOT_FOUND", "Card not found.");
      }
      insertStateTransition(tx, {
        cardId: ctx.cardId,
        entityType: "card",
        entityId: ctx.cardId,
        fromState: ctx.cardState,
        toState: newCardState,
        trigger,
        actor: "human",
        actorId: actor.id,
        actorName: actor.id,
        reason: input.reason ?? null,
      });
    }

    const response: DecideConfirmationResponse = {
      id: confirmationId,
      status: outcome,
      decided_by: actor.id,
      decided_at: decidedAt,
      card_state_changed: cardStateChanged,
    };
    if (newCardState !== null) {
      return { ...response, new_card_state: newCardState };
    }
    return response;
  });
}

// ─── unused-but-referenced symbols ───────────────────────────────
// (intentionally empty)
