/**
 * Wire types matching the F2-03..F2-07 service return shapes.
 *
 * The client UI consumes only these types; the F2-02..F2-07 service modules
 * own the database rows. Names use snake_case for fields (matching the
 * JSON envelope) but TypeScript-friendly camelCase aliases are exported
 * for callers that prefer idiomatic TS.
 */

export type CardState = "backlog" | "todo" | "dev" | "review" | "done" | "blocked" | "cancelled";

export type GoalSpaceStatus = "draft" | "active" | "completed" | "cancelled";

export type NodeBoardStatus = "active" | "completed" | "archived";

export type RiskLevel = "low" | "medium" | "high" | "critical";

export type ConfirmationStatus = "pending" | "approved" | "rejected" | "cancelled";

export type AgentExecutionStatus =
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "blocked"
  | "needs_confirmation"
  | "cancelled";

export type Role =
  | "Backlog Refiner"
  | "Todo Orchestrator"
  | "Dev Crafter"
  | "Review Guard"
  | "Done Reporter"
  | "Blocked Resolver";

// ─── envelope ────────────────────────────────────────────────────────

export interface ApiOk<T> {
  readonly success: true;
  readonly data: T;
  readonly timestamp: string;
}

export interface ApiErr {
  readonly success: false;
  readonly error: {
    readonly code: string;
    readonly message: string;
    readonly details?: Record<string, string[]>;
  };
  readonly timestamp: string;
}

export type ApiResponse<T> = ApiOk<T> | ApiErr;

// ─── Goal Space ─────────────────────────────────────────────────────

export interface GoalSpaceResponse {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly constraints: readonly string[];
  readonly acceptance_criteria: readonly { criterion: string; evidence: readonly string[] }[];
  readonly status: GoalSpaceStatus;
  readonly progress: number;
  readonly initiator_id: string;
  readonly created_at: string;
  readonly updated_at: string;
}

export interface GoalSpaceDetailResponse extends GoalSpaceResponse {
  readonly started_at?: string;
  readonly completed_at?: string;
  readonly cancelled_at?: string;
  readonly cancel_reason?: string;
  readonly cards: readonly CardResponse[] | readonly unknown[];
}

export interface GoalSpaceListResponse {
  readonly items: readonly GoalSpaceResponse[];
  readonly total: number;
  readonly page: number;
  readonly limit: number;
}

// ─── Node Board ─────────────────────────────────────────────────────

export interface NodeBoardMemberResponse {
  readonly user_id: string;
  readonly role: "owner" | "member" | "viewer";
  readonly board_id: string;
}

export interface NodeBoardResponse {
  readonly id: string;
  readonly goal_space_id: string;
  readonly key: string;
  readonly name: string;
  readonly description: string;
  readonly members: readonly NodeBoardMemberResponse[];
  readonly status: NodeBoardStatus;
  readonly created_at: string;
  readonly updated_at: string;
}

export interface NodeBoardListResponse {
  readonly items: readonly NodeBoardResponse[];
  readonly total: number;
}

// ─── Card ───────────────────────────────────────────────────────────

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

export interface CardDetailResponse extends CardResponse {
  readonly transitions: readonly StateTransitionResponse[];
  readonly confirmations: readonly HumanConfirmationResponse[];
  readonly audit_trail: readonly AuditEntrySummary[];
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

export interface AuditEntrySummary {
  readonly id: string;
  readonly action: string;
  readonly actor: string;
  readonly actor_id: string | null;
  readonly timestamp: string;
}

// ─── Confirmation ───────────────────────────────────────────────────

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
  readonly risk_factors: readonly Record<string, unknown>[];
  readonly recommendations: readonly Record<string, unknown>[];
  readonly ai_confidence: number | null;
  readonly target_state: string | null;
  readonly decision?: {
    readonly outcome: "approved" | "rejected";
    readonly decided_by: string;
    readonly decided_at: string;
    readonly comment: string | null;
    readonly reason: string | null;
  };
  readonly expires_at: string;
  readonly created_at: string;
}

export interface ConfirmationListResponse {
  readonly items: readonly HumanConfirmationResponse[];
  readonly total: number;
}

// ─── Execution ──────────────────────────────────────────────────────

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
  readonly role: Role;
  readonly status: AgentExecutionStatus;
  readonly attempt: number;
  readonly max_attempts: number;
  readonly result?: ExecuteResultBlock;
  readonly error?: ExecuteErrorBlock;
  readonly started_at: string;
  readonly completed_at?: string;
}

// ─── Realtime SSE ───────────────────────────────────────────────────

export type RealtimeEventType =
  | "card_created"
  | "card_state_changed"
  | "card_blocked"
  | "ai_role_started"
  | "ai_role_completed"
  | "ai_role_failed"
  | "confirmation_requested"
  | "confirmation_decided"
  | "goal_space_updated"
  | "goal_space_cancelled"
  | "session_started"
  | "session_completed"
  | "session_failed"
  | "card_updated"
  | "card_assigned"
  | "card_unblocked"
  | "node_board_created"
  | "node_board_updated"
  | "node_board_member_added"
  | "node_board_member_removed";

export interface RealtimeEvent {
  readonly id: string;
  readonly sequence: number;
  readonly type: RealtimeEventType;
  readonly goal_space_id: string;
  readonly resource: { readonly type: string; readonly id: string };
  readonly actor: { readonly type: string; readonly id?: string; readonly name?: string };
  readonly data: Record<string, unknown>;
  readonly occurred_at: string;
}

export interface RealtimeEventsResponse {
  readonly events: readonly RealtimeEvent[];
  readonly has_more: boolean;
  readonly next_after_id?: string;
}
