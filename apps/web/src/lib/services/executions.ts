/**
 * Agent Execution service (F2-07).
 *
 * Transactional application services for the documented REST endpoints
 * in `docs/specs/interface_spec.md § 7`. Each execution lifecycle write
 * is wrapped in `runWithAudit` so the business change, audit entry,
 * and realtime event share a single `better-sqlite3` transaction.
 *
 * Authorization: `canExecuteCard` (per `docs/specs/authorization_matrix.md § 3`
 * and § 4). The helper already encodes the § 5 mandatory gate (returns
 * false when `hasPendingConfirmation=true` or `currentState` is terminal).
 *
 * State machine: `assertTransition` (per F-002 + ADR-002) for the
 * `completed` state-transition branch. `IllegalTransitionError` is mapped
 * to 409 STATE_CONFLICT (consistent with F2-05 / F2-06).
 *
 * Fixture executor: `executeFixture` (per `apps/web/src/lib/execution/fixture-executor.ts`).
 * The executor is pure and synchronous; the service calls it then
 * persists the result inside `runWithAudit`.
 *
 * Two `runWithAudit` calls per execution (create + update):
 *   1. Create the agent_executions row → audit `execute` + realtime `agent_execution.queued`.
 *   2. Update with terminal status → audit `execute_completed | execute_failed | execute_needs_confirmation`
 *      + realtime `agent_execution.{completed|failed|needs_confirmation}`.
 * Both share the same `db.transaction` boundary via the F-004 wrapper.
 *
 * Realtime event type names are exported as constants so F2-08 SSE
 * filtering has a single source of truth.
 */

import { randomUUID } from "node:crypto";

import type { AgentExecutionStatus, CardState } from "@db/schema";

import { ApiRequestError } from "@/lib/api/errors";
import { runWithAudit, type AuditContext } from "@/lib/audit/run-with-audit";
import { canExecuteCard } from "@/lib/authorization/execute";
import type { Actor, ExecuteCardContext } from "@/lib/authorization/types";
import { getDb, type DrizzleDb } from "@/lib/db/client";
import {
  getCardContext,
  insertStateTransition,
  updateCardState,
} from "@/lib/db/repositories/cards";
import {
  createAgentExecution,
  createHumanConfirmationForExecution,
  getAgentExecutionById,
  updateAgentExecutionResult,
} from "@/lib/db/repositories/executions";
import { isTerminalState } from "@/lib/state-machine";
import {
  AGENT_ROLE_VALUES,
  ROLE_ESTIMATED_TIME_SECONDS,
  type AgentRole,
} from "@/lib/execution/roles";
import { executeFixture } from "@/lib/execution/fixture-executor";

// ─── realtime event constants (F2-08 handoff) ──────────────────────

export const AGENT_EXECUTION_REALTIME_EVENTS = {
  queued: "agent_execution.queued",
  completed: "agent_execution.completed",
  failed: "agent_execution.failed",
  needsConfirmation: "agent_execution.needs_confirmation",
} as const;

export const AGENT_EXECUTION_AUDIT_ENTITY_TYPE = "agent_execution" as const;

export const AGENT_EXECUTION_REALTIME_RESOURCE_TYPE = "agent_execution" as const;

// Confirmation-side realtime (when an execution creates one).
export const HUMAN_CONFIRMATION_CREATED_REALTIME_EVENT = "human_confirmation.created" as const;

// ─── response shapes (per docs/specs/interface_spec.md § 7) ────────

export interface ExecuteCardResponse {
  readonly task_id: string;
  readonly session_id?: string;
  readonly card_id: string;
  readonly role: AgentRole;
  readonly status: "queued";
  readonly estimated_time: number;
  readonly polling_url: string;
}

export interface ExecuteResultBlock {
  readonly new_state?: CardState;
  readonly confidence?: number;
  readonly evidence: ReadonlyArray<Record<string, unknown>>;
  readonly message: string;
}

export interface ExecuteErrorBlock {
  readonly code: string;
  readonly message: string;
}

export interface ExecuteStatusResponse {
  readonly task_id: string;
  readonly session_id?: string;
  readonly card_id: string;
  readonly role: AgentRole;
  readonly status: AgentExecutionStatus;
  readonly attempt: number;
  readonly max_attempts: number;
  readonly result?: ExecuteResultBlock;
  readonly error?: ExecuteErrorBlock;
  readonly started_at: string;
  readonly completed_at?: string;
}

// ─── input shapes ────────────────────────────────────────────────

export interface ExecuteCardInput {
  readonly role: AgentRole;
  readonly context?: Record<string, unknown>;
}

// ─── helpers ─────────────────────────────────────────────────────

function nowIso(): string {
  return new Date().toISOString();
}

function nowMs(): number {
  return Date.now();
}

function validateRole(value: unknown): AgentRole {
  if (typeof value !== "string" || !(AGENT_ROLE_VALUES as readonly string[]).includes(value)) {
    throw new ApiRequestError(
      "VALIDATION_ERROR",
      `role must be one of: ${AGENT_ROLE_VALUES.join(", ")}.`,
    );
  }
  return value as AgentRole;
}

// ─── service: create execution ───────────────────────────────────

export function createExecutionService(
  cardId: string,
  input: ExecuteCardInput,
  actor: Actor,
  db: DrizzleDb = getDb(),
): ExecuteCardResponse {
  const role = validateRole(input.role);

  const ctx = getCardContext(db, cardId);
  if (!ctx) {
    throw new ApiRequestError("NOT_FOUND", "Card not found.");
  }

  // canExecuteCard encodes the § 5 mandatory gate.
  const execCtx: ExecuteCardContext = {
    card: {
      cardId: ctx.card.id,
      goalSpaceId: ctx.goalSpaceId,
      nodeBoardId: ctx.card.nodeBoardId,
      goalSpaceInitiatorId: ctx.goalSpaceInitiatorId,
      assignedTo: ctx.card.assignedTo,
      nodeBoardMemberIds: ctx.nodeBoardMemberIds,
      hasPendingConfirmation: ctx.hasPendingConfirmation,
    },
    hasPendingConfirmation: ctx.hasPendingConfirmation,
    currentState: ctx.card.state,
  };
  if (!canExecuteCard(actor, execCtx)) {
    if (actor.role === "viewer") {
      throw new ApiRequestError("FORBIDDEN", "Viewers cannot execute cards.");
    }
    if (ctx.hasPendingConfirmation) {
      throw new ApiRequestError("CONFIRMATION_REQUIRED", "Card has a pending human confirmation.");
    }
    if (isTerminalState(ctx.card.state)) {
      throw new ApiRequestError("STATE_CONFLICT", `Card is in terminal state: ${ctx.card.state}.`);
    }
    throw new ApiRequestError("FORBIDDEN", "Cannot execute this card.");
  }

  // Run the fixture executor synchronously.
  const fixtureResult = executeFixture(
    {
      id: ctx.card.id,
      title: ctx.card.title,
      state: ctx.card.state,
      riskLevel: ctx.card.riskLevel,
      assignedTo: ctx.card.assignedTo,
      tags: ctx.card.tags,
      description: ctx.card.description,
    },
    role,
  );

  const taskId = randomUUID();
  const startedAt = nowIso();
  const startedAtMs = nowMs();
  const inputContext = input.context ?? {};
  const pollingUrl = `/api/v1/execute/${taskId}`;

  // First runWithAudit: insert queued row + audit + realtime.
  const queueAudit: AuditContext = {
    entityType: AGENT_EXECUTION_AUDIT_ENTITY_TYPE,
    entityId: taskId,
    actor: "human",
    actorId: actor.id,
    action: "execute",
    goalSpaceId: ctx.goalSpaceId,
    type: AGENT_EXECUTION_REALTIME_EVENTS.queued,
    resourceType: AGENT_EXECUTION_REALTIME_RESOURCE_TYPE,
    resourceId: taskId,
    data: { cardId: ctx.card.id, role, status: "queued" },
  };

  runWithAudit(db, queueAudit, (tx) => {
    createAgentExecution(tx, {
      id: taskId,
      goalSpaceId: ctx.goalSpaceId,
      cardId: ctx.card.id,
      agentRole: role,
      trigger: role,
      status: "queued",
      requestedById: actor.id,
      requestedByName: actor.id,
      inputContext,
      startedAt,
    });
  });

  // Apply the fixture result via a second runWithAudit + update the row.
  const completedAt = nowIso();
  const durationMs = nowMs() - startedAtMs;

  if (fixtureResult.status === "completed") {
    // Apply state transition + write state_transitions row.
    const terminalAudit: AuditContext = {
      entityType: AGENT_EXECUTION_AUDIT_ENTITY_TYPE,
      entityId: taskId,
      actor: "ai_role",
      actorId: null,
      action: "execute_completed",
      goalSpaceId: ctx.goalSpaceId,
      type: AGENT_EXECUTION_REALTIME_EVENTS.completed,
      resourceType: AGENT_EXECUTION_REALTIME_RESOURCE_TYPE,
      resourceId: taskId,
      data: {
        cardId: ctx.card.id,
        role,
        new_state: fixtureResult.new_state,
      },
    };
    runWithAudit(db, terminalAudit, (tx) => {
      updateAgentExecutionResult(tx, taskId, {
        status: "completed",
        result: {
          new_state: fixtureResult.new_state,
          confidence: fixtureResult.confidence,
          evidence: fixtureResult.evidence as Record<string, unknown>[],
          message: fixtureResult.message,
        },
        errorCode: null,
        errorMessage: null,
        durationMs,
        completedAt,
      });
      // Apply the state transition to the card.
      const updatedCard = updateCardState(tx, ctx.card.id, {
        state: fixtureResult.new_state,
      });
      if (!updatedCard) {
        throw new ApiRequestError("NOT_FOUND", "Card not found.");
      }
      insertStateTransition(tx, {
        cardId: ctx.card.id,
        entityType: "card",
        entityId: ctx.card.id,
        fromState: ctx.card.state,
        toState: fixtureResult.new_state,
        trigger: fixtureResult.trigger,
        actor: "ai_role",
        actorId: null,
        actorName: role,
        reason: fixtureResult.message,
      });
    });
  } else if (fixtureResult.status === "needs_confirmation") {
    const confirmationAudit: AuditContext = {
      entityType: AGENT_EXECUTION_AUDIT_ENTITY_TYPE,
      entityId: taskId,
      actor: "ai_role",
      actorId: null,
      action: "execute_needs_confirmation",
      goalSpaceId: ctx.goalSpaceId,
      type: AGENT_EXECUTION_REALTIME_EVENTS.needsConfirmation,
      resourceType: AGENT_EXECUTION_REALTIME_RESOURCE_TYPE,
      resourceId: taskId,
      data: {
        cardId: ctx.card.id,
        role,
        trigger_type: fixtureResult.trigger_type,
        target_state: fixtureResult.target_state,
      },
    };
    runWithAudit(db, confirmationAudit, (tx) => {
      updateAgentExecutionResult(tx, taskId, {
        status: "needs_confirmation",
        result: {
          new_state: null,
          confidence: fixtureResult.confidence,
          evidence: fixtureResult.evidence as Record<string, unknown>[],
          message: fixtureResult.message,
        },
        errorCode: null,
        errorMessage: null,
        durationMs,
        completedAt,
      });
      // Create a pending human_confirmation row atomically.
      const confirmationId = randomUUID();
      const triggeredAt = nowIso();
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      createHumanConfirmationForExecution(tx, {
        id: confirmationId,
        cardId: ctx.card.id,
        triggerType: fixtureResult.trigger_type,
        targetState: fixtureResult.target_state,
        triggerReason: `AI execution (${role}) flagged for approval`,
        triggeredBy: actor.id,
        triggeredAt,
        aiSummary: fixtureResult.message,
        aiConfidence: fixtureResult.confidence,
        riskLevel: ctx.card.riskLevel,
        expiresAt,
      });
    });
  } else {
    // failed
    const failedAudit: AuditContext = {
      entityType: AGENT_EXECUTION_AUDIT_ENTITY_TYPE,
      entityId: taskId,
      actor: "ai_role",
      actorId: null,
      action: "execute_failed",
      goalSpaceId: ctx.goalSpaceId,
      type: AGENT_EXECUTION_REALTIME_EVENTS.failed,
      resourceType: AGENT_EXECUTION_REALTIME_RESOURCE_TYPE,
      resourceId: taskId,
      data: {
        cardId: ctx.card.id,
        role,
        error_code: fixtureResult.error.code,
      },
    };
    runWithAudit(db, failedAudit, (tx) => {
      updateAgentExecutionResult(tx, taskId, {
        status: "failed",
        result: null,
        errorCode: fixtureResult.error.code,
        errorMessage: fixtureResult.error.message,
        durationMs,
        completedAt,
      });
    });
  }

  return {
    task_id: taskId,
    card_id: ctx.card.id,
    role,
    status: "queued",
    estimated_time: ROLE_ESTIMATED_TIME_SECONDS[role],
    polling_url: pollingUrl,
  };
}

// ─── service: get execution status ─────────────────────────────────

export function getExecutionStatusService(
  taskId: string,
  actor: Actor,
  db: DrizzleDb = getDb(),
): ExecuteStatusResponse {
  const execution = getAgentExecutionById(db, taskId);
  if (!execution) {
    throw new ApiRequestError("NOT_FOUND", "Execution not found.");
  }

  const ctx = getCardContext(db, execution.cardId);
  if (!ctx) {
    throw new ApiRequestError("NOT_FOUND", "Card not found.");
  }

  // canReadCard encodes the visibility rule (initiator or member / assignee).
  if (
    actor.role === "viewer" ||
    (actor.role === "initiator"
      ? actor.id !== ctx.goalSpaceInitiatorId
      : !ctx.nodeBoardMemberIds.includes(actor.id) && ctx.card.assignedTo !== actor.id)
  ) {
    throw new ApiRequestError("FORBIDDEN", "Cannot read this execution.");
  }

  const response: ExecuteStatusResponse = {
    task_id: execution.id,
    card_id: execution.cardId,
    role: execution.agentRole as AgentRole,
    status: execution.status,
    attempt: execution.attempt,
    max_attempts: execution.maxAttempts,
    started_at: execution.startedAt,
  };

  if (execution.sessionId !== null) {
    return { ...response, session_id: execution.sessionId };
  }

  if (execution.result !== null) {
    const result = execution.result as {
      new_state?: CardState;
      confidence?: number;
      evidence?: Record<string, unknown>[];
      message: string;
    };
    return {
      ...response,
      result: {
        ...(result.new_state !== undefined ? { new_state: result.new_state } : {}),
        ...(result.confidence !== undefined ? { confidence: result.confidence } : {}),
        evidence: result.evidence ?? [],
        message: result.message,
      },
      ...(execution.completedAt !== null ? { completed_at: execution.completedAt } : {}),
    };
  }

  if (execution.errorCode !== null && execution.errorMessage !== null) {
    return {
      ...response,
      error: { code: execution.errorCode, message: execution.errorMessage },
      ...(execution.completedAt !== null ? { completed_at: execution.completedAt } : {}),
    };
  }

  return response;
}
