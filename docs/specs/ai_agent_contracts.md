# KEPLAR AI Agent Contracts

## 1. Scope

This document defines the Phase 1 AI execution contract. It is the implementation source of truth for prompt inputs, structured outputs, validation, retry, blocked routing, human confirmation triggers, and audit evidence.

Phase 1 may use stub or fixture-backed executors for demo stability, but every executor must conform to this contract so real LLM calls can replace stubs without changing domain behavior.

## 2. Shared Executor Contract

`task_id` is the `agent_executions.id` persisted by the API before invoking an executor. `session_id` groups executions that belong to the same goal-space run.

```typescript
type AgentRole =
  | 'Backlog Refiner'
  | 'Todo Orchestrator'
  | 'Dev Crafter'
  | 'Review Guard'
  | 'Done Reporter'
  | 'Blocked Resolver'

interface AgentExecutionInput<TContext = Record<string, unknown>> {
  task_id: string
  session_id?: string
  role: AgentRole
  goal_space: GoalSpaceSnapshot
  card?: CardSnapshot
  node_board?: NodeBoardSnapshot
  context: TContext
  attempt: number
  max_attempts: 2
  requested_by: {
    actor: 'human' | 'ai_role' | 'system'
    actor_id?: string
    actor_name?: string
  }
}

interface AgentExecutionOutput<TResult = Record<string, unknown>> {
  role: AgentRole
  card_id?: string
  status: 'completed' | 'blocked' | 'needs_confirmation'
  result: TResult
  confidence: number
  evidence: Evidence[]
  next_action: AgentNextAction
  audit_summary: string
}

type AgentNextAction =
  | { type: 'transition'; target_state: CardState; reason: string }
  | { type: 'create_cards'; cards: CreateCardDraft[]; reason: string }
  | { type: 'request_confirmation'; trigger: ConfirmationTrigger; target_state: CardState; reason: string }
  | { type: 'blocked'; reason: string; retryable: boolean }
  | { type: 'none'; reason: string }
```

## 3. Universal Validation Rules

All AI outputs must pass validation before they can mutate domain state.

| Rule | Failure behavior |
|------|------------------|
| Output is valid JSON or YAML for the declared role schema | Retry once; if still invalid, mark card `blocked` |
| Required fields are present | Retry once; if still missing, mark card `blocked` |
| `confidence` is between 0 and 1 | Retry once; if still invalid, mark card `blocked` |
| `next_action.target_state` is legal from current card state | Reject output and mark card `blocked` |
| Evidence references are non-empty when role produces evidence | Retry once; if still empty, mark card `blocked` |
| High-risk, external write, deployment, irreversible, or low-confidence path is detected | Create pending human confirmation |

Retry policy:

- Maximum attempts: 2 total attempts.
- Retry delay: 3 seconds.
- Retry must write an audit entry with failure reason and attempt number.
- After final failure, card enters `blocked` with a machine-readable `blocked_reason`.

## 4. Human Confirmation Triggers

An agent must request confirmation when any condition applies:

| Trigger | Condition |
|---------|-----------|
| `high_risk` | `risk_level` is `high` or `critical` |
| `low_confidence` | Review Guard confidence `< 0.7` or Dev Crafter confidence `< 0.6` |
| `external_write` | Output proposes writing to repository, database, file system outside sandbox, or third-party system |
| `deployment` | Output proposes CI/CD deploy, release, or environment mutation |
| `irreversible` | Output proposes destructive or hard-to-rollback action |

Pending confirmation blocks `execute`, `unblock`, `complete`, and external write operations.

## 5. Backlog Refiner Contract

### 5.1 Purpose

Convert a natural-language goal into a structured YAML Story and initial card drafts.

### 5.2 Input

```typescript
interface BacklogRefinerContext {
  natural_language_goal: string
  known_constraints?: string[]
  preferred_node_boards?: {
    key: string
    name: string
  }[]
  demo_domain?: 'mechanical_rail' | string
}
```

### 5.3 Output

```typescript
interface BacklogRefinerResult {
  story: {
    goal: string
    problem_statement: string
    constraints: string[]
    acceptance_criteria: AcceptanceCriterionDraft[]
    output_requirements: string[]
    risk_hints: string[]
  }
  node_boards: NodeBoardDraft[]
  cards: CreateCardDraft[]
  dependencies: CardDependencyDraft[]
}

interface AcceptanceCriterionDraft {
  id: string
  criterion: string
  evidence_required: EvidenceRequirement[]
}

interface EvidenceRequirement {
  type: 'document' | 'test' | 'diagram' | 'review_record' | 'data' | 'code' | 'other'
  description: string
  required: boolean
}

interface NodeBoardDraft {
  key: string
  name: string
  description?: string
}

interface CreateCardDraft {
  display_id: string
  node_board_key?: string
  title: string
  description: string
  priority: number
  risk_level: 'low' | 'medium' | 'high' | 'critical'
  acceptance_criteria_ids: string[]
  dependencies: string[]
  tags: string[]
}

interface CardDependencyDraft {
  from_display_id: string
  to_display_id: string
  reason: string
}
```

### 5.4 Required Behavior

- Generate at least one card for a non-empty goal.
- Use UUID only after persistence; generated drafts must use `display_id`.
- Use numeric `priority`; recommended range is `0-100`.
- Use `risk_level`, not only tags, for risk.
- Create evidence requirements that Review Guard can check without guessing.
- If the goal is too ambiguous, return `status='blocked'` with missing questions rather than inventing critical facts.

### 5.5 Example

Input:

```yaml
natural_language_goal: "株机厂有一个10列6编组的南京地铁42号线项目开工了，交期是2027年6月，制动系统方案参考南京地铁24号线的技术方案。"
demo_domain: mechanical_rail
```

Output:

```yaml
role: Backlog Refiner
status: completed
confidence: 0.86
result:
  story:
    goal: 南京地铁42号线制动系统技术方案编制
    problem_statement: 需要在交期约束下完成制动系统方案，并复用南京地铁24号线经验。
    constraints:
      - 10列6编组
      - 2027年6月前完成
      - 参考南京地铁24号线技术方案
    acceptance_criteria:
      - id: AC-001
        criterion: 完成制动系统方案初稿
        evidence_required:
          - type: document
            description: 制动系统方案初稿
            required: true
      - id: AC-002
        criterion: 完成参考方案差异分析
        evidence_required:
          - type: review_record
            description: 差异分析评审记录
            required: true
    output_requirements:
      - 方案初稿
      - 差异分析
    risk_hints:
      - 参考方案兼容性需验证
  node_boards:
    - key: requirements
      name: 需求分析
    - key: solution
      name: 方案设计
  cards:
    - display_id: CARD-001
      node_board_key: requirements
      title: 制动系统需求分析
      description: 明确南京地铁42号线制动系统需求、交付约束和输入资料。
      priority: 90
      risk_level: medium
      acceptance_criteria_ids: [AC-001]
      dependencies: []
      tags: [mechanical_rail]
    - display_id: CARD-002
      node_board_key: solution
      title: 南京地铁24号线参考方案差异分析
      description: 对比42号线与24号线方案差异，识别复用风险。
      priority: 85
      risk_level: medium
      acceptance_criteria_ids: [AC-002]
      dependencies: [CARD-001]
      tags: [reference_analysis]
  dependencies:
    - from_display_id: CARD-001
      to_display_id: CARD-002
      reason: 差异分析依赖需求分析输入
next_action:
  type: create_cards
  reason: 目标已拆解为可执行卡片
audit_summary: Backlog Refiner generated YAML Story and two initial cards.
```

## 6. Todo Orchestrator Contract

Purpose: assign card execution order, dependencies, and target node boards.

Required output:

```typescript
interface TodoOrchestratorResult {
  assignments: {
    card_id: string
    execution_order: number
    assigned_lane: 'Dev Crafter'
    dependency_status: 'ready' | 'waiting' | 'blocked'
    target_state: 'todo' | 'blocked'
    reason: string
  }[]
}
```

Failure behavior:

- Circular dependency -> `blocked`.
- Missing dependency card -> `blocked`.
- Ready cards -> transition to `todo`.

## 7. Dev Crafter Contract

Purpose: execute a card and produce implementation evidence.

Required output:

```typescript
interface DevCrafterResult {
  output: string
  evidence: Evidence[]
  blockers: string[]
  proposed_external_actions: ExternalAction[]
}

interface ExternalAction {
  type: 'read' | 'write' | 'deploy' | 'irreversible'
  target: string
  reason: string
}
```

Failure behavior:

- External read failure may retry once.
- External write/deploy/irreversible action must request confirmation before execution.
- Confidence `< 0.6` requests confirmation or blocks if evidence is incomplete.

## 8. Review Guard Contract

### 8.1 Purpose

Evaluate implementation evidence against acceptance criteria and decide whether the card can proceed, needs revision, or requires human confirmation.

### 8.2 Input

```typescript
interface ReviewGuardContext {
  card: CardSnapshot
  implementation_evidence: Evidence[]
  acceptance_criteria: AcceptanceCriterionDraft[]
  risk_level: 'low' | 'medium' | 'high' | 'critical'
}
```

### 8.3 Output

```typescript
interface ReviewGuardResult {
  passed: boolean
  criteria_check: CriteriaCheck[]
  missing_evidence: EvidenceRequirement[]
  comments: string
  confidence: number
  recommended_next_state: 'done' | 'blocked'
}

interface CriteriaCheck {
  criterion_id: string
  criterion: string
  met: boolean
  evidence_required: EvidenceRequirement[]
  evidence_provided: Evidence[]
  reason: string
}
```

### 8.4 Required Behavior

- Every acceptance criterion must be checked explicitly.
- Missing required evidence means `passed=false`.
- `risk_level=high|critical` must request human confirmation before `done`.
- `confidence < 0.7` must request human confirmation before `done`.
- `passed=false` transitions to `blocked`.
- `passed=true` with no confirmation trigger transitions to `done`.

### 8.5 Example

Input:

```yaml
card:
  id: 2dbf...
  display_id: CARD-001
  state: review
  risk_level: medium
implementation_evidence:
  - type: document
    content: 制动系统需求分析_v1.docx
    location: /docs/requirements/
acceptance_criteria:
  - id: AC-001
    criterion: 完成制动系统方案初稿
    evidence_required:
      - type: document
        description: 制动系统方案初稿
        required: true
```

Output:

```yaml
role: Review Guard
card_id: 2dbf...
status: completed
confidence: 0.88
result:
  passed: true
  criteria_check:
    - criterion_id: AC-001
      criterion: 完成制动系统方案初稿
      met: true
      evidence_required:
        - type: document
          description: 制动系统方案初稿
          required: true
      evidence_provided:
        - type: document
          content: 制动系统需求分析_v1.docx
          location: /docs/requirements/
      reason: 已提供方案初稿文档证据。
  missing_evidence: []
  comments: 证据满足验收标准，可进入完成状态。
  confidence: 0.88
  recommended_next_state: done
next_action:
  type: transition
  target_state: done
  reason: Review passed with sufficient confidence.
audit_summary: Review Guard approved CARD-001 with all required evidence present.
```

## 9. Done Reporter Contract

Purpose: summarize completed cards and update goal or node progress.

Required output:

```typescript
interface DoneReporterResult {
  completed_cards: string[]
  summary: string
  goal_progress_delta: number
  downstream_node_board_key?: string
}
```

Failure behavior:

- No completed cards -> `next_action.type='none'`.
- Missing audit trail -> `blocked`.

## 10. Blocked Resolver Contract

Purpose: classify blocked reason and choose a recovery route.

Required output:

```typescript
interface BlockedResolverResult {
  root_cause: 'missing_context' | 'dependency_failed' | 'tool_failed' | 'review_failed' | 'invalid_ai_output' | 'confirmation_timeout'
  resolution_options: {
    target_state: 'backlog' | 'todo' | 'dev' | 'review' | 'cancelled'
    reason: string
    requires_human: boolean
  }[]
  recommended_target_state: 'backlog' | 'todo' | 'dev' | 'review' | 'cancelled'
}
```

Failure behavior:

- Three consecutive blocked attempts must request human takeover.
- Confirmation timeout must keep or move the card to `blocked`.
- Cancellation must transition to `cancelled`, not `done`.
