# Request Analysis Tasks

Change ID: `20260606-s2-domain-core`
Status: request_analysis

S2 范围由 4 个 P0 feature 组成:F-001 → F-002 → F-003 → F-004。Phase 3 Implementation 按 F-001 → F-002 → F-003 → F-004 顺序,每个 feature 一个 commit。Phase 4 Testing 在每个 feature 落地后跑该 feature 的测试 + 5 条 baseline 命令。

## Implementation Tasks

### F-001 Drizzle Schema + Initial Migration

- [ ] F-001.1 在 `apps/web/db/schema.ts` 引入 11 张 Drizzle SQLite 表:`users` / `goal_spaces` / `node_boards` / `node_board_members` / `sessions` / `agent_executions` / `cards` / `state_transitions` / `human_confirmations` / `audit_entries` / `realtime_events`
  - Verify: `pnpm --filter web typecheck` 0 errors
- [ ] F-001.2 UUID 主键用 `text` + `lower(hex(randomblob(16)))` 默认;JSONB 用 `text` 默认 `'{}'` / `'[]'`;`created_at` / `updated_at` 默认 `CURRENT_TIMESTAMP`
  - Verify: `apps/web/db/schema.ts` 全部列类型与 `docs/specs/database_design.md` § 3 一致
- [ ] F-001.3 用 `sql\`...\`` 块补 partial unique index:`node_board_members (board, user) WHERE removed_at IS NULL`、`node_boards (goal_space, key) WHERE deleted_at IS NULL`、`cards (goal_space, display_id) WHERE deleted_at IS NULL`、`human_confirmations (card) WHERE status='pending'`、`realtime_events (goal_space, sequence)`
  - Verify: `pnpm --filter web db:check` 0 errors
- [ ] F-001.4 导出 enum literal union:`goalSpaceStatus` / `cardState` / `nodeBoardStatus` / `sessionStatus` / `agentExecutionStatus` / `transitionActor` / `confirmationStatus` / `confirmationTriggerType` / `userRole` / `entityType` / `actorType` / `riskLevel`
  - Verify: TS literal union 类型 + 值集合与 `database_design.md` § 1 / `state_transition.md` § 1 / `authorization_matrix.md` § 2 完全一致
- [ ] F-001.5 导出 `InferSelectModel` / `InferInsertModel` 类型给后续 F-002/003/004 引用
  - Verify: `apps/web/src/lib/`(后续)import 不报类型错
- [ ] F-001.6 `apps/web/package.json` 新增 scripts:`db:generate` / `db:migrate` / `db:check`(可选 `db:studio`)
  - Verify: `pnpm --filter web db --help` 列出 4 个脚本
- [ ] F-001.7 跑 `pnpm --filter web db:generate` 生成 `apps/web/db/migrations/0001_*.sql`;人工校对 + 补 partial index;`pnpm --filter web db:check` 0 errors
  - Verify: `apps/web/db/migrations/0001_*.sql` 与 `database_design.md` § 7.1 字段与索引一致
- [ ] F-001.8 跑 `pnpm --filter web db:migrate` 在干净 `apps/web/db/dev.db` 应用 0001;`sqlite3 apps/web/db/dev.db ".tables"` 列出 11 张表名
  - Verify: `.tables` 输出包含 `users goal_spaces node_boards node_board_members sessions agent_executions cards state_transitions human_confirmations audit_entries realtime_events`
- [ ] F-001.9 `apps/web/README.md` 增补 "Database" 段:11 张表概览 + `db:generate` / `db:migrate` / `db:check` 用法
  - Verify: README "Database" 段存在

### F-002 Card & Goal Space State Machines

- [ ] F-002.1 `apps/web/src/lib/state-machine/card.ts`:`canTransition(from: CardState, to: CardState, trigger?: TransitionTrigger): boolean` + `assertTransition(from, to, trigger?): void | throws` + `isTerminalState(state): boolean` + `getRequiredActor(from, to): ActorType` + `isValidState(state): boolean` + `CARD_STATES: readonly CardState[]` + `CARD_TRANSITIONS: readonly TransitionRule[]`
  - Verify: `pnpm --filter web test -- state-machine/card` 全绿
- [ ] F-002.2 `apps/web/src/lib/state-machine/goal-space.ts`:`canGoalSpaceTransition(from, to, opts?): boolean` + `assertGoalSpaceTransition(from, to, opts?): GoalSpaceCompleteRequirement[]`(返回缺哪条前置;空数组表示 OK) + `isGoalSpaceTerminal(state): boolean` + `GOAL_SPACE_STATES: readonly GoalSpaceStatus[]`
  - Verify: 单元测试覆盖 `complete` 前置条件缺一/缺二/缺三
- [ ] F-002.3 `apps/web/src/lib/state-machine/index.ts` re-export
  - Verify: `import { canTransition, ... } from "@/lib/state-machine"` 工作
- [ ] F-002.4 全部合法转移允许 + 全部非法转移拒绝 + 终态不可再转 + 角色分类正确
  - Verify: 单元测试 ≥ 80% 覆盖;`state_transition.md` § 4 表的全部 14 条规则 + 至少 10 条非法转移
- [ ] F-002.5 trigger 名与 `state_transition.md` § 6 `TransitionTrigger` 一致(11 个 trigger)
  - Verify: 11 个 trigger literal 全部存在 + 单测覆盖每个 trigger 至少一次合法转移

### F-003 Authorization Matrix

- [ ] F-003.1 `apps/web/src/lib/authorization/types.ts`:`Actor` / `AccessResult` / `ResourceContext` 类型定义
  - Verify: TS strict 编译过
- [ ] F-003.2 `apps/web/src/lib/authorization/goal-space.ts`:`canReadGoalSpace` / `canManageGoalSpace`
  - Verify: 单元测试覆盖 initiator/chain_user/viewer × own/other goalSpace
- [ ] F-003.3 `apps/web/src/lib/authorization/node-board.ts`:`canReadNodeBoard` / `canManageNodeBoard` / `canManageNodeBoardMembers`
  - Verify: 单元测试覆盖 initiator 全可见 / 非 initiator 成员可见 / 非成员不可见
- [ ] F-003.4 `apps/web/src/lib/authorization/card.ts`:`canReadCard` / `canMutateCard`
  - Verify: 单元测试覆盖 initiator/chain_user/viewer × 节点可见 / 分配给自己 / 跨 goalSpace
- [ ] F-003.5 `apps/web/src/lib/authorization/confirmation.ts`:`canDecideConfirmation`
  - Verify: 单元测试覆盖 initiator only / chain_user 拒绝 / viewer 拒绝
- [ ] F-003.6 `apps/web/src/lib/authorization/execute.ts`:`canExecuteCard(actor, card, members, hasPendingConfirmation)` 组合访问权 + 无 pending confirmation
  - Verify: 单元测试覆盖可访问 + 无 pending = true;可访问 + 有 pending = false;不可访问 = false
- [ ] F-003.7 `apps/web/src/lib/authorization/assert.ts`:`assertAccess(boolean, errorMessage): void | throws ForbiddenError` 抛错版本给 S3 handler
  - Verify: 单元测试覆盖 true 不抛 / false 抛 ForbiddenError
- [ ] F-003.8 `apps/web/src/lib/authorization/index.ts` re-export
  - Verify: `import { canReadGoalSpace, assertAccess, ... } from "@/lib/authorization"` 工作
- [ ] F-003.9 跨 `goal_space_id` 访问一律 false
  - Verify: 单元测试覆盖 `actor.goalSpaceId !== resource.goalSpaceId` 全 false

### F-004 Audit Transaction Wrapper

- [ ] F-004.1 `apps/web/src/lib/audit/run-with-audit.ts`:`runWithAudit(db, ctx: AuditContext, fn: (tx) => Promise<T>): Promise<T>`;`AuditContext = { entityType, entityId, actor, action, beforeState?, afterState?, details?, skipRealtime? }`
  - Verify: TS strict 编译过
- [ ] F-004.2 同事务原子性:`db.transaction(async tx => { await fn(tx); await tx.insert(auditEntries).values(...); if (!skipRealtime) await tx.insert(realtimeEvents).values({...max+1...}); })`
  - Verify: 单元测试覆盖业务 + audit + realtime 三段全部提交成功
- [ ] F-004.3 audit 写失败 → 业务回滚(单元测试用 spy 让 audit insert throw,验证 fn 抛出的副作用被 rollback)
  - Verify: 单元测试覆盖 fn 已 insert 一行 + audit 失败 → 该行不在 db 中
- [ ] F-004.4 realtime sequence 单调递增(用单 SQL `INSERT INTO realtime_events (..., sequence) SELECT ?, ?, ?, ..., COALESCE(max(sequence), 0) + 1 FROM realtime_events WHERE goal_space_id = ?`)
  - Verify: 单元测试覆盖连续 10 次插入 sequence 严格递增 1..10
- [ ] F-004.5 不导出 `updateAuditEntry` / `deleteAuditEntry` / `truncateAudit` 函数(append-only 边界)
  - Verify: `import { ... } from "@/lib/audit"` 列出全部导出,无 update/delete
- [ ] F-004.6 `apps/web/src/lib/audit/index.ts` re-export
  - Verify: `import { runWithAudit } from "@/lib/audit"` 工作
- [ ] F-004.7 `apps/web/src/lib/db/client.ts`(辅助):导出 `getDb()` 返回 Drizzle 实例 + better-sqlite3 连接;`apps/web/db/dev.db` 路径;不引入新依赖
  - Verify: `import { getDb } from "@/lib/db/client"` 工作;不破坏 S1 的 `import { schema } from "@/db"`

## Test Tasks

### Schema Tests(F-001)

- [ ] T-001 `apps/web/__tests__/schema.test.ts`:enum literal union 值集合与 `database_design.md` § 1 + `state_transition.md` § 1 + `authorization_matrix.md` § 2 完全一致(每张表的 status / role / state enum 各列)
  - Verify: `pnpm --filter web test -- schema` 全绿;`expect(goalSpaceStatusValues).toEqual(['draft', 'active', 'completed', 'cancelled'])` 等
- [ ] T-002 `apps/web/__tests__/schema-migrate.test.ts`:临时 in-memory SQLite 跑 0001 迁移 → 11 张表存在 → partial unique index `node_board_members WHERE removed_at IS NULL` 实际生效(尝试插入重复 active 成员应失败)
  - Verify: 迁移 + 插入合法行 + 插入重复行失败
- [ ] T-003 `apps/web/__tests__/schema-types.test.ts`:`InferSelectModel<typeof users>` 等类型断言 + JSON 字段 `text` 读写(JSON.parse/stringify 正确)
  - Verify: TS 编译过 + 运行时 assert 通过

### State Machine Tests(F-002)

- [ ] T-004 `apps/web/__tests__/state-machine/card.test.ts`:全部 14 条合法转移 + 至少 10 条非法转移 + Done/Cancelled 终态(任何 from 都被拒)+ 角色分类(human/ai_role/system)+ trigger 枚举(11 个)
  - Verify: ≥ 80% 覆盖;`pnpm --filter web test -- state-machine/card` 全绿
- [ ] T-005 `apps/web/__tests__/state-machine/goal-space.test.ts`:`draft→active` / `active→completed` / `active→cancelled` / `draft→cancelled` / 终态不可再转 / `complete` 前置条件缺一/缺二/缺三
  - Verify: ≥ 80% 覆盖;`pnpm --filter web test -- state-machine/goal-space` 全绿
- [ ] T-006 `apps/web/__tests__/state-machine/integration.test.ts`:与 F-001 enum 类型联动(`CardState` 实际是 F-001 导出的 literal union,值集合自动对齐)
  - Verify: type-level 编译过

### Authorization Tests(F-003)

- [ ] T-007 `apps/web/__tests__/authorization/goal-space.test.ts`:initiator own/other × read/manage;chain_user/read-only;viewer/read-only
  - Verify: ≥ 80% 覆盖;6 个 case
- [ ] T-008 `apps/web/__tests__/authorization/node-board.test.ts`:initiator 全可见 / 非 initiator 成员可见 / 非成员不可见;manage 仅 initiator
  - Verify: ≥ 80% 覆盖;6 个 case
- [ ] T-009 `apps/web/__tests__/authorization/card.test.ts`:initiator 全可见可改;chain_user 限本节点 / 本人;viewer 只读;跨 goalSpace 一律 false
  - Verify: ≥ 80% 覆盖;≥ 10 个 case
- [ ] T-010 `apps/web/__tests__/authorization/confirmation.test.ts`:initiator only;chain_user/viewer 拒绝
  - Verify: ≥ 80% 覆盖;3 个 case
- [ ] T-011 `apps/web/__tests__/authorization/execute.test.ts`:可访问 + 无 pending = true;可访问 + 有 pending = false;不可访问 = false
  - Verify: ≥ 80% 覆盖;3 个 case
- [ ] T-012 `apps/web/__tests__/authorization/assert.test.ts`:`assertAccess(true, msg)` 不抛;`assertAccess(false, msg)` 抛 `ForbiddenError(msg)`
  - Verify: 2 个 case

### Audit Tests(F-004)

- [ ] T-013 `apps/web/__tests__/audit/run-with-audit.test.ts`:临时 in-memory SQLite
  - Case A: 业务 + audit + realtime 三段全部提交成功
  - Case B: 业务成功 + audit insert throw → 业务行不在 db
  - Case C: realtime sequence 连续 10 次严格递增 1..10
  - Case D: `skipRealtime: true` 不写 realtime_events
  - Verify: ≥ 80% 覆盖;`pnpm --filter web test -- audit` 全绿
- [ ] T-014 `apps/web/__tests__/audit/append-only.test.ts`:静态 import 检查,`@/lib/audit` 不导出 `updateAuditEntry` / `deleteAuditEntry` / `truncateAudit` / `dropAuditTable`
  - Verify: `expect(Object.keys(auditExports)).not.toContain('updateAuditEntry')` 等
- [ ] T-015 `apps/web/__tests__/audit/integration.test.ts`:与 F-001 schema 类型联动 — 业务行 `users` 表更新 + `audit_entries` 行写入,实际列存在且类型匹配
  - Verify: 实际 insert + select 成功

## Verification Steps

- 每完成一个 feature 跑 5 条 baseline 命令:
  - `pnpm --filter web typecheck`
  - `pnpm --filter web lint`
  - `pnpm --filter web format:check`
  - `pnpm --filter web test` (累计 26 + 新增 it)
  - `pnpm --filter web build`
- F-001 额外跑:`pnpm --filter web db:check` + `pnpm --filter web db:migrate` + `sqlite3 apps/web/db/dev.db ".tables"`
- 全部 baseline 命令 0 errors 0 warnings(S2 不允许 P2 backlog 回归)

## Sequencing

1. **Step**: Phase 2 Review 由 Application Owner 写 `review/findings.md`(per S1 模式)
   - **Verify**: `review/findings.md` 存在,recommendation: Proceed 或修订
2. **Step**: Phase 3.1 创建分支 `git checkout -b 20260606-s2-domain-core 20260606-dev-bootstrap`
   - **Verify**: `git branch --show-current` = `20260606-s2-domain-core`
3. **Step**: Phase 3.2 实施 F-001(Drizzle Schema + Initial Migration)
   - **Verify**: F-001 全部 [ ] 转 [x];`pnpm --filter web db:check` 0 errors;11 张表实际存在
4. **Step**: Phase 3.3 实施 F-002(Card & Goal Space State Machines)
   - **Verify**: F-002 全部 [ ] 转 [x];`pnpm --filter web test -- state-machine` 全绿
5. **Step**: Phase 3.4 实施 F-003(Authorization Matrix)
   - **Verify**: F-003 全部 [ ] 转 [x];`pnpm --filter web test -- authorization` 全绿
6. **Step**: Phase 3.5 实施 F-004(Audit Transaction Wrapper)
   - **Verify**: F-004 全部 [ ] 转 [x];`pnpm --filter web test -- audit` 全绿
7. **Step**: Phase 4 Testing 全部 5 条 baseline 命令通过;`testing/results.md` 写完
   - **Verify**: `feature_list.json` 4 个 feature `test_status: passed` / `done_status: completed`
8. **Step**: Phase 5 Delivery 写 `delivery/summary.md` + `handoff.md`;`sprint_progress.md` 推到 `complete`
   - **Verify**: S2 全部 phase Done;S1 → S2 handoff 写完

## Dependencies

- **依赖 F-001**:F-002(enum 类型)、F-003(actor / resource 类型)、F-004(db 客户端 / 表)均依赖 F-001 的 schema 与类型;F-001 必须先落地
- **依赖 S1 commit `eea017e`**:S2 在 S1 脚手架之上扩展,需 S1 落地后才能跑 baseline
- **依赖 `docs/specs/database_design.md`**:F-001 schema 字段与索引完全对齐
- **依赖 `docs/architecture/state_transition.md`**:F-002 状态机转移表与 trigger 完全对齐
- **依赖 `docs/specs/authorization_matrix.md`**:F-003 权限矩阵与角色定义完全对齐
- **不依赖**:S3 API handler / S4 UI / 真实 AI / 外部 MCP/ACP/A2A

## Stop Condition

**Stop after writing request analysis artifacts and wait for human approval.** Phase 3 Implementation 在收到"approved"/"执行"/"继续实现"指令后才开始。
