/**
 * Agent Execution repository (F2-07).
 *
 * Focused query/write helpers used by
 * `apps/web/src/lib/services/executions.ts`. Read helpers take the
 * production `DrizzleDb`; write helpers take the `AuditTx` produced by
 * `runWithAudit` so the execution lifecycle write shares a single
 * transaction with the audit entry and realtime event.
 */

import { and, eq } from "drizzle-orm";
import { agentExecutions, humanConfirmations, type AgentExecutionStatus } from "@db/schema";
import type { DrizzleDb } from "@/lib/db/client";
import type { AuditTx } from "@/lib/audit/run-with-audit";

// ─── types ─────────────────────────────────────────────────────────

export interface AgentExecutionRow {
  readonly id: string;
  readonly goalSpaceId: string;
  readonly cardId: string;
  readonly sessionId: string | null;
  readonly agentRole: string;
  readonly trigger: string;
  readonly status: AgentExecutionStatus;
  readonly attempt: number;
  readonly maxAttempts: number;
  readonly requestedByType: string;
  readonly requestedById: string | null;
  readonly requestedByName: string | null;
  readonly inputContext: Record<string, unknown>;
  readonly result: Record<string, unknown> | null;
  readonly errorCode: string | null;
  readonly errorMessage: string | null;
  readonly durationMs: number | null;
  readonly startedAt: string;
  readonly completedAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CreateAgentExecutionInput {
  readonly id: string;
  readonly goalSpaceId: string;
  readonly cardId: string;
  readonly agentRole: string;
  readonly trigger: string;
  readonly status: AgentExecutionStatus;
  readonly requestedById: string;
  readonly requestedByName: string;
  readonly inputContext: Record<string, unknown>;
  readonly startedAt: string;
}

export interface UpdateAgentExecutionInput {
  readonly status: AgentExecutionStatus;
  readonly result: Record<string, unknown> | null;
  readonly errorCode: string | null;
  readonly errorMessage: string | null;
  readonly durationMs: number;
  readonly completedAt: string;
}

export interface CreateHumanConfirmationInput {
  readonly id: string;
  readonly cardId: string;
  readonly triggerType:
    | "high_risk"
    | "low_confidence"
    | "external_write"
    | "deployment"
    | "irreversible";
  readonly targetState: string | null;
  readonly triggerReason: string;
  readonly triggeredBy: string;
  readonly triggeredAt: string;
  readonly aiSummary: string;
  readonly aiConfidence: number;
  readonly riskLevel: "low" | "medium" | "high" | "critical";
  readonly expiresAt: string;
}

// ─── write helpers (inside runWithAudit transaction) ──────────────

export function createAgentExecution(
  tx: AuditTx,
  input: CreateAgentExecutionInput,
): AgentExecutionRow {
  const row = tx
    .insert(agentExecutions)
    .values({
      id: input.id,
      goalSpaceId: input.goalSpaceId,
      cardId: input.cardId,
      agentRole: input.agentRole,
      trigger: input.trigger,
      status: input.status,
      requestedById: input.requestedById,
      requestedByName: input.requestedByName,
      inputContext: input.inputContext,
      startedAt: input.startedAt,
    })
    .returning()
    .get();
  return row as AgentExecutionRow;
}

export function updateAgentExecutionResult(
  tx: AuditTx,
  id: string,
  input: UpdateAgentExecutionInput,
): AgentExecutionRow | null {
  const row = tx
    .update(agentExecutions)
    .set({
      status: input.status,
      result: input.result,
      errorCode: input.errorCode,
      errorMessage: input.errorMessage,
      durationMs: input.durationMs,
      completedAt: input.completedAt,
    })
    .where(eq(agentExecutions.id, id))
    .returning()
    .get();
  return (row as AgentExecutionRow | undefined) ?? null;
}

export function createHumanConfirmationForExecution(
  tx: AuditTx,
  input: CreateHumanConfirmationInput,
): void {
  tx.insert(humanConfirmations)
    .values({
      id: input.id,
      cardId: input.cardId,
      triggerType: input.triggerType,
      targetState: input.targetState,
      triggerReason: input.triggerReason,
      triggeredBy: input.triggeredBy,
      triggeredAt: input.triggeredAt,
      aiSummary: input.aiSummary,
      aiConfidence: input.aiConfidence,
      riskLevel: input.riskLevel,
      expiresAt: input.expiresAt,
      status: "pending",
    })
    .run();
}

// ─── read helpers ────────────────────────────────────────────────

export function getAgentExecutionById(db: DrizzleDb, id: string): AgentExecutionRow | null {
  const row = db.select().from(agentExecutions).where(eq(agentExecutions.id, id)).get();
  return (row as AgentExecutionRow | undefined) ?? null;
}

// Re-export and to avoid lint warnings about unused imports in some
// repository file conventions.
void and;
