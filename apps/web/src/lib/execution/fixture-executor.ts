/**
 * Fixture executor (F2-07).
 *
 * Deterministic AI lane executor. Given the same `card` + `role`, returns
 * the same structured `FixtureExecutionResult`. NO external I/O: no LLM,
 * MCP, ACP, A2A, GitHub, shell, network, or filesystem writes. The
 * executor is pure and synchronous; the service is responsible for
 * persisting the result.
 *
 * Result shape (tagged union):
 *
 *   - `completed`:           executor finished; optionally transitions the card.
 *   - `needs_confirmation`:  executor recommends human approval before transitioning.
 *   - `failed`:              executor could not produce a valid result.
 *
 * The fixture outputs respect the F-002 state-machine (from, to, trigger)
 * tuples. Out-of-range transitions fall through to the `failed` branch.
 *
 * The `nowMs` parameter is the wall-clock time at execution start.
 * The service is responsible for passing it in; the executor does NOT
 * call `Date.now()` itself (deterministic testability).
 */

import type { CardState, RiskLevel } from "@db/schema";
import type { AgentRole } from "./roles";

// ─── input shape ──────────────────────────────────────────────────

export interface FixtureCardInput {
  readonly id: string;
  readonly title: string;
  readonly state: CardState;
  readonly riskLevel: RiskLevel;
  readonly assignedTo: string | null;
  readonly tags: readonly string[];
  readonly description: string | null;
}

// ─── result shapes ────────────────────────────────────────────────

export interface CompletedResult {
  readonly status: "completed";
  readonly new_state: CardState;
  readonly trigger: string;
  readonly confidence: number;
  readonly evidence: ReadonlyArray<Record<string, unknown>>;
  readonly message: string;
}

export interface NeedsConfirmationResult {
  readonly status: "needs_confirmation";
  readonly trigger_type:
    | "high_risk"
    | "low_confidence"
    | "external_write"
    | "deployment"
    | "irreversible";
  readonly target_state: CardState;
  readonly confidence: number;
  readonly evidence: ReadonlyArray<Record<string, unknown>>;
  readonly message: string;
}

export interface FailedResult {
  readonly status: "failed";
  readonly error: { code: string; message: string };
}

export type FixtureExecutionResult = CompletedResult | NeedsConfirmationResult | FailedResult;

// ─── helpers ─────────────────────────────────────────────────────

function failed(code: string, message: string): FixtureExecutionResult {
  return { status: "failed", error: { code, message } };
}

function checkTerminalState(card: FixtureCardInput): FixtureExecutionResult | null {
  if (card.state === "done" || card.state === "cancelled") {
    return failed("TERMINAL_STATE", `Cannot execute a card in terminal state: ${card.state}.`);
  }
  return null;
}

// ─── executor ─────────────────────────────────────────────────────

export function executeFixture(card: FixtureCardInput, role: AgentRole): FixtureExecutionResult {
  // Defensive: terminal-state cards cannot be executed.
  const terminal = checkTerminalState(card);
  if (terminal) return terminal;

  // Review Guard on a high-risk card → needs_confirmation.
  if (role === "Review Guard") {
    if (card.riskLevel === "high" || card.riskLevel === "critical") {
      return {
        status: "needs_confirmation",
        trigger_type: "high_risk",
        target_state: "done",
        confidence: 0.6,
        evidence: [],
        message: `Review Guard flagged output as ${card.riskLevel} risk; initiator approval required.`,
      };
    }
    // Review Guard on a non-high-risk card: low-confidence guard.
    if (card.riskLevel === "medium") {
      return {
        status: "needs_confirmation",
        trigger_type: "low_confidence",
        target_state: "done",
        confidence: 0.65,
        evidence: [],
        message: "Review Guard flagged medium-confidence output for approval.",
      };
    }
    // Review Guard on a low-risk card: pass through to review.
    if (card.state === "review") {
      return {
        status: "completed",
        new_state: "done",
        trigger: "review_passed",
        confidence: 0.9,
        evidence: [],
        message: "Review Guard passed the output.",
      };
    }
    return failed(
      "UNSUPPORTED_TRANSITION",
      `Review Guard cannot transition from state: ${card.state}.`,
    );
  }

  // Dev Crafter: dev lifecycle.
  if (role === "Dev Crafter") {
    if (card.state === "todo") {
      return {
        status: "completed",
        new_state: "dev",
        trigger: "execution_start",
        confidence: 0.85,
        evidence: [],
        message: "Dev Crafter started execution.",
      };
    }
    if (card.state === "dev") {
      // External write flag: high-risk tags or external system mention → confirmation.
      const hasExternalTag =
        card.tags.includes("external_write") ||
        card.tags.includes("external-system") ||
        card.title.toLowerCase().includes("external");
      if (hasExternalTag) {
        return {
          status: "needs_confirmation",
          trigger_type: "external_write",
          target_state: "review",
          confidence: 0.7,
          evidence: [],
          message: "Dev Crafter output touches an external system; approval required.",
        };
      }
      return {
        status: "completed",
        new_state: "review",
        trigger: "evidence_submitted",
        confidence: 0.8,
        evidence: [],
        message: "Dev Crafter submitted evidence for review.",
      };
    }
    return failed(
      "UNSUPPORTED_TRANSITION",
      `Dev Crafter cannot transition from state: ${card.state}.`,
    );
  }

  // Backlog Refiner: backlog → todo via dependencies_ready.
  if (role === "Backlog Refiner") {
    if (card.state === "backlog") {
      return {
        status: "completed",
        new_state: "todo",
        trigger: "dependencies_ready",
        confidence: 0.85,
        evidence: [],
        message: "Backlog Refiner prepared dependencies and context for the card.",
      };
    }
    return failed(
      "UNSUPPORTED_TRANSITION",
      `Backlog Refiner can only operate on backlog cards (current state: ${card.state}).`,
    );
  }

  // Todo Orchestrator: backlog → todo via context_complete.
  if (role === "Todo Orchestrator") {
    if (card.state === "backlog") {
      return {
        status: "completed",
        new_state: "todo",
        trigger: "context_complete",
        confidence: 0.85,
        evidence: [],
        message: "Todo Orchestrator confirmed context completeness.",
      };
    }
    return failed(
      "UNSUPPORTED_TRANSITION",
      `Todo Orchestrator can only operate on backlog cards (current state: ${card.state}).`,
    );
  }

  // Done Reporter: review → done via review_passed.
  if (role === "Done Reporter") {
    if (card.state === "review") {
      return {
        status: "completed",
        new_state: "done",
        trigger: "review_passed",
        confidence: 0.95,
        evidence: [],
        message: "Done Reporter archived the card.",
      };
    }
    return failed(
      "UNSUPPORTED_TRANSITION",
      `Done Reporter can only operate on review cards (current state: ${card.state}).`,
    );
  }

  // Blocked Resolver: blocked → {backlog|todo|dev|review} via blocked_resolved.
  if (role === "Blocked Resolver") {
    if (card.state === "blocked") {
      // Pick a sensible default target based on tags / context.
      const target: CardState = card.tags.includes("dev")
        ? "dev"
        : card.tags.includes("review")
          ? "review"
          : card.tags.includes("todo")
            ? "todo"
            : "backlog";
      return {
        status: "completed",
        new_state: target,
        trigger: "blocked_resolved",
        confidence: 0.75,
        evidence: [],
        message: `Blocked Resolver routed the card back to ${target}.`,
      };
    }
    return failed(
      "UNSUPPORTED_TRANSITION",
      `Blocked Resolver can only operate on blocked cards (current state: ${card.state}).`,
    );
  }

  return failed("UNSUPPORTED_ROLE", `Unknown role: ${role as string}`);
}
