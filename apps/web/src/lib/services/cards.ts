/**
 * Card service (F2-05).
 *
 * Transactional application services for the documented REST endpoints
 * in `docs/specs/interface_spec.md § 4` and `§ 5.1`. Each lifecycle write
 * is wrapped in `runWithAudit` so the business change, audit entry,
 * realtime event, and (for state-changing writes) the `state_transitions`
 * row share a single `better-sqlite3` transaction.
 *
 * Authorization: `canReadCard` / `canMutateCard` (per
 * `docs/specs/authorization_matrix.md § 3` and § 4). The card's
 * authorization context is loaded from the database via
 * `getCardContext` (see repository) — caller-supplied context is never
 * trusted (per the explicit F2-05 review follow-up to F2-04).
 *
 * State machine: `assertTransition` / `canTransition` /
 * `getRequiredActor` (per `apps/web/src/lib/state-machine/card.ts`).
 *
 * Manual block trigger deviation: F2-05 reuses the existing
 * `review_failed` trigger with an overridden `actor: 'human'` rather
 * than introducing a new `manual_block` trigger. This is the fallback
 * path from `review/findings.md` F3. The state machine change is
 * deferred until the human explicitly resolves Q1.
 *
 * Realtime event type names are exported as constants so F2-08 SSE
 * filtering has a single source of truth.
 */

import { randomUUID } from "node:crypto";

import { RISK_LEVEL_VALUES, type CardState, type RiskLevel } from "@db/schema";

import { ApiRequestError } from "@/lib/api/errors";
import { runWithAudit, type AuditContext } from "@/lib/audit/run-with-audit";
import { canMutateCard, canReadCard } from "@/lib/authorization/card";
import type { Actor, CardContext } from "@/lib/authorization/types";
import { getDb, type DrizzleDb } from "@/lib/db/client";
import { getGoalSpaceWithMembers } from "@/lib/db/repositories/goal-spaces";
import {
  createCard as createCardRow,
  getCardContext,
  insertStateTransition,
  listAuditTrailForCard,
  listCardsForGoalSpace,
  listConfirmationsForCard,
  listTransitionsForCard,
  nextCardDisplayId,
  updateCard as updateCardRow,
  updateCardState,
  type CardRow,
  type ListCardsQuery,
  type UpdateCardInput,
} from "@/lib/db/repositories/cards";
import { isTerminalState } from "@/lib/state-machine";

// ─── realtime event constants (F2-08 handoff) ──────────────────────

export const CARD_REALTIME_EVENTS = {
  created: "card.created",
  updated: "card.updated",
  assigned: "card.assigned",
  blocked: "card.blocked",
  unblocked: "card.unblocked",
} as const;

export const CARD_AUDIT_ENTITY_TYPE = "card" as const;

const ALLOWED_UNBLOCK_TARGET_STATES: readonly CardState[] = [
  "backlog",
  "todo",
  "dev",
  "review",
] as const;

// ─── response shapes (per docs/specs/interface_spec.md § 4) ────────

export interface CardResponse {
  readonly id: string;
  readonly display_id: string;
  readonly goal_space_id: string;
  readonly node_board_id: string;
  readonly title: string;
  readonly description: string;
  readonly state: CardState;
  readonly assigned_to: string | null;
  readonly priority: number;
  readonly risk_level: RiskLevel;
  readonly evidence: ReadonlyArray<Record<string, unknown>>;
  readonly confidence: number | null;
  readonly blocked_reason: string | null;
  readonly blocked_at: string | null;
  readonly dependencies: readonly string[];
  readonly tags: readonly string[];
  readonly context: Record<string, unknown>;
  readonly created_at: string;
  readonly updated_at: string;
}

export interface CardListResponse {
  readonly items: readonly CardResponse[];
  readonly total: number;
}

export interface StateTransitionResponse {
  readonly id: string;
  readonly card_id: string;
  readonly from_state: CardState | null;
  readonly to_state: CardState;
  readonly trigger: string;
  readonly actor: "human" | "ai_role" | "system";
  readonly actor_name: string | null;
  readonly reason: string | null;
  readonly evidence: ReadonlyArray<Record<string, unknown>>;
  readonly timestamp: string;
}

export interface HumanConfirmationSummary {
  readonly id: string;
  readonly status: string;
  readonly trigger_type: string;
  readonly target_state: CardState | null;
  readonly triggered_at: string | null;
}

export interface AuditEntrySummary {
  readonly id: string;
  readonly action: string;
  readonly actor: string;
  readonly actor_id: string | null;
  readonly timestamp: string;
}

export interface CardDetailResponse extends CardResponse {
  readonly transitions: readonly StateTransitionResponse[];
  readonly confirmations: readonly HumanConfirmationSummary[];
  readonly audit_trail: readonly AuditEntrySummary[];
}

// ─── input shapes ────────────────────────────────────────────────

export interface CreateCardInput {
  readonly title: string;
  readonly description?: string;
  readonly node_board_id: string;
  readonly assigned_to?: string;
  readonly priority?: number;
  readonly risk_level?: RiskLevel;
  readonly dependencies?: string[];
  readonly tags?: string[];
}

// ─── helpers ─────────────────────────────────────────────────────

function nowIso(): string {
  return new Date().toISOString();
}

function toResponse(card: CardRow): CardResponse {
  return {
    id: card.id,
    display_id: card.displayId,
    goal_space_id: card.goalSpaceId,
    node_board_id: card.nodeBoardId,
    title: card.title,
    description: card.description ?? "",
    state: card.state,
    assigned_to: card.assignedTo,
    priority: card.priority,
    risk_level: card.riskLevel,
    evidence: card.evidence,
    confidence: card.confidence,
    blocked_reason: card.blockedReason,
    blocked_at: card.blockedAt,
    dependencies: card.dependencies,
    tags: card.tags,
    context: card.context,
    created_at: card.createdAt,
    updated_at: card.updatedAt,
  };
}

function asCardContext(ctx: ReturnType<typeof getCardContext>): CardContext {
  return {
    cardId: ctx!.card.id,
    goalSpaceId: ctx!.goalSpaceId,
    nodeBoardId: ctx!.card.nodeBoardId,
    goalSpaceInitiatorId: ctx!.goalSpaceInitiatorId,
    assignedTo: ctx!.card.assignedTo,
    nodeBoardMemberIds: ctx!.nodeBoardMemberIds,
    hasPendingConfirmation: ctx!.hasPendingConfirmation,
  };
}

function ensureReadable(actor: Actor, ctx: ReturnType<typeof getCardContext>): void {
  if (!ctx) {
    throw new ApiRequestError("NOT_FOUND", "Card not found.");
  }
  if (!canReadCard(actor, asCardContext(ctx))) {
    throw new ApiRequestError("FORBIDDEN", "Cannot read this card.");
  }
}

function loadReadableContext(
  db: DrizzleDb,
  cardId: string,
  actor: Actor,
): NonNullable<ReturnType<typeof getCardContext>> {
  const ctx = getCardContext(db, cardId);
  ensureReadable(actor, ctx);
  return ctx as NonNullable<ReturnType<typeof getCardContext>>;
}

function validateRiskLevel(value: unknown): RiskLevel {
  if (typeof value !== "string" || !(RISK_LEVEL_VALUES as readonly string[]).includes(value)) {
    throw new ApiRequestError(
      "VALIDATION_ERROR",
      `risk_level must be one of: ${RISK_LEVEL_VALUES.join(", ")}.`,
    );
  }
  return value as RiskLevel;
}

function validatePriority(value: unknown): number {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw new ApiRequestError("INVALID_FIELD", "priority must be an integer.");
  }
  return value;
}

function validateUnblockTargetState(value: unknown): CardState {
  if (
    typeof value !== "string" ||
    !(ALLOWED_UNBLOCK_TARGET_STATES as readonly string[]).includes(value)
  ) {
    throw new ApiRequestError(
      "VALIDATION_ERROR",
      `target_state must be one of: ${ALLOWED_UNBLOCK_TARGET_STATES.join(", ")}.`,
    );
  }
  return value as CardState;
}

// ─── service: list cards in a goal space ─────────────────────────

export function listCardsForGoalSpaceService(
  goalSpaceId: string,
  actor: Actor,
  filters: ListCardsQuery = {},
  db: DrizzleDb = getDb(),
): CardListResponse {
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

  const { items, total } = listCardsForGoalSpace(db, goalSpaceId, actor, filters);
  return { items: items.map(toResponse), total };
}

// ─── service: create card ────────────────────────────────────────

export function createCardService(
  goalSpaceId: string,
  input: CreateCardInput,
  actor: Actor,
  db: DrizzleDb = getDb(),
): CardResponse {
  // Goal space read check.
  const loaded = getGoalSpaceWithMembers(db, goalSpaceId);
  if (!loaded) {
    throw new ApiRequestError("NOT_FOUND", "Goal space not found.");
  }

  // Authorization: viewer cannot create; chain_user needs to be a member of
  // the goal space (per the goal-space node_board membership rule);
  // initiator always.
  if (actor.role === "viewer") {
    throw new ApiRequestError("FORBIDDEN", "Viewers cannot create cards.");
  }
  if (actor.role === "chain_user" && !loaded.memberIds.includes(actor.id)) {
    throw new ApiRequestError("FORBIDDEN", "Cannot create cards in this goal space.");
  }
  if (actor.role === "initiator" && actor.id !== loaded.row.initiatorId) {
    throw new ApiRequestError("FORBIDDEN", "Cannot create cards in this goal space.");
  }

  const id = randomUUID();
  const ctx: AuditContext = {
    entityType: CARD_AUDIT_ENTITY_TYPE,
    entityId: id,
    actor: "human",
    actorId: actor.id,
    action: "create",
    goalSpaceId: loaded.row.id,
    type: CARD_REALTIME_EVENTS.created,
    resourceType: "card",
    resourceId: id,
    data: {
      title: input.title,
      node_board_id: input.node_board_id,
      priority: input.priority ?? 0,
      risk_level: input.risk_level ?? "medium",
    },
  };

  return runWithAudit(db, ctx, (tx) => {
    const displayId = nextCardDisplayId(tx, loaded.row.id);
    let card: CardRow;
    try {
      card = createCardRow(tx, {
        id,
        goalSpaceId: loaded.row.id,
        nodeBoardId: input.node_board_id,
        displayId,
        title: input.title,
        description: input.description ?? null,
        assignedTo: input.assigned_to ?? null,
        priority: input.priority ?? 0,
        riskLevel: input.risk_level ?? "medium",
        dependencies: input.dependencies ?? [],
        tags: input.tags ?? [],
      });
    } catch (error) {
      if (error instanceof Error && /UNIQUE constraint failed/i.test(error.message)) {
        throw new ApiRequestError(
          "STATE_CONFLICT",
          `Card display_id collision in goal space: ${displayId}.`,
        );
      }
      throw error;
    }
    return toResponse(card);
  });
}

// ─── service: get card detail ────────────────────────────────────

export function getCardDetailService(
  cardId: string,
  actor: Actor,
  db: DrizzleDb = getDb(),
): CardDetailResponse {
  const ctx = loadReadableContext(db, cardId, actor);
  const card = ctx.card;

  const transitions = listTransitionsForCard(db, cardId).map(
    (row): StateTransitionResponse => ({
      id: row.id,
      card_id: row.cardId,
      from_state: (row.fromState ?? null) as CardState | null,
      to_state: row.toState as CardState,
      trigger: row.trigger,
      actor: row.actor as "human" | "ai_role" | "system",
      actor_name: row.actorName,
      reason: row.reason,
      evidence: [],
      timestamp: row.timestamp,
    }),
  );

  const confirmations = listConfirmationsForCard(db, cardId).map(
    (row): HumanConfirmationSummary => ({
      id: row.id,
      status: row.status,
      trigger_type: row.triggerType,
      target_state: (row.targetState ?? null) as CardState | null,
      triggered_at: row.triggeredAt,
    }),
  );

  const audit = listAuditTrailForCard(db, cardId, 50).map(
    (row): AuditEntrySummary => ({
      id: row.id,
      action: row.action,
      actor: row.actor,
      actor_id: row.actorId,
      timestamp: row.timestamp,
    }),
  );

  return {
    ...toResponse(card),
    transitions,
    confirmations,
    audit_trail: audit,
  };
}

// ─── service: update card ────────────────────────────────────────

export function updateCardService(
  cardId: string,
  input: UpdateCardInput,
  actor: Actor,
  db: DrizzleDb = getDb(),
): CardResponse {
  const ctx = loadReadableContext(db, cardId, actor);
  if (!canMutateCard(actor, "update", asCardContext(ctx))) {
    throw new ApiRequestError("FORBIDDEN", "Cannot update this card.");
  }

  // Validate fields if present.
  let validated: UpdateCardInput = input;
  if (input.riskLevel !== undefined) {
    validated = { ...validated, riskLevel: validateRiskLevel(input.riskLevel) };
  }
  if (input.priority !== undefined) {
    validatePriority(input.priority);
  }

  const auditCtx: AuditContext = {
    entityType: CARD_AUDIT_ENTITY_TYPE,
    entityId: cardId,
    actor: "human",
    actorId: actor.id,
    action: "update",
    goalSpaceId: ctx.goalSpaceId,
    type: CARD_REALTIME_EVENTS.updated,
    resourceType: "card",
    resourceId: cardId,
    details: { patch: { ...input } },
  };

  return runWithAudit(db, auditCtx, (tx) => {
    const updated = updateCardRow(tx, cardId, validated);
    if (!updated) {
      throw new ApiRequestError("NOT_FOUND", "Card not found.");
    }
    return toResponse(updated);
  });
}

// ─── service: assign card ────────────────────────────────────────

export function assignCardService(
  cardId: string,
  input: { assigned_to: string },
  actor: Actor,
  db: DrizzleDb = getDb(),
): CardResponse {
  const ctx = loadReadableContext(db, cardId, actor);
  if (!canMutateCard(actor, "update", asCardContext(ctx))) {
    throw new ApiRequestError("FORBIDDEN", "Cannot assign this card.");
  }

  // Idempotency: same assigned_to → no audit/realtime write.
  if (ctx.card.assignedTo === input.assigned_to) {
    return toResponse(ctx.card);
  }

  const auditCtx: AuditContext = {
    entityType: CARD_AUDIT_ENTITY_TYPE,
    entityId: cardId,
    actor: "human",
    actorId: actor.id,
    action: "assign",
    goalSpaceId: ctx.goalSpaceId,
    type: CARD_REALTIME_EVENTS.assigned,
    resourceType: "card",
    resourceId: cardId,
    details: { from: ctx.card.assignedTo, to: input.assigned_to },
  };

  return runWithAudit(db, auditCtx, (tx) => {
    const updated = updateCardRow(tx, cardId, { assignedTo: input.assigned_to });
    if (!updated) {
      throw new ApiRequestError("NOT_FOUND", "Card not found.");
    }
    return toResponse(updated);
  });
}

// ─── service: block card ─────────────────────────────────────────

export function blockCardService(
  cardId: string,
  input: { reason: string },
  actor: Actor,
  db: DrizzleDb = getDb(),
): CardResponse {
  const ctx = loadReadableContext(db, cardId, actor);
  if (!canMutateCard(actor, "update", asCardContext(ctx))) {
    throw new ApiRequestError("FORBIDDEN", "Cannot block this card.");
  }

  if (isTerminalState(ctx.card.state)) {
    throw new ApiRequestError(
      "STATE_CONFLICT",
      `Cannot block a card in terminal state: ${ctx.card.state}.`,
    );
  }

  // Deviation: reuse `review_failed` trigger with overridden actor.
  const trigger = "review_failed";
  const actorName = actor.id;
  const fromState = ctx.card.state;
  const toState: CardState = "blocked";

  const auditCtx: AuditContext = {
    entityType: CARD_AUDIT_ENTITY_TYPE,
    entityId: cardId,
    actor: "human",
    actorId: actor.id,
    action: "block",
    goalSpaceId: ctx.goalSpaceId,
    type: CARD_REALTIME_EVENTS.blocked,
    resourceType: "card",
    resourceId: cardId,
    details: { trigger, reason: input.reason },
    beforeState: { state: ctx.card.state },
    afterState: { state: toState, blocked_reason: input.reason },
  };

  return runWithAudit(db, auditCtx, (tx) => {
    const blockedAt = nowIso();
    const updated = updateCardState(tx, cardId, {
      state: "blocked",
      blockedReason: input.reason,
      blockedAt,
    });
    if (!updated) {
      throw new ApiRequestError("NOT_FOUND", "Card not found.");
    }
    insertStateTransition(tx, {
      cardId,
      entityType: "card",
      entityId: cardId,
      fromState,
      toState,
      trigger,
      actor: "human",
      actorId: actor.id,
      actorName,
      reason: input.reason,
    });
    return toResponse(updated);
  });
}

// ─── service: unblock card ───────────────────────────────────────

export function unblockCardService(
  cardId: string,
  input: { target_state: CardState },
  actor: Actor,
  db: DrizzleDb = getDb(),
): CardResponse {
  const target = validateUnblockTargetState(input.target_state);

  const ctx = loadReadableContext(db, cardId, actor);
  // canMutateCard('unblock') returns false when hasPendingConfirmation=true
  // per F-003 + spec § 5 mandatory gate.
  if (!canMutateCard(actor, "unblock", asCardContext(ctx))) {
    if (ctx.hasPendingConfirmation) {
      throw new ApiRequestError("CONFIRMATION_REQUIRED", "Card has a pending human confirmation.");
    }
    throw new ApiRequestError("FORBIDDEN", "Cannot unblock this card.");
  }

  if (ctx.card.state !== "blocked") {
    throw new ApiRequestError(
      "STATE_CONFLICT",
      `Card is not blocked (current state: ${ctx.card.state}).`,
    );
  }

  const trigger = "blocked_resolved";
  const fromState = ctx.card.state;
  const actorName = actor.id;

  const auditCtx: AuditContext = {
    entityType: CARD_AUDIT_ENTITY_TYPE,
    entityId: cardId,
    actor: "human",
    actorId: actor.id,
    action: "unblock",
    goalSpaceId: ctx.goalSpaceId,
    type: CARD_REALTIME_EVENTS.unblocked,
    resourceType: "card",
    resourceId: cardId,
    details: { trigger, target_state: target },
    beforeState: { state: fromState, blocked_reason: ctx.card.blockedReason },
    afterState: { state: target },
  };

  return runWithAudit(db, auditCtx, (tx) => {
    // 1) update card state and clear blocked_reason / blocked_at
    const updated = updateCardState(tx, cardId, {
      state: target,
      blockedReason: null,
      blockedAt: null,
    });
    if (!updated) {
      throw new ApiRequestError("NOT_FOUND", "Card not found.");
    }
    // 2) write state_transitions row
    insertStateTransition(tx, {
      cardId,
      entityType: "card",
      entityId: cardId,
      fromState,
      toState: target,
      trigger,
      actor: "human",
      actorId: actor.id,
      actorName,
      reason: null,
    });
    return toResponse(updated);
  });
}

// ─── service: list transitions ───────────────────────────────────

export function listCardTransitionsService(
  cardId: string,
  actor: Actor,
  db: DrizzleDb = getDb(),
): StateTransitionResponse[] {
  loadReadableContext(db, cardId, actor);
  return listTransitionsForCard(db, cardId).map(
    (row): StateTransitionResponse => ({
      id: row.id,
      card_id: row.cardId,
      from_state: (row.fromState ?? null) as CardState | null,
      to_state: row.toState as CardState,
      trigger: row.trigger,
      actor: row.actor as "human" | "ai_role" | "system",
      actor_name: row.actorName,
      reason: row.reason,
      evidence: [],
      timestamp: row.timestamp,
    }),
  );
}
