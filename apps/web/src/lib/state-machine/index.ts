/**
 * S2 F-002 状态机聚合入口
 *
 * 单一 import 点 — S3 handler / F-004 审计 wrapper / S4 UI 派生状态
 * 全部从 `@/lib/state-machine` 引,避免散点 import。
 */

// Re-export @db/schema 透传的类型(避免散点 import)
export type { CardState, GoalSpaceStatus, TransitionActor } from "@db/schema";

export {
  // constants
  TRANSITION_TRIGGERS,
  CARD_TRANSITIONS,
  CARD_STATES,
  TRANSITION_ACTOR_VALUES,
  // predicates
  isValidState,
  isTerminalState,
  // core API
  canTransition,
  assertTransition,
  getRequiredActor,
  // types
  type CardTransitionRule,
  type TransitionTrigger,
} from "./card";

export {
  // constants
  GOAL_SPACE_STATUS_VALUES,
  GOAL_SPACE_TRANSITIONS,
  // predicates
  isValidGoalSpaceState,
  isGoalSpaceTerminal,
  // core API
  canGoalSpaceTransition,
  assertGoalSpaceTransition,
  // types
  type GoalSpaceTransitionRule,
  type GoalSpaceCompleteOpts,
  type GoalSpaceCancelOpts,
  type GoalSpaceAssertOpts,
} from "./goal-space";
