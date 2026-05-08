# KEPLAR ER Diagram

本文档是实体关系图的架构视图。字段级定义以 `docs/specs/database_design.md` 为准。

```mermaid
erDiagram
    User ||--o{ GoalSpace : initiates
    GoalSpace ||--o{ NodeBoard : contains
    GoalSpace ||--o{ Card : contains
    GoalSpace ||--o{ Session : runs
    GoalSpace ||--o{ AgentExecution : executes
    GoalSpace ||--o{ RealtimeEvent : publishes
    NodeBoard ||--o{ Card : scopes
    NodeBoard ||--o{ NodeBoardMember : has
    User ||--o{ NodeBoardMember : joins
    Session ||--o{ StateTransition : groups
    Session ||--o{ AgentExecution : groups
    Card ||--o{ AgentExecution : runs
    Card ||--o{ StateTransition : has
    Card ||--o{ HumanConfirmation : triggers
    User ||--o{ HumanConfirmation : decides

    User {
        uuid id PK
        string name
        string email
        string role
        jsonb preferences
        timestamp created_at
        timestamp last_login_at
    }

    GoalSpace {
        uuid id PK
        string name
        text description
        jsonb constraints
        jsonb acceptance_criteria
        string status
        float progress
        uuid initiator_id FK
        timestamp started_at
        timestamp completed_at
        timestamp cancelled_at
        text cancel_reason
        timestamp deleted_at
    }

    NodeBoard {
        uuid id PK
        uuid goal_space_id FK
        string key
        string name
        string status
        timestamp deleted_at
    }

    NodeBoardMember {
        uuid id PK
        uuid node_board_id FK
        uuid user_id FK
        string role
        timestamp created_at
        timestamp removed_at
    }

    Session {
        uuid id PK
        uuid goal_space_id FK
        string status
        string trigger
        string actor
        jsonb context
        timestamp started_at
        timestamp completed_at
    }

    AgentExecution {
        uuid id PK
        uuid goal_space_id FK
        uuid session_id FK
        uuid card_id FK
        string role
        string status
        integer attempt
        integer max_attempts
        jsonb input_context
        jsonb result
        string error_code
        timestamp started_at
        timestamp completed_at
    }

    Card {
        uuid id PK
        string display_id
        uuid goal_space_id FK
        uuid node_board_id FK
        string title
        string state
        integer priority
        string risk_level
        string assigned_to
        jsonb context
        jsonb evidence
        float confidence
        timestamp blocked_at
        timestamp deleted_at
    }

    StateTransition {
        uuid id PK
        uuid card_id FK
        uuid session_id FK
        string from_state
        string to_state
        string trigger
        string actor
        text reason
        jsonb evidence
    }

    HumanConfirmation {
        uuid id PK
        uuid card_id FK
        string status
        string trigger_type
        string target_state
        text trigger_reason
        uuid decided_by FK
        timestamp expires_at
    }

    AuditEntry {
        uuid id PK
        string entity_type
        uuid entity_id
        string actor
        string action
        jsonb before_state
        jsonb after_state
        jsonb details
    }

    RealtimeEvent {
        uuid id PK
        uuid goal_space_id FK
        integer sequence
        string type
        string resource_type
        uuid resource_id
        string actor_type
        string actor_id
        jsonb data
        timestamp occurred_at
    }
```

## 决策说明

- `GoalSpace` 是核心聚合根。
- `NodeBoard` 持久化，用于节点视图、成员访问和上下游流转。
- `NodeBoardMember` 是节点访问控制来源，不使用 JSON 成员数组做权限边界。
- `Session` 持久化，用于分组目标空间运行、SSE 恢复、审计关联和断点续传。
- `AgentExecution` 持久化，用于单次 AI 角色执行；其 `id` 是接口返回的 `task_id`。
- `RealtimeEvent` 持久化，用于 SSE replay、断线补偿和多标签页状态同步。
- `Card.id` 是 UUID，`Card.display_id` 是 `CARD-001` 形式的人类可读编号。
- 治理记录不级联删除；业务实体使用 `deleted_at` 软删除。
