# KEPLAR 权限矩阵

## 1. 适用范围

本规范定义第一阶段 API 与领域服务的最小权限边界。所有运行时（Next.js API、Axum API、Tauri 本地 API）必须执行同一套资源归属和角色判断，不能只依赖前端隐藏按钮。

## 2. 角色定义

| 角色 | 说明 |
|------|------|
| `initiator` | 目标空间发起人，负责创建、启动、终结目标空间，并处理人工确认 |
| `chain_user` | 链路节点用户，负责认领、补充上下文、处理当前节点卡片 |
| `viewer` | 只读用户，可查看有权限的目标空间、卡片和审计轨迹 |

## 3. 资源归属规则

| 资源 | 归属字段 | 访问规则 |
|------|----------|----------|
| Goal Space | `goal_spaces.initiator_id` | 发起人可管理自己创建的目标空间；其他用户必须通过节点成员关系获得访问权 |
| Node Board | `node_boards.goal_space_id`, `node_board_members.user_id` | 发起人可管理目标空间内节点；非发起人必须是有效节点成员 |
| Node Board Member | `node_board_members.node_board_id`, `node_board_members.user_id` | 仅目标空间发起人可增删成员；成员可读取自己的成员关系 |
| Card | `cards.goal_space_id`, `cards.node_board_id`, `cards.assigned_to` | 发起人可查看目标空间内全部卡片；链路用户默认只访问本节点或分配给自己的卡片 |
| Session | `sessions.goal_space_id` | 继承目标空间权限 |
| Agent Execution | `agent_executions.goal_space_id`, `agent_executions.card_id` | 继承目标空间和卡片权限；`task_id` 不得绕过卡片访问权 |
| Human Confirmation | `human_confirmations.card_id` | 继承卡片权限；只有目标空间发起人可做最终确认决策 |
| Audit Entry | `audit_entries.entity_type`, `audit_entries.entity_id` | 继承对应实体读取权限；不可被业务用户修改或删除 |

跨 `goal_space_id` 访问必须返回 `403`，即使资源 ID 存在。

## 4. API 权限矩阵

| API | initiator | chain_user | viewer | 资源约束 |
|-----|-----------|------------|--------|----------|
| `POST /api/v1/goal-spaces` | 允许 | 禁止 | 禁止 | 创建者成为 `initiator_id` |
| `GET /api/v1/goal-spaces` | 允许 | 允许 | 允许 | 只返回可访问目标空间 |
| `GET /api/v1/goal-spaces/:id` | 允许 | 允许 | 允许 | 需目标空间或节点访问权 |
| `PATCH /api/v1/goal-spaces/:id` | 允许 | 禁止 | 禁止 | 仅目标空间发起人 |
| `POST /api/v1/goal-spaces/:id/start` | 允许 | 禁止 | 禁止 | 仅目标空间发起人 |
| `POST /api/v1/goal-spaces/:id/complete` | 允许 | 禁止 | 禁止 | 仅目标空间发起人；不得存在未解决阻塞或待确认 |
| `POST /api/v1/goal-spaces/:id/cancel` | 允许 | 禁止 | 禁止 | 仅目标空间发起人；取消运行会话、AI 执行和待确认 |
| `GET /api/v1/goal-spaces/:goalSpaceId/node-boards` | 允许 | 允许 | 允许 | 发起人返回全部节点；其他用户只返回 `node_board_members` 中的有效节点 |
| `POST /api/v1/goal-spaces/:goalSpaceId/node-boards` | 允许 | 禁止 | 禁止 | 仅目标空间发起人 |
| `GET /api/v1/node-boards/:id` | 允许 | 允许 | 允许 | 需节点访问权 |
| `PATCH /api/v1/node-boards/:id` | 允许 | 禁止 | 禁止 | 仅目标空间发起人 |
| `POST /api/v1/node-boards/:id/members` | 允许 | 禁止 | 禁止 | 仅目标空间发起人；必须写审计 |
| `DELETE /api/v1/node-boards/:id/members/:userId` | 允许 | 禁止 | 禁止 | 仅目标空间发起人；软移除成员并写审计 |
| `POST /api/v1/goal-spaces/:goalSpaceId/cards` | 允许 | 允许 | 禁止 | 链路用户只能在可访问节点内创建 |
| `GET /api/v1/goal-spaces/:goalSpaceId/cards` | 允许 | 允许 | 允许 | 链路用户默认限有效成员节点/本人卡片 |
| `GET /api/v1/cards/:id` | 允许 | 允许 | 允许 | 需卡片访问权 |
| `PATCH /api/v1/cards/:id` | 允许 | 允许 | 禁止 | 链路用户需本节点或本人卡片 |
| `POST /api/v1/cards/:id/assign` | 允许 | 允许 | 禁止 | 链路用户只能认领可访问卡片 |
| `POST /api/v1/cards/:id/block` | 允许 | 允许 | 禁止 | 需卡片访问权；必须写审计 |
| `POST /api/v1/cards/:id/unblock` | 允许 | 允许 | 禁止 | 不得存在 pending confirmation |
| `GET /api/v1/cards/:id/transitions` | 允许 | 允许 | 允许 | 需卡片读取权 |
| `GET /api/v1/confirmations?status=pending` | 允许 | 允许 | 禁止 | 发起人看目标空间待确认；链路用户看相关卡片待确认 |
| `POST /api/v1/confirmations/:id/decide` | 允许 | 禁止 | 禁止 | 仅目标空间发起人 |
| `POST /api/v1/cards/:id/execute` | 允许 | 允许 | 禁止 | 不得存在 pending confirmation；外部写操作需确认 |
| `GET /api/v1/execute/:taskId` | 允许 | 允许 | 允许 | `taskId` 对应 `agent_executions.id`，继承卡片和会话权限 |
| `GET /api/v1/sse?goal_space_id=xxx` | 允许 | 允许 | 允许 | 只推送可访问事件 |
| `GET /api/health` | 允许 | 允许 | 允许 | 不暴露敏感依赖细节 |
| `GET /api/health/ready` | 管理环境限定 | 管理环境限定 | 禁止 | 生产环境需运维鉴权或内网限定 |

## 5. 强制门禁

以下操作必须先检查是否存在 `pending` 的人工确认：

- AI 执行：`POST /api/v1/cards/:id/execute`
- 阻塞解除：`POST /api/v1/cards/:id/unblock`
- 目标完成：`POST /api/v1/goal-spaces/:id/complete`
- 外部系统写操作、部署、不可逆操作

目标取消 `POST /api/v1/goal-spaces/:id/cancel` 是终止操作，不受 pending confirmation 阻断；它必须取消相关 pending confirmation、运行会话和未完成 AI 执行，并写入审计。

若存在待确认记录，接口必须返回 `409 STATE_CONFLICT`，错误码使用 `CONFIRMATION_REQUIRED`。

## 6. 审计要求

所有写操作必须写入 append-only 审计记录。审计写入与主业务变更必须处于同一事务；审计写入失败时，主业务操作必须失败。
