/**
 * KEPLAR 领域核心 schema (S2 F-001)
 *
 * 11 张表 + 12 个 enum literal union + 1 helper enum + 22 个 InferSelectModel/InferInsertModel 类型。
 *
 * 真相源:
 *   - docs/specs/database_design.md  (F-001 字段 + 索引 + SQLite 适配)
 *   - docs/architecture/state_transition.md § 1 § 6  (enum literal union 值集合)
 *   - docs/specs/authorization_matrix.md § 2         (userRole / actorType 值集合)
 *
 * SQLite 适配 (per database_design.md § 6):
 *   - UUID 主键: text + DEFAULT (lower(hex(randomblob(16))))
 *   - JSONB 字段: text + mode:"json" + DEFAULT '{}' / '[]'
 *   - timestamp:  text + DEFAULT (datetime('now'))
 *   - 索引顺序:  (col_a, col_b) — SQLite B-tree 双向扫描,DESC 由 ORDER BY 表达,索引中不显式带 DESC
 *   - cards.tags GIN 索引: SQLite 无 GIN,查询用 json_extract,索引在 § 6 已声明 drop
 *
 * partial unique index: Drizzle 0.36 用 .where(sql`...`) 表达;R-1 风险由 db:check + 人工校对 enforce。
 */

import { sql, type InferInsertModel, type InferSelectModel } from "drizzle-orm";
import { index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

// ════════════════════════════════════════════════════════════════════
//  1. Enum literal unions (12 spec + 1 helper)
// ════════════════════════════════════════════════════════════════════

// § 3.1 goal_spaces.status
export const GOAL_SPACE_STATUS_VALUES = ["draft", "active", "completed", "cancelled"] as const;
export type GoalSpaceStatus = (typeof GOAL_SPACE_STATUS_VALUES)[number];

// § 3.6 cards.state
export const CARD_STATES = [
  "backlog",
  "todo",
  "dev",
  "review",
  "done",
  "blocked",
  "cancelled",
] as const;
export type CardState = (typeof CARD_STATES)[number];

// § 3.2 node_boards.status (DB-004: 'paused' replaced with 'completed' per spec)
export const NODE_BOARD_STATUS_VALUES = ["active", "completed", "archived"] as const;
export type NodeBoardStatus = (typeof NODE_BOARD_STATUS_VALUES)[number];

// § 3.4 sessions.status
export const SESSION_STATUS_VALUES = [
  "queued",
  "running",
  "completed",
  "failed",
  "cancelled",
] as const;
export type SessionStatus = (typeof SESSION_STATUS_VALUES)[number];

export const SESSION_TRIGGER_VALUES = ["manual_start", "ai_retry", "system_resume"] as const;
export type SessionTrigger = (typeof SESSION_TRIGGER_VALUES)[number];

export const SESSION_ACTOR_VALUES = ["human", "ai_role", "system"] as const;
export type SessionActor = (typeof SESSION_ACTOR_VALUES)[number];

// § 3.5 agent_executions.status
export const AGENT_EXECUTION_STATUS_VALUES = [
  "queued",
  "running",
  "completed",
  "failed",
  "blocked",
  "needs_confirmation",
  "cancelled",
] as const;
export type AgentExecutionStatus = (typeof AGENT_EXECUTION_STATUS_VALUES)[number];

// § 1 transition actor (state_transition.md)
export const TRANSITION_ACTOR_VALUES = ["human", "ai_role", "system"] as const;
export type TransitionActor = (typeof TRANSITION_ACTOR_VALUES)[number];

// § 3.8 human_confirmations.status (DB-013: 'timed_out' → 'cancelled' per spec)
export const CONFIRMATION_STATUS_VALUES = ["pending", "approved", "rejected", "cancelled"] as const;
export type ConfirmationStatus = (typeof CONFIRMATION_STATUS_VALUES)[number];

// § 3.8 human_confirmations.trigger_type (DB-012: spec-aligned 5-value set)
export const CONFIRMATION_TRIGGER_TYPE_VALUES = [
  "high_risk",
  "low_confidence",
  "external_write",
  "deployment",
  "irreversible",
] as const;
export type ConfirmationTriggerType = (typeof CONFIRMATION_TRIGGER_TYPE_VALUES)[number];

// § 3.11 users.role / § 2 authorization_matrix.md
export const USER_ROLE_VALUES = ["initiator", "chain_user", "viewer"] as const;
export type UserRole = (typeof USER_ROLE_VALUES)[number];

// § 3.9 audit_entries.entity_type (7 values, "confirm" 而非 "confirmation" — 见 notes.md 与 realtime 不一致)
export const ENTITY_TYPE_VALUES = [
  "goal_space",
  "node_board",
  "node_board_member",
  "card",
  "session",
  "agent_execution",
  "confirm",
] as const;
export type EntityType = (typeof ENTITY_TYPE_VALUES)[number];

// § 2 authorization_matrix.md — alias of TransitionActor, 单独导出供 audit context 引用
export const ACTOR_TYPE_VALUES = TRANSITION_ACTOR_VALUES;
export type ActorType = TransitionActor;

// § 3.8 human_confirmations.risk_level
export const RISK_LEVEL_VALUES = ["low", "medium", "high", "critical"] as const;
export type RiskLevel = (typeof RISK_LEVEL_VALUES)[number];

// Helper: § 3.3 node_board_members.role (DB-005: replaced 'editor'/'observer' with
// 'owner'/'member' per spec; default is now 'member')
export const NODE_BOARD_MEMBER_ROLE_VALUES = ["owner", "member", "viewer"] as const;
export type NodeBoardMemberRole = (typeof NODE_BOARD_MEMBER_ROLE_VALUES)[number];

// ════════════════════════════════════════════════════════════════════
//  2. Tables (topological order: parents before children)
// ════════════════════════════════════════════════════════════════════

// ─── 2.1 users (database_design.md § 3.11) ─────────────────────────
export const users = sqliteTable(
  "users",
  {
    id: text("id")
      .primaryKey()
      .default(sql`(lower(hex(randomblob(16))))`),
    name: text("name").notNull(),
    email: text("email").notNull(),
    role: text("role", { enum: USER_ROLE_VALUES }).notNull().default("chain_user"),
    preferences: text("preferences", { mode: "json" })
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'`),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(datetime('now'))`),
    lastLoginAt: text("last_login_at"),
  },
  (t) => ({
    emailUnique: uniqueIndex("idx_users_email_unique").on(t.email),
  }),
);

// ─── 2.2 goal_spaces (database_design.md § 3.1) ────────────────────
// DB-001: renamed `title` → `name`; added progress, constraints,
// acceptance_criteria, started_at, cancelled_at, deleted_at (per spec § 3.1).
export const goalSpaces = sqliteTable(
  "goal_spaces",
  {
    id: text("id")
      .primaryKey()
      .default(sql`(lower(hex(randomblob(16))))`),
    initiatorId: text("initiator_id")
      .notNull()
      .references(() => users.id),
    name: text("name").notNull(),
    description: text("description"),
    constraints: text("constraints", { mode: "json" })
      .$type<Record<string, unknown>[]>()
      .notNull()
      .default(sql`'[]'`),
    acceptanceCriteria: text("acceptance_criteria", { mode: "json" }).$type<
      Record<string, unknown>[]
    >(),
    status: text("status", { enum: GOAL_SPACE_STATUS_VALUES }).notNull().default("draft"),
    progress: real("progress").notNull().default(0),
    templateId: text("template_id"),
    tags: text("tags", { mode: "json" })
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'`),
    startedAt: text("started_at"),
    completedAt: text("completed_at"),
    cancelledAt: text("cancelled_at"),
    cancelReason: text("cancel_reason"),
    deletedAt: text("deleted_at"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(datetime('now'))`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (t) => ({
    initiatorIdx: index("idx_goal_spaces_initiator").on(t.initiatorId),
    statusIdx: index("idx_goal_spaces_status").on(t.status),
    deletedAtIdx: index("idx_goal_spaces_deleted_at").on(t.deletedAt),
  }),
);

// ─── 2.3 node_boards (database_design.md § 3.2) ────────────────────
// DB-003: column 'title' → 'name' (spec § 3.2).
// DB-004: status enum shifted to ('active','completed','archived') via 0004.
export const nodeBoards = sqliteTable(
  "node_boards",
  {
    id: text("id")
      .primaryKey()
      .default(sql`(lower(hex(randomblob(16))))`),
    goalSpaceId: text("goal_space_id")
      .notNull()
      .references(() => goalSpaces.id),
    key: text("key").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    status: text("status", { enum: NODE_BOARD_STATUS_VALUES }).notNull().default("active"),
    displayOrder: integer("display_order").notNull().default(0),
    context: text("context", { mode: "json" })
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'`),
    deletedAt: text("deleted_at"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(datetime('now'))`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (t) => ({
    goalSpaceKeyPartialUnique: uniqueIndex("idx_node_boards_goal_space_key_active")
      .on(t.goalSpaceId, t.key)
      .where(sql`deleted_at IS NULL`),
    goalSpaceIdx: index("idx_node_boards_goal_space").on(t.goalSpaceId),
  }),
);

// ─── 2.4 node_board_members (database_design.md § 3.3) ─────────────
export const nodeBoardMembers = sqliteTable(
  "node_board_members",
  {
    id: text("id")
      .primaryKey()
      .default(sql`(lower(hex(randomblob(16))))`),
    boardId: text("board_id")
      .notNull()
      .references(() => nodeBoards.id),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    role: text("role", { enum: NODE_BOARD_MEMBER_ROLE_VALUES }).notNull().default("member"),
    invitedBy: text("invited_by").references(() => users.id),
    joinedAt: text("joined_at")
      .notNull()
      .default(sql`(datetime('now'))`),
    removedAt: text("removed_at"),
  },
  (t) => ({
    boardUserActiveUnique: uniqueIndex("idx_node_board_members_board_user_active")
      .on(t.boardId, t.userId)
      .where(sql`removed_at IS NULL`),
    userIdx: index("idx_node_board_members_user").on(t.userId),
  }),
);

// ─── 2.5 sessions (database_design.md § 3.4) ───────────────────────
// Spec § 3.4: sessions is a *run-session* (trigger/actor/actor_name/started_at/
// completed_at/context) — not a user-session. userId/role/expiresAt/lastActiveAt/
// closedAt/closeReason are intentionally absent; auth-style session concerns
// live elsewhere (e.g. login session) and are out of scope for § 3.4.
export const sessions = sqliteTable(
  "sessions",
  {
    id: text("id")
      .primaryKey()
      .default(sql`(lower(hex(randomblob(16))))`),
    goalSpaceId: text("goal_space_id")
      .notNull()
      .references(() => goalSpaces.id),
    status: text("status", { enum: SESSION_STATUS_VALUES }).notNull().default("queued"),
    trigger: text("trigger", { enum: SESSION_TRIGGER_VALUES }).notNull(),
    actor: text("actor", { enum: SESSION_ACTOR_VALUES }).notNull(),
    actorName: text("actor_name"),
    context: text("context", { mode: "json" })
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'`),
    startedAt: text("started_at"),
    completedAt: text("completed_at"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(datetime('now'))`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (t) => ({
    goalSpaceIdx: index("idx_sessions_goal_space").on(t.goalSpaceId),
    statusIdx: index("idx_sessions_status").on(t.status),
    createdIdx: index("idx_sessions_created").on(t.createdAt),
  }),
);

// ─── 2.6 cards (database_design.md § 3.6) ──────────────────────────
export const cards = sqliteTable(
  "cards",
  {
    id: text("id")
      .primaryKey()
      .default(sql`(lower(hex(randomblob(16))))`),
    goalSpaceId: text("goal_space_id")
      .notNull()
      .references(() => goalSpaces.id),
    nodeBoardId: text("node_board_id")
      .notNull()
      .references(() => nodeBoards.id),
    displayId: text("display_id").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    state: text("state", { enum: CARD_STATES }).notNull().default("backlog"),
    assignedTo: text("assigned_to").references(() => users.id),
    priority: integer("priority").notNull().default(0),
    riskLevel: text("risk_level", { enum: RISK_LEVEL_VALUES }).notNull().default("medium"),
    evidence: text("evidence", { mode: "json" })
      .$type<Record<string, unknown>[]>()
      .notNull()
      .default(sql`'[]'`),
    confidence: real("confidence"),
    dependencies: text("dependencies", { mode: "json" })
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'`),
    tags: text("tags", { mode: "json" })
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'`),
    context: text("context", { mode: "json" })
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'`),
    blockedReason: text("blocked_reason"),
    blockedAt: text("blocked_at"),
    cancelledReason: text("cancelled_reason"),
    cancelledAt: text("cancelled_at"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(datetime('now'))`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`(datetime('now'))`),
    deletedAt: text("deleted_at"),
  },
  (t) => ({
    goalSpaceDisplayIdPartialUnique: uniqueIndex("idx_cards_goal_space_display_id_active")
      .on(t.goalSpaceId, t.displayId)
      .where(sql`deleted_at IS NULL`),
    goalSpaceIdx: index("idx_cards_goal_space").on(t.goalSpaceId),
    nodeBoardIdx: index("idx_cards_node_board").on(t.nodeBoardId),
    stateIdx: index("idx_cards_state").on(t.state),
    assignedToIdx: index("idx_cards_assigned_to").on(t.assignedTo),
    displayIdIdx: index("idx_cards_display_id").on(t.displayId),
    priorityIdx: index("idx_cards_priority").on(sql`${t.priority} DESC`),
    riskLevelIdx: index("idx_cards_risk_level").on(t.riskLevel),
    createdIdx: index("idx_cards_created").on(sql`${t.createdAt} DESC`),
  }),
);

// ─── 2.7 agent_executions (database_design.md § 3.5) ───────────────
export const agentExecutions = sqliteTable(
  "agent_executions",
  {
    id: text("id")
      .primaryKey()
      .default(sql`(lower(hex(randomblob(16))))`),
    goalSpaceId: text("goal_space_id")
      .notNull()
      .references(() => goalSpaces.id),
    cardId: text("card_id")
      .notNull()
      .references(() => cards.id),
    sessionId: text("session_id").references(() => sessions.id),
    agentRole: text("agent_role").notNull(),
    trigger: text("trigger").notNull(),
    status: text("status", { enum: AGENT_EXECUTION_STATUS_VALUES }).notNull().default("queued"),
    attempt: integer("attempt").notNull().default(1),
    maxAttempts: integer("max_attempts").notNull().default(2),
    requestedByType: text("requested_by_type", { enum: TRANSITION_ACTOR_VALUES })
      .notNull()
      .default("human"),
    requestedById: text("requested_by_id"),
    requestedByName: text("requested_by_name"),
    inputContext: text("input_context", { mode: "json" })
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'`),
    result: text("result", { mode: "json" }).$type<Record<string, unknown>>(),
    errorCode: text("error_code"),
    errorMessage: text("error_message"),
    durationMs: integer("duration_ms"),
    startedAt: text("started_at")
      .notNull()
      .default(sql`(datetime('now'))`),
    completedAt: text("completed_at"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(datetime('now'))`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (t) => ({
    goalSpaceIdx: index("idx_agent_executions_goal_space").on(t.goalSpaceId),
    cardIdx: index("idx_agent_executions_card").on(t.cardId),
    sessionIdx: index("idx_agent_executions_session").on(t.sessionId),
    statusIdx: index("idx_agent_executions_status").on(t.status),
    roleIdx: index("idx_agent_executions_role").on(t.agentRole),
    createdIdx: index("idx_agent_executions_created").on(sql`${t.createdAt} DESC`),
  }),
);

// ─── 2.8 state_transitions (database_design.md § 3.7) ──────────────
// DB-022 (Wave 1): added `card_id` (nullable for legacy rows; future rows
// must set it per the S3 spec § 3.7). No reliable join key from
// entityType='card' rows in S1/S2 data, so the migration does not backfill
// — application code enforces.
// DB-010 / DB-020 / DB-040 (Wave 2 sub-group E): added `session_id` (FK),
// renamed `created_at` → `timestamp` and `actor_type` → `actor`, added
// `actor_name`, and added the three spec § 3.7 indexes on
// (card_id, timestamp), (session_id), and (actor).
export const stateTransitions = sqliteTable(
  "state_transitions",
  {
    id: text("id")
      .primaryKey()
      .default(sql`(lower(hex(randomblob(16))))`),
    cardId: text("card_id").references(() => cards.id),
    sessionId: text("session_id").references(() => sessions.id),
    entityType: text("entity_type", { enum: ENTITY_TYPE_VALUES }).notNull(),
    entityId: text("entity_id").notNull(),
    fromState: text("from_state"),
    toState: text("to_state").notNull(),
    trigger: text("trigger").notNull(),
    actor: text("actor", { enum: TRANSITION_ACTOR_VALUES }).notNull(),
    actorName: text("actor_name"),
    actorId: text("actor_id"),
    reason: text("reason"),
    metadata: text("metadata", { mode: "json" })
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'`),
    timestamp: text("timestamp")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (t) => ({
    entityIdx: index("idx_state_transitions_entity").on(t.entityType, t.entityId),
    cardIdIdx: index("idx_state_transitions_card_id").on(t.cardId),
    cardTimestampIdx: index("idx_state_transitions_card_timestamp").on(t.cardId, t.timestamp),
    sessionIdIdx: index("idx_state_transitions_session_id").on(t.sessionId),
    actorIdx: index("idx_state_transitions_actor").on(t.actor),
  }),
);

// ─── 2.9 human_confirmations (database_design.md § 3.8) ─────────────
// DB-011: added 10 spec-aligned columns (triggered_by/at, target_state,
// ai_summary, risk_factors, recommendations, ai_confidence, decision_outcome,
// decision_comment, resolved_at). DB-012 + DB-013 reflected in the enum
// literal unions at the top of this file (new trigger_type 5-value set,
// status 'timed_out' → 'cancelled').
export const humanConfirmations = sqliteTable(
  "human_confirmations",
  {
    id: text("id")
      .primaryKey()
      .default(sql`(lower(hex(randomblob(16))))`),
    cardId: text("card_id")
      .notNull()
      .references(() => cards.id),
    triggerType: text("trigger_type", { enum: CONFIRMATION_TRIGGER_TYPE_VALUES }).notNull(),
    targetState: text("target_state"),
    triggerReason: text("trigger_reason"),
    triggeredBy: text("triggered_by").references(() => users.id),
    triggeredAt: text("triggered_at"),
    aiSummary: text("ai_summary"),
    riskFactors: text("risk_factors", { mode: "json" })
      .$type<Record<string, unknown>[]>()
      .notNull()
      .default(sql`'[]'`),
    recommendations: text("recommendations", { mode: "json" })
      .$type<Record<string, unknown>[]>()
      .notNull()
      .default(sql`'[]'`),
    aiConfidence: real("ai_confidence"),
    riskLevel: text("risk_level", { enum: RISK_LEVEL_VALUES }).notNull().default("medium"),
    context: text("context", { mode: "json" })
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'`),
    status: text("status", { enum: CONFIRMATION_STATUS_VALUES }).notNull().default("pending"),
    decisionOutcome: text("decision_outcome"),
    decisionBy: text("decision_by").references(() => users.id),
    decisionReason: text("decision_reason"),
    decisionComment: text("decision_comment"),
    decidedAt: text("decided_at"),
    resolvedAt: text("resolved_at"),
    expiresAt: text("expires_at").notNull(),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(datetime('now'))`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (t) => ({
    cardPendingPartialUnique: uniqueIndex("idx_human_confirmations_card_pending")
      .on(t.cardId)
      .where(sql`status = 'pending'`),
    statusIdx: index("idx_human_confirmations_status").on(t.status),
    expiresAtIdx: index("idx_human_confirmations_expires_at").on(t.expiresAt),
  }),
);

// ─── 2.10 audit_entries (database_design.md § 3.9) ─────────────────
//      append-only: no update/delete/truncate API (enforced in F-004)
//      DB-019 + DB-042: rename actor_type → actor, occurred_at → timestamp,
//                      add actor_name; rename index to idx_audit_entries_timestamp
export const auditEntries = sqliteTable(
  "audit_entries",
  {
    id: text("id")
      .primaryKey()
      .default(sql`(lower(hex(randomblob(16))))`),
    entityType: text("entity_type", { enum: ENTITY_TYPE_VALUES }).notNull(),
    entityId: text("entity_id").notNull(),
    action: text("action").notNull(),
    actor: text("actor", { enum: ACTOR_TYPE_VALUES }).notNull(),
    actorName: text("actor_name"),
    actorId: text("actor_id"),
    beforeState: text("before_state", { mode: "json" }).$type<Record<string, unknown> | null>(),
    afterState: text("after_state", { mode: "json" }).$type<Record<string, unknown> | null>(),
    details: text("details", { mode: "json" })
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'`),
    timestamp: text("timestamp")
      .notNull()
      .default(sql`(datetime('now'))`),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (t) => ({
    entityIdx: index("idx_audit_entries_entity").on(t.entityType, t.entityId),
    timestampIdx: index("idx_audit_entries_timestamp").on(t.timestamp),
  }),
);

// ─── 2.11 realtime_events (database_design.md § 3.10) ──────────────
//      resource_type 与 audit entity_type 在值集上略有差异(此为 "confirmation", 彼为 "confirm"),
//      见 implementation/notes.md F-001 § 不一致项。resource_type 不加 enum 约束以避免 type 漂移;
//      后续若需类型安全,可另开 realtimeResourceType 单独定义。
//      DB-016 + DB-017 + DB-031 + DB-043: rename event_type → type, payload → data,
//                                        published_at → occurred_at;
//                                        replace publishedAtIdx with
//                                        idx_realtime_events_occurred_at;
//                                        idx_realtime_events_goal_space_sequence
//                                        (per spec §3.10) is preserved.
export const realtimeEvents = sqliteTable(
  "realtime_events",
  {
    id: text("id")
      .primaryKey()
      .default(sql`(lower(hex(randomblob(16))))`),
    goalSpaceId: text("goal_space_id")
      .notNull()
      .references(() => goalSpaces.id),
    sequence: integer("sequence").notNull(),
    type: text("type").notNull(),
    resourceType: text("resource_type").notNull(),
    resourceId: text("resource_id").notNull(),
    data: text("data", { mode: "json" })
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'`),
    occurredAt: text("occurred_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (t) => ({
    goalSpaceSequenceUnique: uniqueIndex("idx_realtime_events_goal_space_sequence").on(
      t.goalSpaceId,
      t.sequence,
    ),
    occurredAtIdx: index("idx_realtime_events_occurred_at").on(t.occurredAt),
  }),
);

// ════════════════════════════════════════════════════════════════════
//  3. Inferred types (per F-001.5: 后续 F-002/003/004 引用)
// ════════════════════════════════════════════════════════════════════

export type User = InferSelectModel<typeof users>;
export type NewUser = InferInsertModel<typeof users>;

export type GoalSpace = InferSelectModel<typeof goalSpaces>;
export type NewGoalSpace = InferInsertModel<typeof goalSpaces>;

export type NodeBoard = InferSelectModel<typeof nodeBoards>;
export type NewNodeBoard = InferInsertModel<typeof nodeBoards>;

export type NodeBoardMember = InferSelectModel<typeof nodeBoardMembers>;
export type NewNodeBoardMember = InferInsertModel<typeof nodeBoardMembers>;

export type Session = InferSelectModel<typeof sessions>;
export type NewSession = InferInsertModel<typeof sessions>;

export type Card = InferSelectModel<typeof cards>;
export type NewCard = InferInsertModel<typeof cards>;

export type AgentExecution = InferSelectModel<typeof agentExecutions>;
export type NewAgentExecution = InferInsertModel<typeof agentExecutions>;

export type StateTransition = InferSelectModel<typeof stateTransitions>;
export type NewStateTransition = InferInsertModel<typeof stateTransitions>;

export type HumanConfirmation = InferSelectModel<typeof humanConfirmations>;
export type NewHumanConfirmation = InferInsertModel<typeof humanConfirmations>;

export type AuditEntry = InferSelectModel<typeof auditEntries>;
export type NewAuditEntry = InferInsertModel<typeof auditEntries>;

export type RealtimeEvent = InferSelectModel<typeof realtimeEvents>;
export type NewRealtimeEvent = InferInsertModel<typeof realtimeEvents>;

// ════════════════════════════════════════════════════════════════════
//  4. Aggregated schema (back-compat with S1 placeholder export)
// ════════════════════════════════════════════════════════════════════

export const schema = {
  users,
  goalSpaces,
  nodeBoards,
  nodeBoardMembers,
  sessions,
  cards,
  agentExecutions,
  stateTransitions,
  humanConfirmations,
  auditEntries,
  realtimeEvents,
} as const;

export type Schema = typeof schema;
