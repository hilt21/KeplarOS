/**
 * Goal Space service (F2-03).
 *
 * Transactional application services for the documented REST endpoints
 * in `docs/specs/interface_spec.md § 3`. Each lifecycle write is wrapped
 * in `runWithAudit` so the business change, audit entry, and realtime
 * event share a single `better-sqlite3` transaction.
 *
 * Authorization: `canReadGoalSpace` / `canManageGoalSpace` (per
 * `docs/specs/authorization_matrix.md § 3` and ADR-001).
 * State machine: `assertGoalSpaceTransition` for lifecycle changes.
 */

import { randomUUID } from "node:crypto";

import { and, inArray, isNull } from "drizzle-orm";

import { cards } from "@db/schema";

import { ApiRequestError } from "@/lib/api/errors";
import { runWithAudit, type AuditContext } from "@/lib/audit/run-with-audit";
import { canManageGoalSpace, canReadGoalSpace } from "@/lib/authorization/goal-space";
import type { Actor } from "@/lib/authorization/types";
import { getDb, type DrizzleDb } from "@/lib/db/client";
import {
  cancelGoalSpace as cancelGoalSpaceRow,
  completeGoalSpace as completeGoalSpaceRow,
  countCardsForGoalSpace,
  countNodeBoardsForGoalSpace,
  createGoalSpace as createGoalSpaceRow,
  getGoalSpaceById,
  getGoalSpaceWithMembers,
  listGoalSpaces as listGoalSpacesRows,
  readCancelSummary,
  readCompletePreconditions,
  startGoalSpace as startGoalSpaceRow,
  updateGoalSpace as updateGoalSpaceRow,
  type CardCounts,
  type GoalSpaceRow,
  type NodeBoardCounts,
  type UpdateGoalSpaceInput,
} from "@/lib/db/repositories/goal-spaces";
import { assertGoalSpaceTransition, isGoalSpaceTerminal } from "@/lib/state-machine/goal-space";

// ─── response shapes (per docs/specs/interface_spec.md § 3) ────────

export interface AcceptanceCriterion {
  readonly criterion: string;
  readonly evidence: string[];
}

export interface GoalSpaceListItem {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly constraints: readonly string[];
  readonly acceptance_criteria: readonly AcceptanceCriterion[];
  readonly status: GoalSpaceRow["status"];
  readonly progress: number;
  readonly initiator_id: string;
  readonly node_board_counts: NodeBoardCounts;
  readonly card_counts: CardCounts;
  readonly created_at: string;
  readonly updated_at: string;
}

export interface GoalSpaceDetailResponse extends GoalSpaceListItem {
  readonly started_at?: string;
  readonly completed_at?: string;
  readonly cancelled_at?: string;
  readonly cancel_reason?: string;
  readonly cards: readonly unknown[];
}

export interface StartGoalSpaceResponse {
  readonly status: "active";
  readonly started_at: string;
  readonly cards_generated: number;
}

export interface CompleteGoalSpaceResponse {
  readonly status: "completed";
  readonly completed_at: string;
  readonly summary: {
    readonly total_cards: number;
    readonly done_cards: number;
    readonly blocked_cards: number;
  };
}

export interface CancelGoalSpaceResponse {
  readonly status: "cancelled";
  readonly cancelled_at: string;
  readonly cancel_reason: string;
  readonly summary: {
    readonly total_cards: number;
    readonly done_cards: number;
    readonly cancelled_cards: number;
    readonly blocked_cards: number;
  };
}

export interface GoalSpaceListResponse {
  readonly items: readonly GoalSpaceListItem[];
  readonly total: number;
  readonly page: number;
  readonly limit: number;
}

// ─── input shapes ────────────────────────────────────────────────

export interface CreateGoalSpaceInput {
  readonly name: string;
  readonly description?: string;
  readonly constraints?: readonly string[];
  readonly acceptance_criteria?: readonly AcceptanceCriterion[];
}

export interface ListGoalSpacesParams {
  readonly status?: GoalSpaceRow["status"];
  readonly page: number;
  readonly limit: number;
}

// ─── helpers ─────────────────────────────────────────────────────

function nowIso(): string {
  return new Date().toISOString();
}

function toListItem(
  row: GoalSpaceRow,
  nodeBoardCounts: NodeBoardCounts,
  cardCounts: CardCounts,
): GoalSpaceListItem {
  const constraints: readonly string[] = row.constraints.map((c) =>
    typeof c === "string" ? c : JSON.stringify(c),
  );
  const acceptanceCriteria: readonly AcceptanceCriterion[] = (row.acceptanceCriteria ?? []).map(
    (c) => {
      const record = c as { criterion?: unknown; evidence?: unknown };
      return {
        criterion: typeof record.criterion === "string" ? record.criterion : "",
        evidence: Array.isArray(record.evidence)
          ? record.evidence.filter((e): e is string => typeof e === "string")
          : [],
      };
    },
  );
  const listItem: GoalSpaceListItem = {
    id: row.id,
    name: row.name,
    description: row.description ?? "",
    constraints,
    acceptance_criteria: acceptanceCriteria,
    status: row.status,
    progress: row.progress,
    initiator_id: row.initiatorId,
    node_board_counts: nodeBoardCounts,
    card_counts: cardCounts,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  };
  return listItem;
}

function toDetailResponse(
  row: GoalSpaceRow,
  nodeBoardCounts: NodeBoardCounts,
  cardCounts: CardCounts,
  cards: readonly unknown[],
): GoalSpaceDetailResponse {
  return {
    ...toListItem(row, nodeBoardCounts, cardCounts),
    ...(row.startedAt ? { started_at: row.startedAt } : {}),
    ...(row.completedAt ? { completed_at: row.completedAt } : {}),
    ...(row.cancelledAt ? { cancelled_at: row.cancelledAt } : {}),
    ...(row.cancelReason ? { cancel_reason: row.cancelReason } : {}),
    cards,
  };
}

function emptyCounts(): NodeBoardCounts {
  return { total: 0, active: 0, completed: 0 };
}

function emptyCardCounts(): CardCounts {
  return {
    backlog: 0,
    todo: 0,
    dev: 0,
    review: 0,
    done: 0,
    blocked: 0,
    cancelled: 0,
  };
}

function ensureReadable(
  actor: Actor,
  memberIds: readonly string[],
  initiatorId: string,
  goalSpaceId: string,
): void {
  if (
    !canReadGoalSpace(actor, {
      goalSpaceId,
      initiatorId,
      nodeBoardMemberIds: memberIds,
    })
  ) {
    throw new ApiRequestError("FORBIDDEN", "Cannot read this goal space.");
  }
}

function ensureManageable(
  actor: Actor,
  memberIds: readonly string[],
  initiatorId: string,
  goalSpaceId: string,
): void {
  if (
    !canManageGoalSpace(actor, {
      goalSpaceId,
      initiatorId,
      nodeBoardMemberIds: memberIds,
    })
  ) {
    throw new ApiRequestError(
      "FORBIDDEN",
      "Only the goal space initiator can manage this goal space.",
    );
  }
}

// ─── service: create ─────────────────────────────────────────────

export function createGoalSpaceService(
  input: CreateGoalSpaceInput,
  actor: Actor,
  db: DrizzleDb = getDb(),
): GoalSpaceListItem {
  if (actor.role !== "initiator") {
    throw new ApiRequestError("FORBIDDEN", "Only initiators can create goal spaces.");
  }

  // Pre-generate the id so the audit entry and realtime event can carry
  // the goal space's real id from the very first write.
  const id = randomUUID();
  const ctx: AuditContext = {
    entityType: "goal_space",
    entityId: id,
    actor: "human",
    actorId: actor.id,
    action: "create",
    goalSpaceId: id,
    type: "goal_space.created",
    resourceType: "goal_space",
    resourceId: id,
    data: { name: input.name },
  };

  return runWithAudit(db, ctx, (tx) => {
    const row = createGoalSpaceRow(
      tx,
      actor.id,
      {
        name: input.name,
        description: input.description ?? null,
        constraints: input.constraints ? input.constraints.map((c) => ({ value: c })) : [],
        acceptanceCriteria: input.acceptance_criteria
          ? input.acceptance_criteria.map((c) => ({
              criterion: c.criterion,
              evidence: [...c.evidence],
            }))
          : null,
      },
      id,
    );

    return toListItem(row, emptyCounts(), emptyCardCounts());
  });
}

// ─── service: list ───────────────────────────────────────────────

export function listGoalSpacesService(
  params: ListGoalSpacesParams,
  actor: Actor,
  db: DrizzleDb = getDb(),
): GoalSpaceListResponse {
  const { items, total } = listGoalSpacesRows(db, {
    ...(params.status !== undefined ? { status: params.status } : {}),
    page: params.page,
    limit: params.limit,
    actor,
  });

  // Per ADR-001: counts are derived per goal space; F2-03 keeps this
  // simple by computing counts inline. A future optimization can join
  // counts in a single query (see F2-03 review findings — non-blocking).
  const list: GoalSpaceListItem[] = items.map((row) => {
    const nodeBoards = countNodeBoardsForGoalSpace(db, row.id);
    const cards = countCardsForGoalSpace(db, row.id);
    return toListItem(row, nodeBoards, cards);
  });

  return {
    items: list,
    total,
    page: params.page,
    limit: params.limit,
  };
}

// ─── service: detail ─────────────────────────────────────────────

export function getGoalSpaceDetailService(
  id: string,
  actor: Actor,
  db: DrizzleDb = getDb(),
): GoalSpaceDetailResponse {
  const loaded = getGoalSpaceWithMembers(db, id);
  if (!loaded) {
    throw new ApiRequestError("NOT_FOUND", "Goal space not found.");
  }
  ensureReadable(actor, loaded.memberIds, loaded.row.initiatorId, id);

  const nodeBoards = countNodeBoardsForGoalSpace(db, id);
  const cards = countCardsForGoalSpace(db, id);
  // F2-05 owns card-level detail; F2-03 returns an empty card list and
  // exposes counts via card_counts. Tests pin this contract.
  return toDetailResponse(loaded.row, nodeBoards, cards, []);
}

// ─── service: update ─────────────────────────────────────────────

export function updateGoalSpaceService(
  id: string,
  input: UpdateGoalSpaceInput,
  actor: Actor,
  db: DrizzleDb = getDb(),
): GoalSpaceListItem {
  const loaded = getGoalSpaceWithMembers(db, id);
  if (!loaded) {
    throw new ApiRequestError("NOT_FOUND", "Goal space not found.");
  }
  ensureManageable(actor, loaded.memberIds, loaded.row.initiatorId, id);
  if (loaded.row.status !== "draft") {
    throw new ApiRequestError(
      "STATE_CONFLICT",
      `Goal space can only be updated in draft state; current state: ${loaded.row.status}.`,
    );
  }

  const ctx: AuditContext = {
    entityType: "goal_space",
    entityId: id,
    actor: "human",
    actorId: actor.id,
    action: "update",
    goalSpaceId: id,
    type: "goal_space.updated",
    resourceType: "goal_space",
    resourceId: id,
    details: { patch: { ...input } },
  };

  return runWithAudit(db, ctx, (tx) => {
    const updated = updateGoalSpaceRow(tx, id, input);
    if (!updated) {
      throw new ApiRequestError("NOT_FOUND", "Goal space not found.");
    }
    return toListItem(updated, emptyCounts(), emptyCardCounts());
  });
}

// ─── service: start ──────────────────────────────────────────────

export function startGoalSpaceService(
  id: string,
  actor: Actor,
  db: DrizzleDb = getDb(),
): StartGoalSpaceResponse {
  const loaded = getGoalSpaceWithMembers(db, id);
  if (!loaded) {
    throw new ApiRequestError("NOT_FOUND", "Goal space not found.");
  }
  ensureManageable(actor, loaded.memberIds, loaded.row.initiatorId, id);

  try {
    assertGoalSpaceTransition(loaded.row.status, "active");
  } catch {
    throw new ApiRequestError(
      "STATE_CONFLICT",
      `Goal space cannot be started from state: ${loaded.row.status}.`,
    );
  }

  const startedAt = nowIso();
  const ctx: AuditContext = {
    entityType: "goal_space",
    entityId: id,
    actor: "human",
    actorId: actor.id,
    action: "transition",
    beforeState: { status: loaded.row.status },
    afterState: { status: "active", startedAt },
    goalSpaceId: id,
    type: "goal_space.started",
    resourceType: "goal_space",
    resourceId: id,
    details: { from: loaded.row.status, to: "active" },
  };

  return runWithAudit(db, ctx, (tx) => {
    const updated = startGoalSpaceRow(tx, id, startedAt);
    if (!updated) {
      throw new ApiRequestError("NOT_FOUND", "Goal space not found.");
    }
    return {
      status: "active",
      started_at: updated.startedAt ?? startedAt,
      cards_generated: 0,
    };
  });
}

// ─── service: complete ───────────────────────────────────────────

export function completeGoalSpaceService(
  id: string,
  actor: Actor,
  db: DrizzleDb = getDb(),
): CompleteGoalSpaceResponse {
  const loaded = getGoalSpaceWithMembers(db, id);
  if (!loaded) {
    throw new ApiRequestError("NOT_FOUND", "Goal space not found.");
  }
  ensureManageable(actor, loaded.memberIds, loaded.row.initiatorId, id);

  if (loaded.row.status !== "active") {
    throw new ApiRequestError(
      "STATE_CONFLICT",
      `Goal space cannot be completed from state: ${loaded.row.status}.`,
    );
  }

  // Preconditions must be checked inside the same transaction as the
  // write. We call `readCompletePreconditions` on the db handle here so
  // the production path runs the queries against the real database
  // immediately; the actual write + audit happen inside runWithAudit
  // which serializes the better-sqlite3 connection. This is sufficient
  // for the documented single-process Web beta runtime.
  const preconditions = readCompletePreconditions(db, id);

  let missing: string[] = [];
  try {
    missing = assertGoalSpaceTransition("active", "completed", preconditions);
  } catch {
    missing = ["hasPendingConfirmation", "hasBlockedCard", "allCardsDoneOrCancelled"];
  }

  if (missing.length > 0) {
    if (missing.includes("hasPendingConfirmation")) {
      throw new ApiRequestError(
        "CONFIRMATION_REQUIRED",
        "Goal space cannot be completed while pending human confirmations exist.",
      );
    }
    if (missing.includes("hasBlockedCard")) {
      throw new ApiRequestError(
        "STATE_CONFLICT",
        "Goal space cannot be completed while any card is blocked.",
      );
    }
    if (missing.includes("allCardsDoneOrCancelled")) {
      throw new ApiRequestError(
        "VALIDATION_ERROR",
        "Goal space cannot be completed while any card is in a non-terminal state.",
      );
    }
  }

  const completedAt = nowIso();
  const ctx: AuditContext = {
    entityType: "goal_space",
    entityId: id,
    actor: "human",
    actorId: actor.id,
    action: "complete",
    beforeState: { status: loaded.row.status },
    afterState: { status: "completed", completedAt },
    goalSpaceId: id,
    type: "goal_space.completed",
    resourceType: "goal_space",
    resourceId: id,
    details: { preconditions },
  };

  return runWithAudit(db, ctx, (tx) => {
    const updated = completeGoalSpaceRow(tx, id, completedAt);
    if (!updated) {
      throw new ApiRequestError("NOT_FOUND", "Goal space not found.");
    }
    const cardCounts = countCardsForGoalSpace(db, id);
    return {
      status: "completed",
      completed_at: updated.completedAt ?? completedAt,
      summary: {
        total_cards:
          cardCounts.backlog +
          cardCounts.todo +
          cardCounts.dev +
          cardCounts.review +
          cardCounts.done +
          cardCounts.blocked +
          cardCounts.cancelled,
        done_cards: cardCounts.done,
        blocked_cards: cardCounts.blocked,
      },
    };
  });
}

// ─── service: cancel ─────────────────────────────────────────────

export function cancelGoalSpaceService(
  id: string,
  actor: Actor,
  reason: string,
  db: DrizzleDb = getDb(),
): CancelGoalSpaceResponse {
  if (typeof reason !== "string" || reason.trim().length === 0) {
    throw new ApiRequestError("INVALID_FIELD", "reason is required and must be non-empty.");
  }

  const loaded = getGoalSpaceWithMembers(db, id);
  if (!loaded) {
    throw new ApiRequestError("NOT_FOUND", "Goal space not found.");
  }
  ensureManageable(actor, loaded.memberIds, loaded.row.initiatorId, id);

  if (isGoalSpaceTerminal(loaded.row.status)) {
    throw new ApiRequestError(
      "STATE_CONFLICT",
      `Goal space is already in a terminal state: ${loaded.row.status}.`,
    );
  }

  try {
    assertGoalSpaceTransition(loaded.row.status, "cancelled", { cancelReason: reason });
  } catch {
    throw new ApiRequestError(
      "STATE_CONFLICT",
      `Goal space cannot be cancelled from state: ${loaded.row.status}.`,
    );
  }

  const cancelledAt = nowIso();
  const ctx: AuditContext = {
    entityType: "goal_space",
    entityId: id,
    actor: "human",
    actorId: actor.id,
    action: "cancel",
    beforeState: { status: loaded.row.status },
    afterState: { status: "cancelled", cancelledAt, cancelReason: reason },
    goalSpaceId: id,
    type: "goal_space.cancelled",
    resourceType: "goal_space",
    resourceId: id,
    details: { reason },
  };

  return runWithAudit(db, ctx, (tx) => {
    const updated = cancelGoalSpaceRow(tx, id, reason, cancelledAt);
    if (!updated) {
      throw new ApiRequestError("NOT_FOUND", "Goal space not found.");
    }
    const counts = readCancelSummary(db, id);
    return {
      status: "cancelled",
      cancelled_at: updated.cancelledAt ?? cancelledAt,
      cancel_reason: reason,
      summary: {
        total_cards: counts.total,
        done_cards: counts.done,
        cancelled_cards: counts.cancelled,
        blocked_cards: counts.blocked,
      },
    };
  });
}

// ─── service: list goal spaces with task summaries (F2) ──────────

/**
 * Minimal task summary shape consumed by the persistent shell's
 * `WorkspaceSection` (see `apps/web/src/components/master-pane/workspace-section.tsx`).
 */
export interface GoalSpaceTaskSummary {
  readonly id: string;
  readonly display_id: string;
  readonly title: string;
  readonly state: "backlog" | "todo" | "dev" | "review" | "done" | "blocked" | "cancelled";
  readonly updated_at: string;
}

export interface GoalSpaceWithTasks {
  readonly goalSpace: { readonly id: string; readonly name: string };
  readonly tasks: readonly GoalSpaceTaskSummary[];
}

/**
 * List all goal spaces visible to the actor, each paired with the
 * summary cards (`id` / `display_id` / `title` / `state` / `updated_at`)
 * that belong to it.
 *
 * Implementation note (F2):
 * - One query for goal spaces (via the existing `listGoalSpaces` repository
 *   helper that already enforces actor visibility).
 * - One query for ALL non-deleted cards belonging to those goal spaces,
 *   grouped in-memory by `goal_space_id`. This avoids N+1 against the
 *   `cards` table when the actor sees many goal spaces.
 * - If the actor sees no goal spaces, no card query is issued.
 *
 * Authorization: re-uses the existing `listGoalSpaces` repository filter
 * (`actor.role` + node_board membership), so `GoalSpaceContext` checks are
 * not duplicated here.
 */
export function listGoalSpacesWithTasksService(
  actor: Actor,
  db: DrizzleDb = getDb(),
): readonly GoalSpaceWithTasks[] {
  const { items } = listGoalSpacesRows(db, {
    page: 1,
    limit: 1000,
    actor,
  });

  if (items.length === 0) {
    return [];
  }

  const goalSpaceIds = items.map((row) => row.id);
  const cardRows = db
    .select({
      id: cards.id,
      displayId: cards.displayId,
      title: cards.title,
      state: cards.state,
      updatedAt: cards.updatedAt,
      goalSpaceId: cards.goalSpaceId,
    })
    .from(cards)
    .where(and(inArray(cards.goalSpaceId, goalSpaceIds), isNull(cards.deletedAt)))
    .all() as Array<{
    readonly id: string;
    readonly displayId: string;
    readonly title: string;
    readonly state: GoalSpaceTaskSummary["state"];
    readonly updatedAt: string;
    readonly goalSpaceId: string;
  }>;

  const byGoalSpace = new Map<string, GoalSpaceTaskSummary[]>();
  for (const row of cardRows) {
    const list = byGoalSpace.get(row.goalSpaceId);
    const summary: GoalSpaceTaskSummary = {
      id: row.id,
      display_id: row.displayId,
      title: row.title,
      state: row.state,
      updated_at: row.updatedAt,
    };
    if (list) {
      list.push(summary);
    } else {
      byGoalSpace.set(row.goalSpaceId, [summary]);
    }
  }

  return items.map((row) => ({
    goalSpace: { id: row.id, name: row.name },
    tasks: byGoalSpace.get(row.id) ?? [],
  }));
}
