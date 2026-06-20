/**
 * AI Role registry (F2-07).
 *
 * The six documented AI roles from `docs/specs/interface_spec.md § 7.1`:
 *
 *   - Backlog Refiner:      (backlog → todo, trigger='dependencies_ready')
 *   - Todo Orchestrator:    (backlog → todo, trigger='context_complete')
 *   - Dev Crafter:          (todo → dev / dev → review, triggers per F-002)
 *   - Review Guard:         (dev → review / review → blocked|done, plus needs_confirmation on high-risk)
 *   - Done Reporter:        (review → done via 'review_passed')
 *   - Blocked Resolver:     (blocked → X via 'blocked_resolved')
 *
 * This module exports the registry; the fixture executor (`fixture-executor.ts`)
 * owns the role → transition logic.
 */

export const AGENT_ROLES = [
  "Backlog Refiner",
  "Todo Orchestrator",
  "Dev Crafter",
  "Review Guard",
  "Done Reporter",
  "Blocked Resolver",
] as const;

export type AgentRole = (typeof AGENT_ROLES)[number];

export const AGENT_ROLE_VALUES: readonly AgentRole[] = AGENT_ROLES;

export function isValidAgentRole(value: unknown): value is AgentRole {
  return typeof value === "string" && (AGENT_ROLE_VALUES as readonly string[]).includes(value);
}

/**
 * Estimated execution time per role (seconds). Used for the `estimated_time`
 * field in `ExecuteCardResponse`. These are constants; production may refine
 * via telemetry.
 */
export const ROLE_ESTIMATED_TIME_SECONDS: Readonly<Record<AgentRole, number>> = {
  "Backlog Refiner": 5,
  "Todo Orchestrator": 5,
  "Dev Crafter": 10,
  "Review Guard": 8,
  "Done Reporter": 3,
  "Blocked Resolver": 6,
};
