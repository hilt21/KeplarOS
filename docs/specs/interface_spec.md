# KEPLAR 接口规范

## 1. REST API 概述

### 1.1 基础信息

| 项目 | 值 |
|------|---|
| 基础路径 | `/api/v1` |
| 认证方式 | HttpOnly Cookie (Session Token) |
| 内容类型 | `application/json` |
| 字符编码 | UTF-8 |

The Phase 2 **Web Collaboration Beta** API target is to implement the `/api/v1` Web beta API through Next.js route handlers. Route handlers must use the shared response envelope, session actor extraction, authorization matrix, state machines, audit transaction boundary, and realtime event contract.

### 1.2 规范口径

| 项目 | 统一口径 |
|------|----------|
| 领域模型来源 | 第一阶段以 TypeScript/Drizzle schema 作为接口与数据库类型的主来源，Rust 运行时后续对齐同一契约 |
| 卡片主键 | `id` 使用 UUID |
| 卡片展示编号 | `display_id` 使用 `CARD-001` 等人类可读编号 |
| 目标空间状态 | `draft` / `active` / `completed` / `cancelled` |
| 卡片状态 | `backlog` / `todo` / `dev` / `review` / `done` / `blocked` / `cancelled` |
| 优先级 | `priority` 使用整数，数值越大优先级越高 |
| 风险等级 | `risk_level` 是一等字段，不仅依赖 `tags` |
| SSE 事件命名 | 以本文件第 8 节事件名为准；事件 envelope 和重连合同详见 `docs/specs/realtime_events.md` |
| 权限规则 | 详见 `docs/specs/authorization_matrix.md` |

### 1.3 全局响应格式

```typescript
// 成功响应
interface ApiResponse<T> {
  success: true
  data: T
  timestamp: string
}

// 错误响应
interface ApiError {
  success: false
  error: {
    code: string
    message: string
    details?: Record<string, string[]>
  }
  timestamp: string
}
```

### 1.4 HTTP 状态码

| 状态码 | 含义 |
|--------|------|
| 200 | 成功 |
| 201 | 创建成功 |
| 204 | 删除成功（无返回体） |
| 400 | 请求参数错误 |
| 401 | 未认证 |
| 403 | 无权限 |
| 404 | 资源不存在 |
| 409 | 状态冲突（如重复创建） |
| 422 | 业务逻辑错误 |
| 500 | 服务器内部错误 |

---

## 2. 认证接口

### 2.1 登录

```
POST /api/v1/auth/login
```

**请求体：**
```typescript
interface LoginRequest {
  email: string
  password: string
}
```

**响应 (200)：**
```typescript
interface LoginResponse {
  user: {
    id: string
    name: string
    email: string
    role: 'initiator' | 'chain_user' | 'viewer'
  }
  expires_at: string // 30min 后过期
}
```

---

## 3. 目标空间接口

### 3.0 Story 草稿接口（Web Beta deterministic demo）

`POST /api/v1/story-drafts/generate` accepts `{ goal }` from an initiator and
returns an editable structured draft with `source: "deterministic_demo"`.
It performs no external I/O.

`POST /api/v1/story-drafts/apply` accepts `{ story_application_id, draft }`.
It creates a new Goal Space, one `initial` Node Board, and initial Cards in a
single audited transaction. `story_application_id` is idempotent only per
authenticated initiator: a same-initiator retry returns `200` with
`applied: false` and the existing Goal Space, while another initiator using
the same value creates and can access only their own Goal Space. The first
application returns `201` with `applied: true`.

The editable draft is strictly validated before any write. Invalid fields
return `400 INVALID_FIELD` and create no Goal Space, Board, Card, audit entry,
or realtime event. The apply boundary permits at most 50 Cards, at most 50
items in each top-level string collection, and at most 4,000 characters in
each editable string.

### 3.1 创建目标空间

```
POST /api/v1/goal-spaces
```

**请求体：**
```typescript
interface CreateGoalSpaceRequest {
  name: string
  description?: string
  constraints?: string[]
  acceptance_criteria?: {
    criterion: string
    evidence: string[]
  }[]
}
```

**响应 (201)：**
```typescript
interface GoalSpaceResponse {
  id: string
  name: string
  description: string
  constraints: string[]
  acceptance_criteria: AcceptanceCriterion[]
  status: GoalSpaceStatus
  progress: number
  initiator_id: string
  node_board_counts: {
    total: number
    active: number
    completed: number
  }
  card_counts: {
    backlog: number
    todo: number
    dev: number
    review: number
    done: number
    blocked: number
    cancelled: number
  }
  created_at: string
  updated_at: string
}

type GoalSpaceStatus = 'draft' | 'active' | 'completed' | 'cancelled'
```

### 3.2 获取目标空间列表

```
GET /api/v1/goal-spaces?status=active&page=1&limit=20
```

**查询参数：**

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| status | string | - | 过滤状态：draft/active/completed/cancelled |
| page | number | 1 | 页码 |
| limit | number | 20 | 每页数量（最大100） |

**响应 (200)：**
```typescript
interface GoalSpaceListResponse {
  items: GoalSpaceResponse[]
  total: number
  page: number
  limit: number
}
```

### 3.3 获取目标空间详情

```
GET /api/v1/goal-spaces/:id
```

**响应 (200)：**
```typescript
interface GoalSpaceDetailResponse extends GoalSpaceResponse {
  started_at?: string
  completed_at?: string
  cancelled_at?: string
  cancel_reason?: string
  cards: CardResponse[]
}
```

### 3.4 更新目标空间

```
PATCH /api/v1/goal-spaces/:id
```

**请求体：**
```typescript
interface UpdateGoalSpaceRequest {
  name?: string
  description?: string
  constraints?: string[]
  acceptance_criteria?: AcceptanceCriterion[]
}
```

### 3.5 启动目标空间

```
POST /api/v1/goal-spaces/:id/start
```

**响应 (200)：**
```typescript
interface StartGoalSpaceResponse {
  status: 'active'
  started_at: string
  cards_generated: number
}
```

### 3.6 完成目标空间

```
POST /api/v1/goal-spaces/:id/complete
```

**响应 (200)：**
```typescript
interface CompleteGoalSpaceResponse {
  status: 'completed'
  completed_at: string
  summary: {
    total_cards: number
    done_cards: number
    blocked_cards: number
  }
}
```

### 3.7 取消目标空间

```
POST /api/v1/goal-spaces/:id/cancel
```

**请求体：**
```typescript
interface CancelGoalSpaceRequest {
  reason: string
}
```

**响应 (200)：**
```typescript
interface CancelGoalSpaceResponse {
  status: 'cancelled'
  cancelled_at: string
  cancel_reason: string
  summary: {
    total_cards: number
    done_cards: number
    cancelled_cards: number
    blocked_cards: number
  }
}
```

### 3.8 节点看板接口

节点看板用于承载链路节点视图、成员访问范围和上下游流转边界。

```
GET /api/v1/goal-spaces/:goalSpaceId/node-boards
POST /api/v1/goal-spaces/:goalSpaceId/node-boards
GET /api/v1/node-boards/:id
PATCH /api/v1/node-boards/:id
POST /api/v1/node-boards/:id/members
DELETE /api/v1/node-boards/:id/members/:userId
```

```typescript
interface CreateNodeBoardRequest {
  key: string
  name: string
  description?: string
  members?: {
    user_id: string
    role: 'owner' | 'member' | 'viewer'
  }[]
}

interface UpdateNodeBoardRequest {
  name?: string
  description?: string
  status?: 'active' | 'completed' | 'archived'
}

interface NodeBoardResponse {
  id: string
  goal_space_id: string
  key: string
  name: string
  description?: string
  members: NodeBoardMemberResponse[]
  status: 'active' | 'completed' | 'archived'
  created_at: string
  updated_at: string
}

interface NodeBoardMemberResponse {
  user_id: string
  name?: string
  role: 'owner' | 'member' | 'viewer'
}

interface AddNodeBoardMemberRequest {
  user_id: string
  role: 'owner' | 'member' | 'viewer'
}
```

---

## 4. 卡片接口

### 4.1 创建卡片

```
POST /api/v1/goal-spaces/:goalSpaceId/cards
```

**请求体：**
```typescript
interface CreateCardRequest {
  title: string
  description?: string
  node_board_id?: string
  assigned_to?: string
  priority?: number
  risk_level?: 'low' | 'medium' | 'high' | 'critical'
  dependencies?: string[]
  tags?: string[]
}
```

**响应 (201)：**
```typescript
interface CardResponse {
  id: string
  display_id: string
  goal_space_id: string
  node_board_id?: string
  title: string
  description: string
  state: CardState
  assigned_to: string
  priority: number
  risk_level: 'low' | 'medium' | 'high' | 'critical'
  context: Record<string, unknown>
  evidence: Evidence[]
  confidence: number
  blocked_reason?: string
  blocked_at?: string
  dependencies: string[]
  tags: string[]
  created_at: string
  updated_at: string
}

type CardState = 'backlog' | 'todo' | 'dev' | 'review' | 'done' | 'blocked' | 'cancelled'
```

### 4.2 获取卡片列表

```
GET /api/v1/goal-spaces/:goalSpaceId/cards?state=backlog&assigned_to=user1
```

**查询参数：**

| 参数 | 类型 | 说明 |
|------|------|------|
| state | string | 过滤状态 |
| assigned_to | string | 过滤负责人 |
| tags | string | 标签过滤（逗号分隔） |

### 4.3 获取卡片详情

```
GET /api/v1/cards/:id
```

**响应 (200)：**
```typescript
interface CardDetailResponse extends CardResponse {
  transitions: StateTransitionResponse[]
  confirmations: HumanConfirmationResponse[]
  audit_trail: AuditEntryResponse[]
}
```

### 4.4 更新卡片

```
PATCH /api/v1/cards/:id
```

**请求体：**
```typescript
interface UpdateCardRequest {
  title?: string
  description?: string
  assigned_to?: string
  priority?: number
  risk_level?: 'low' | 'medium' | 'high' | 'critical'
  tags?: string[]
}
```

### 4.5 分配卡片

```
POST /api/v1/cards/:id/assign
```

**请求体：**
```typescript
interface AssignCardRequest {
  assigned_to: string
}
```

### 4.6 手动阻塞卡片

```
POST /api/v1/cards/:id/block
```

**请求体：**
```typescript
interface BlockCardRequest {
  reason: string
}
```

### 4.7 解决阻塞

```
POST /api/v1/cards/:id/unblock
```

**请求体：**
```typescript
interface UnblockCardRequest {
  target_state: 'backlog' | 'todo' | 'dev' | 'review'
}
```

---

## 5. 状态流转接口

### 5.1 获取卡片流转历史

```
GET /api/v1/cards/:id/transitions
```

**响应 (200)：**
```typescript
interface StateTransitionResponse {
  id: string
  card_id: string
  from_state: CardState
  to_state: CardState
  trigger: string
  actor: 'human' | 'ai_role' | 'system'
  actor_name: string
  reason: string
  evidence: Evidence[]
  timestamp: string
}
```

---

## 6. 人工确认接口

### 6.1 获取待确认列表

```
GET /api/v1/confirmations?status=pending
```

**响应 (200)：**
```typescript
interface ConfirmationListResponse {
  items: HumanConfirmationResponse[]
  total: number
}

interface HumanConfirmationResponse {
  id: string
  card_id: string
  card_title: string
  status: 'pending' | 'approved' | 'rejected' | 'cancelled'
  trigger_type: 'high_risk' | 'low_confidence' | 'external_write' | 'deployment' | 'irreversible'
  trigger_reason: string
  triggered_by: string
  triggered_at: string
  ai_summary: string
  risk_factors: string[]
  recommendations: string[]
  ai_confidence: number
  target_state?: CardState
  decision?: {
    outcome: 'approved' | 'rejected'
    decided_by: string
    decided_at: string
    comment: string
    reason: string
  }
  expires_at: string
  created_at: string
}
```

### 6.2 处理确认

```
POST /api/v1/confirmations/:id/decide
```

**请求体：**
```typescript
interface DecideConfirmationRequest {
  outcome: 'approved' | 'rejected'
  comment?: string
  reason: string // rejected 时必填
}
```

**响应 (200)：**
```typescript
interface DecideConfirmationResponse {
  id: string
  status: 'approved' | 'rejected'
  decided_by: string
  decided_at: string
  card_state_changed: boolean
  new_card_state?: CardState
}
```

**门禁规则：**
- 高风险、低置信度、外部系统写操作、部署和不可逆操作必须先创建 `pending` 确认。
- 若卡片存在 `pending` 确认，`execute`、`unblock`、`complete` 以及外部写工具调用必须拒绝或暂停。
- 确认通过后，卡片流转到确认记录中的 `target_state`。
- 确认拒绝后，卡片进入 `blocked`，并记录拒绝原因。

---

## 7. AI 执行接口

`task_id` 对应 `agent_executions.id`。`sessions.id` 只表示一次目标空间运行会话；一次会话可包含多条 `agent_executions`。

### 7.1 触发 AI 角色执行

```
POST /api/v1/cards/:id/execute
```

**请求体：**
```typescript
interface ExecuteCardRequest {
  role: 'Backlog Refiner' | 'Todo Orchestrator' | 'Dev Crafter' | 'Review Guard' | 'Done Reporter' | 'Blocked Resolver'
  context?: Record<string, unknown> // 额外上下文
}
```

**响应 (202)：**
```typescript
interface ExecuteCardResponse {
  task_id: string
  session_id?: string
  card_id: string
  role: string
  status: 'queued'
  estimated_time: number // 秒
  polling_url: string
}
```

### 7.2 查询执行状态

```
GET /api/v1/execute/:taskId
```

**响应 (200)：**
```typescript
interface ExecuteStatusResponse {
  task_id: string
  session_id?: string
  card_id: string
  role: 'Backlog Refiner' | 'Todo Orchestrator' | 'Dev Crafter' | 'Review Guard' | 'Done Reporter' | 'Blocked Resolver'
  status: 'queued' | 'running' | 'completed' | 'failed' | 'blocked' | 'needs_confirmation' | 'cancelled'
  attempt: number
  max_attempts: number
  progress?: number // 0-100
  result?: {
    new_state?: CardState
    confidence?: number
    evidence?: Evidence[]
    message: string
  }
  error?: {
    code: string
    message: string
  }
  started_at: string
  completed_at?: string
}
```

---

## 8. SSE 实时推送

完整事件 envelope、replay cursor、重连和多标签页策略详见 `docs/specs/realtime_events.md`。本节只列接口入口和事件名称。

### 8.1 建立 SSE 连接

```
GET /api/v1/sse?goal_space_id=xxx
```

**认证：** 通过 Cookie 自动认证

**事件类型：**

| 事件 | 说明 | 优先级 |
|------|------|--------|
| `card_state_changed` | 卡片状态变更 | 高 |
| `card_created` | 新卡片创建 | 高 |
| `card_blocked` | 卡片进入阻塞 | 高 |
| `ai_role_started` | AI 角色开始执行 | 中 |
| `ai_role_completed` | AI 角色完成 | 中 |
| `ai_role_failed` | AI 角色失败或阻塞 | 高 |
| `confirmation_requested` | 人工确认请求 | 高 |
| `confirmation_decided` | 确认被处理 | 高 |
| `goal_space_updated` | 目标空间更新 | 低 |
| `goal_space_cancelled` | 目标空间取消 | 高 |
| `session_started` | 运行会话启动 | 中 |
| `session_completed` | 运行会话完成 | 中 |
| `session_failed` | 运行会话失败 | 高 |

**事件格式：**
```typescript
interface SSEEvent {
  id: string
  sequence: number
  type: string
  goal_space_id: string
  resource: {
    type: 'goal_space' | 'node_board' | 'node_board_member' | 'card' | 'session' | 'agent_execution' | 'confirmation'
    id: string
  }
  actor: {
    type: 'human' | 'ai_role' | 'system'
    id?: string
    name?: string
  }
  data: Record<string, unknown>
  occurred_at: string
}
```

### 8.2 断开重连策略

- 客户端保存最近收到的 `id`，通过 `Last-Event-ID` 恢复。
- 断开后让 `EventSource` 自动重连；连续 3 次失败后显示非阻塞的 stale-data 提示。
- 断开期间的消息通过事件 replay API 补偿：
  ```
  GET /api/v1/goal-spaces/:id/events?after_id=<event_id>&limit=100
  ```

---

## 9. 健康检查接口

### 9.1 存活检查

```
GET /api/health
```

**响应 (200)：**
```typescript
interface HealthResponse {
  status: 'healthy'
  version: string
  timestamp: string
}
```

### 9.2 就绪检查

```
GET /api/health/ready
```

**响应 (200)：**
```typescript
interface ReadyResponse {
  status: 'ready'
  checks: {
    database: 'ok' | 'error'
    llm: 'ok' | 'error'
    sse: 'ok' | 'error'
  }
  timestamp: string
}
```

---

## 10. 错误码汇总

| 错误码 | HTTP状态 | 说明 |
|--------|----------|------|
| `AUTH_REQUIRED` | 401 | 需要登录 |
| `AUTH_EXPIRED` | 401 | 会话已过期 |
| `FORBIDDEN` | 403 | 无权限 |
| `NOT_FOUND` | 404 | 资源不存在 |
| `INVALID_REQUEST` | 400 | 请求参数错误 |
| `VALIDATION_ERROR` | 422 | 业务验证失败 |
| `STATE_CONFLICT` | 409 | 状态冲突 |
| `CONFIRMATION_REQUIRED` | 409 | 存在待处理人工确认，当前操作被门禁阻断 |
| `INTERNAL_ERROR` | 500 | 服务器内部错误 |

---

## 11. 分页与过滤

### 11.1 标准分页

```typescript
interface PaginationParams {
  page: number      // 默认 1
  limit: number     // 默认 20，最大 100
}

interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  limit: number
  has_more: boolean
}
```

### 11.2 时间范围过滤

```
GET /api/v1/cards?created_after=2026-01-01T00:00:00Z&created_before=2026-12-31T23:59:59Z
```
