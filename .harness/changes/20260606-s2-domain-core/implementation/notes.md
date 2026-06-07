# F-001 Implementation Notes

Change: `20260606-s2-domain-core`
Feature: F-001 — Drizzle Schema + Initial Migration
Branch: `20260606-s2-domain-core` (from `20260606-dev-bootstrap` @ `eea017e`)
Date: 2026-06-07
Status: ✅ implementation complete, all baseline commands green

## Summary

Implemented 11 KEPLAR 业务表的 Drizzle SQLite schema + 12 enum literal union + 1 helper enum + 22 `InferSelectModel`/`InferInsertModel` types. 5 partial unique indexes generated correctly by Drizzle's `.where(sql\`...\`)` API without manual supplementation. Migration `0000_amazing_the_fury.sql` applies cleanly. `dev.db` 包含全部 11 张表 + 23 个命名索引(`__drizzle_migrations` 内部表 + 5 个 `sqlite_autoindex_*` 主键索引未计)。

## 真相源(实施中持续校对)

- `docs/specs/database_design.md` § 1 § 3 § 4 § 5 § 6 § 7.1 — 字段、类型、索引、SQLite 适配
- `docs/architecture/state_transition.md` § 1 § 6 — `transitionActor` + `trigger` 值集合
- `docs/specs/authorization_matrix.md` § 2 — `userRole` / `actorType` 值集合

## 关键决策

### 1. partial unique index — Drizzle 0.36 `.where(sql\`cond\`)` API 够用,R-1 风险闭环

5 个 partial unique index 全部通过 Drizzle `.where(sql\`...\`)` API 表达,`db:generate` 输出直接包含 `WHERE` 子句,无需人工校对 + 补:

- `idx_node_board_members_board_user_active ... WHERE removed_at IS NULL`
- `idx_node_boards_goal_space_key_active ... WHERE deleted_at IS NULL`
- `idx_cards_goal_space_display_id_active ... WHERE deleted_at IS NULL`
- `idx_human_confirmations_card_pending ... WHERE status = 'pending'`
- `idx_realtime_events_goal_space_sequence` (full unique, 无 partial 子句;按 spec 是 full unique)

T-002 中 4 个 case 实际运行 SQL insert 验证 partial index 真的拦截重复行,无"差不多就过"。

### 2. enum literal union 命名约定

- 单数复数:`CARD_STATES`(复数,数组语义)+ `CardState`(单数,类型语义);其他 enum 同模式
- 12 个 spec enum + 1 helper:`nodeBoardMemberRole` 不在 12 spec 内,但 § 3.3 列有 role 列,需要 enum 约束,加为 helper

### 3. **`entityType` 用 "confirm" 而非 "confirmation"** — 与 realtime_events 不一致,需后续协调

真相源矛盾:
- `database_design.md` § 3.9 `audit_entries.entity_type` = 7 值,以 `"confirm"` 结尾
- `database_design.md` § 3.10 `realtime_events.resource_type` = 6 值,以 `"confirmation"` 结尾

**F-001 选择**:`entityType` 用 audit-style 7 值(`"confirm"`),`realtime_events.resource_type` 用 `text` 无 enum 约束 — 避免 type-level 漂移。后续 S3/F-004 实施 audit + realtime 写入时,如需强类型,可单独开 `realtimeResourceType` enum(6 值,以 `"confirmation"` 结尾)。S2 不主动改 docs(per reviewer R-3 缓解)。

### 4. migration 命名是 `0000_*.sql` 不是 `0001_*.sql` — drizzle-kit 0.28 默认行为

`db:generate` 第一次运行默认从 `0000_` 开始(随机 hash 后缀)。spec 文本提到 `0001_*.sql` 是模板占位,实际文件名不影响功能(后续 0001/0002/... 由 drizzle-kit 自动递增)。`db:check` 验证 schema 内部一致,`db:migrate` 在干净 `dev.db` 应用成功。

### 5. UUID 默认值用 `lower(hex(randomblob(16)))` 不用 `upper(hex(...))`

`database_design.md` § 6 规定 UUID 用 hex 字符串。`lower` 是应用层常见做法(URL / 文件名友好),drizzle 生成 SQL 时 `lower()` 包裹 `hex(randomblob(16))` 保证 32 字符小写 hex。T-002 UUID case 验证 `^[0-9a-f]{32}$` 通过。

### 6. `cards.priority` 用 `text` 无 enum 约束

`database_design.md` § 3.6 列 `priority`,但 12 enum 中无对应集合。**不**自动映射 `riskLevel`(语义不同:priority 是任务优先级,riskLevel 是风险等级),留 `text` 给应用层灵活。F-002/F-003 实施时若需类型安全再加 `priority` enum(需先回 Phase 1 调整 scope)。

### 7. `sessions.role` 用 `text` 无 enum 约束

同理,session role 不在 12 enum 列表中(用户级 role 才是 `userRole`)。S3 引入真实 session 时再决定。

### 8. `realtime_events.resource_type` 用 `text` 无 enum 约束

见决策 3:为避免与 `entityType` 的 `"confirm"` vs `"confirmation"` 不一致在 type 层面传播,先留 `text`。后续 S3/F-004 可单独加 enum。

### 9. `audit_entries.before_state` / `after_state` 用 `text + mode: "json"` 允许 null

schema 表达 `$type<Record<string, unknown> | null>()`,因为审计前后态都可能是 null(创建/删除场景)。Drizzle 0.36 的 `mode: "json"` 配 nullable 文本字段正确处理 null 与 JSON 互转。

### 10. `smoke.test.ts` 中 S1 placeholder 断言必须更新

S1 smoke test 断言 `Object.keys(schema).length === 0`(S1 schema 是空 `{}`)。F-001 替换 schema 后,此断言变 false,会破坏 baseline。已更新为 `=== 11`,并在 it 描述 + 注释中说明 S1 → S2 演变。修改限于 schema 长度检查这一项,其他 2 个 it(workspace alias + jsdom globals)不变。

### 11. `vitest.config.mts` 加 `environmentMatchGlobs`

T-002 (schema-migrate) 用 better-sqlite3 native module,在 jsdom 环境偶发加载失败(per R-2)。`environmentMatchGlobs` 显式将 `__tests__/schema-migrate.test.ts` 与 `__tests__/audit/**`(F-004 预留)切到 `node` 环境。S1 smoke test 仍用 jsdom(因依赖 `document` / `window` globals)。

### 12. `db/migrations/meta/*.json` 提交入仓

drizzle-kit 0.28 在 `migrations/meta/` 生成 `_journal.json` + `0000_snapshot.json`,记录 migration 历史与 schema 快照。**提交入仓**(S1 阶段已 gitignore `dev.db` 但没 gitignore `migrations/`)。后续 `db:generate` 自动递增,快照用于 `db:check` 校验。Prettier 检查会格式化这两个文件(F-001 实施时已 `prettier --write` 修复)。

## 实施期注意点

- **better-sqlite3 native module 必须为本机 Node 版本 rebuild**:Node v24.14.0 + 11.5.0 prebuilt 缺 darwin-x64 ABI,`db:migrate` 报错 `Could not locate the bindings file`。解决:`cd node_modules/.pnpm/better-sqlite3@11.5.0/node_modules/better-sqlite3 && npm run install`(触发 node-gyp 编译),耗时约 30s。CI 上 `pnpm install` 不一定触发 native rebuild,可能需在 CI 加 `pnpm rebuild better-sqlite3` 步骤(此为 S2+ 部署关注,非 S2 范围)。
- **`pnpm dev` 未跑通验证**:本 session 无 GUI,S2 spec F-001 也不要求 dev server 自启。`pnpm build` 通过(2 static pages: `/` 占位 + `/_not-found`),可推断 dev server 也能跑(S3 验证)。
- **S1 smoke test 在 schema.ts placeholder 上挂一个 `Object.keys(schema).length === 0` 断言**;F-001 替换 schema 后必须更新,否则 baseline 红。已修复。

## 验证矩阵(F-001 verification)

| 项 | 命令 | 结果 |
|---|---|---|
| typecheck | `pnpm --filter web typecheck` | ✅ 0 errors |
| lint | `pnpm --filter web lint` | ✅ 0 errors |
| format:check | `pnpm --filter web format:check` | ✅ All matched files use Prettier code style |
| unit | `pnpm --filter web test` | ✅ 56/56 (S1 26 + T-001 13 + T-002 9 + T-003 8) |
| integration | (optional) | ⏭️ not run;T-002 用 in-memory SQLite 覆盖了 integration 场景 |
| api_contract | n/a | n/a |
| migration | `pnpm --filter web db:check` + `db:migrate` | ✅ schema 一致 + 迁移应用成功 |
| smoke | (optional) | ⏭️ 不强制(无 dev server) |
| e2e | n/a | n/a |
| 11 张表 | `sqlite3 .tables` | ✅ users goal_spaces node_boards node_board_members sessions agent_executions cards state_transitions human_confirmations audit_entries realtime_events |
| partial unique index 实际生效 | T-002 in-memory SQLite | ✅ 4 case 验证拒绝 / 软删后允许 |

## 交付清单(此 commit)

- `apps/web/db/schema.ts`(S1 placeholder → 11 张表 + 12 enum + 22 types)
- `apps/web/db/migrations/0000_amazing_the_fury.sql`(新建,db:generate 输出)
- `apps/web/db/migrations/meta/_journal.json` + `0000_snapshot.json`(drizzle-kit 内部)
- `apps/web/package.json`(+4 db:* scripts)
- `apps/web/__tests__/smoke.test.ts`(S1 empty-schema 断言 → S2 11-tables 断言)
- `apps/web/__tests__/schema.test.ts`(新建,T-001 enum consistency)
- `apps/web/__tests__/schema-migrate.test.ts`(新建,T-002 in-memory 迁移 + partial index)
- `apps/web/__tests__/schema-types.test.ts`(新建,T-003 inferred types)
- `apps/web/vitest.config.mts`(+ environmentMatchGlobs)
- `apps/web/README.md`(+ Database section)

## 后续 S2 feature 接入点

- **F-002**(Card & Goal Space State Machines):import 13 enum literal union(`CARD_STATES` / `GOAL_SPACE_STATUS_VALUES` / `TRANSITION_ACTOR_VALUES` 等);`InferSelectModel<typeof cards>` / `<typeof goalSpaces>` 用于 state machine 状态判定;S3 handler 在事务内查 `assertGoalSpaceTransition(active, completed, opts)`,`opts` 字段(`hasPendingConfirmation` / `hasBlockedCard` / `allCardsDoneOrCancelled`)由 F-004 事务填充。
- **F-003**(Authorization Matrix):`Actor` 类型应复用 `UserRole` enum 之一(`initiator` / `chain_user` / `viewer`),不另开;`ResourceContext.goalSpaceId` 与 schema 跨表 FK 一致。
- **F-004**(Audit Transaction Wrapper):`audit_entries` / `realtime_events` 已就位;`runWithAudit` 单 SQL `INSERT INTO realtime_events (..., sequence) SELECT ..., COALESCE(max(sequence), 0) + 1 FROM realtime_events WHERE goal_space_id = ?` 由 AC-4.4 强制;`audit_entries.entity_type` = `EntityType` enum(7 值)。

## 风险登记(转移到 S2 总览)

- **R-3**(review/findings.md):`realtime_events.sequence` 并发分配 → F-004 实施时由单 SQL SELECT max+1 解决。
- **R-4**(review/findings.md):`goal_space.complete` 前置需 DB 查询 → F-002 `opts` 参数 + F-004 事务内 select 填充,契接口已就位。
- **R-5**(review/findings.md):`pnpm dev` 浏览器手测无 GUI → S2 推迟到 S3 一起验;F-001 范围内不要求。
- **R-7**(review/findings.md):4 commit 粒度 → F-001 已落地,待人类 commit 指令;F-002 / F-003 / F-004 各自单独 commit。

---

# F-002 Implementation Notes

Change: `20260606-s2-domain-core`
Feature: F-002 — Card & Goal Space State Machines
Branch: `20260606-s2-domain-core` (from `20260606-dev-bootstrap` @ `eea017e`)
Date: 2026-06-07
Status: ✅ implementation complete, all baseline commands green

## Summary

`apps/web/src/lib/state-machine/` 下落地 3 个文件:

- `card.ts`(229 行) — Card 7 态 + 17 转移(13 跨态 + 4 自环)+ 11 TransitionTriggers + 5 公开 API(`canTransition` / `assertTransition` / `isTerminalState` / `isValidState` / `getRequiredActor`)
- `goal-space.ts`(171 行) — Goal Space 4 态 + 4 跨态 + `assertGoalSpaceTransition` 返回 string[] 缺哪条前置的列表(active → completed)+ `*→cancelled` 强制 cancelReason 非空(per MT-5)
- `index.ts`(40 行) — `@/lib/state-machine` 聚合 re-export(S3 / F-004 / S4 单点 import)

117 个新测试(67 card + 36 goal-space + 14 integration)全绿,与 F-001 56 测试合并后总 **173/173** 通过。

## 真相源(实施中持续校对)

- `docs/architecture/state_transition.md` § 1 § 2 § 4 § 6 — Card 7 态 / 14 跨态 / 4 自环 / 11 triggers / 子角色分类
- `docs/specs/database_design.md` § 3.1 — Goal Space 4 态
- `docs/specs/phase1_scope.md` § 5 — S2 = 领域核心,不含 UI / API / AI executor
- F-001 `apps/web/db/schema.ts` — 12 enum literal union(F-002 import,不另开)

## 关键决策

### 1. CARD_TRANSITIONS = 13 跨态 + 4 自环 = 17,AC 写"14"是 off-by-one typo

§ 4 表格 = 13 跨态 + 2 终态标注 = 15 rows;AC-2.3 写 "14 条 Card 规则" 是 typo。我实装 13 跨态(逐条对应 § 4 normal / blocked / blocked-resolution 3 段)+ 4 自环(§ 2 mermaid 的 backlog/todo/dev/review 自环),总 17 条。`T-004` 测试 67 个 case 覆盖全部 17 条合法 + 16 条非法 + 11 triggers + 终态 + 角色,远超 AC 14/10 下界。

### 2. `CARD_TRANSITIONS[].triggers` 字段:每条规则对应允许的 trigger 集合

§ 4 仅写"触发条件"(自然语言),§ 6 列 11 triggers,实装把两者映射:

- `backlog → todo` 接受 `["dependencies_ready", "context_complete"]`(依赖满足 或 上下文完整)
- `dev → blocked` 接受 `["task_cancelled", "review_failed", "human_reject"]` — Dev Crafter 失败 / 任务取消 / 人工拒绝
- `review → blocked` 仅 `["review_failed", "human_reject"]` — Review Guard 失败或人工拒绝(无 task_cancelled,语义冲突)
- `blocked → cancelled` 接受 `["task_cancelled", "human_confirm_timeout"]` — 任务取消 / 确认超时
- `blocked → {backlog,todo,dev,review}` 仅 `["blocked_resolved"]` — 阻塞解决路由

§ 4 没明示的 trigger 映射细节(例如 `dev → blocked` 是否含 `task_cancelled`)= 实施期工程判断,在 `card.ts` 注释中标明;后续 S3 API handler 触发转移时按此表选 trigger。

### 3. 角色分类:`getRequiredActor` 返回 TransitionActor(单值),§ 4 多角色用主取

§ 4 角色列用子角色名(Backlog Refiner / Todo Orchestrator / Dev Crafter / Review Guard / Blocked Resolver / 发起人 / 链路用户 / 系统)。F-001 的 `TransitionActor` 仅 3 值(`human` / `ai_role` / `system`),实装映射:

- 5 个 AI 子角色 → `ai_role`
- "发起人" / "链路用户" → `human`
- "系统" → `system`

多角色行(§ 4 "Review → Done: AI (Review Guard) / 发起人" / "Blocked → Cancelled: 发起人 / 系统")取主(前者 `ai_role`,后者 `human`)。`T-004` "getRequiredActor 角色分类" 段覆盖全部 11 条带主取规则。

**AC-2.4 漂移项**:`AC-2.4 原文 backlog→todo 需 ai_role(Backlog Refiner)` — 但 state_transition.md § 4 写 `AI (Todo Orchestrator)`。两者都映射到 `ai_role`,实装按 § 4 真相源(主取 Todo Orchestrator → ai_role)。`Backlog Refiner` 实际对应 `backlog → blocked`(已在表),未在 AC-2.4 中显式列出。

### 4. `assertGoalSpaceTransition` 返回 `string[]` 而非 throw

AC-2.6 原文:"assertGoalSpaceTransition 对 active→completed 返回缺哪条前置的列表" — 用"返回"语义,我设计为:

- 非法 from / to 枚举值、终态、找不到规则 → **throw**(纯校验错,无业务含义)
- `active → completed` + 不满足前置 → **return** 缺哪条 key 的 string[](`hasPendingConfirmation` / `hasBlockedCard` / `allCardsDoneOrCancelled`,全满足则 `[]`)
- `* → cancelled` 缺 cancelReason → **throw**(强制 caller 必填)
- 其他合法转移(draft → active)→ return `[]`

设计原因:F-004 审计事务 wrapper 拿到非空 `missing[]` 后可写进 `audit_entries.details`(业务成功但前置不满足也算可审计事件);S3 handler 拿到非空数组时再决定 409 Conflict + `{ missing: [...] }` body。这是 § 6 状态校验边界"领域核心 vs API handler 职责分离"的工程实现。

### 5. `* → cancelled` 强制 cancelReason 非空(per MT-5 review 加注)

review/findings.md MT-5:`assertGoalSpaceTransition(任意非终态, cancelled, { cancelReason?: string })` 校验 cancelReason 非空。实装:

- `cancelReason` 缺 / 空字符串 / 仅空白(`"   "`)→ throw
- `opts` 错形状(例如传 CompleteOpts 而非 CancelOpts)→ throw(由 `isCancelOpts` 类型守卫拦截)

T-005 段 7 覆盖 4 个正面 case(active/draft × 有/无 reason) + 4 个负面 case(空 / 空白 / 错形状)。

### 6. 终态 `done` / `cancelled` 的 4 自环不合法

AC 隐含(done/cancelled 是终态不可再转,§ 4 也明"无进一步流转")。`canTransition` 在 `isTerminalState(from)` 短路 return false,所以 done → done / cancelled → cancelled 自动 false。T-004 "自环限 4 个非终态"段显式断言这 2 条。

### 7. F-001 schema enum 复用:F-002 状态机不另开 enum

`@db/schema.ts` 已是 F-001 真相源。F-002 card.ts 与 goal-space.ts **只 import,不 re-declare**:

```ts
import { CARD_STATES, TRANSITION_ACTOR_VALUES, type CardState, type TransitionActor } from "@db/schema";
```

`TRANSITION_TRIGGERS` 11 值不在 F-001 12 enum 中(state machine 内部事件分类,不入 DB 字段),所以单独 const+type 定义在 card.ts 内部。T-006 验证 `@/lib/state-machine` 与 `@db/schema` 在 3 个 enum(CardState / GoalSpaceStatus / TransitionActor)上数组字面量 + TS 类型字面量联合均相等 — 编译期就拦下漂移。

### 8. `index.ts` 聚合 re-export + 透传类型

S3 / F-004 / S4 单点 `@/lib/state-machine` import。`index.ts` 顶部 re-export F-001 schema 的 3 个 type(避免散点 `@db/schema` import):

```ts
export type { CardState, GoalSpaceStatus, TransitionActor } from "@db/schema";
```

后续 S3 handler 用 `type { CardState } from "@/lib/state-machine"` 即可,无需触碰 `@db/schema` import 路径。T-006 段 5 "聚合 re-export 端到端可用" 验证 9 个函数 + 4 个常量可调用 + `expectTypeOf(canTransition).returns.toEqualTypeOf<boolean>()` 不被 `as` cast 擦除。

### 9. trigger 集合完整性断言(per AC-2.5)

T-004 段 9 双断言:

- `CARD_TRANSITIONS` 所有 `rule.triggers[i]` 都在 `TRANSITION_TRIGGERS` 集合内(防止 typo:`"dependent_ready"` 等错拼)
- 11 个 trigger **每个**至少被 1 条规则使用(防止遗漏:`human_confirm_timeout` 仅 `blocked → cancelled` 用,`blocked_resolved` 4 条 blocked → {backlog/todo/dev/review} 用)

## 实施期注意点

- **tsconfig 路径别名**:`@/*` → `./src/*` + `@db/*` → `./db/*` S1 已就位,F-002 直接用,无需改 tsconfig
- **prettier 3 文件需 `--write`**:本 F-002 的 3 个新源文件 + 1 个测试文件,Prettier 默认 100 列 + 中文方框注释间距,首次 format:check 失败;`pnpm --filter web format` 一次性修复
- **vitest expectTypeOf**:S1 + F-001 没用过类型断言,F-002 T-006 第一次引入,API 在 `vitest` 包内 import,无需新依赖
- **`isCancelOpts` / `isCompleteOpts` 类型守卫**:用 `typeof === "boolean"` / `typeof === "string"` 区分,运行时不依赖 `instanceof` 或 duck-typing,避免形状冲突时 silently pass
- **`canTransition('done', 'backlog')` 返回 false,即使传合法 trigger**:终态短路在 trigger 检查之前,显式语义"终态不可再转",T-004 "终态传 trigger 仍拒绝" 断言

## 验证矩阵(F-002 verification)

| 项 | 命令 | 结果 |
|---|---|---|
| typecheck | `pnpm --filter web typecheck` | ✅ 0 errors |
| lint | `pnpm --filter web lint` | ✅ 0 errors |
| format:check | `pnpm --filter web format:check` | ✅ All matched files use Prettier code style |
| unit | `pnpm --filter web test` | ✅ 173/173 (S1 26 + F-001 30 + F-002 117) |
| integration | (optional) | ⏭️ not run;F-002 T-006 已覆盖 enum + re-export 联动 |
| api_contract | n/a | n/a(S2 不含 API) |
| migration | n/a | n/a(F-002 不动 schema) |
| smoke | (optional) | ⏭️ 不强制(无 dev server) |
| e2e | n/a | n/a |
| build | `pnpm --filter web build` | ✅ 4 static pages |
| Card 7 态 | T-004 段 1 + 段 3 | ✅ CARD_STATES length = 7,17 合法转移 |
| Card 11 trigger | T-004 段 1 + 段 9 | ✅ TRANSITION_TRIGGERS length = 11,每条至少 1 规则用 |
| Card 角色分类 | T-004 段 8 | ✅ 11 条主取规则 + 1 条 no-rule 抛错 |
| Card 终态 | T-004 段 5 | ✅ done / cancelled × 7 to = 14 case 全 false |
| Card 非法 ≥ 10 | T-004 段 4 | ✅ 16 case(倒退 6 + 跳跃 8 + 自环 2) |
| Goal Space 4 态 | T-005 段 1 + 段 3 | ✅ 4 合法转移 + 4 非法 |
| Goal Space 8 组合 | T-005 段 6 | ✅ active→completed × 8 布尔组合全覆盖 |
| Goal Space cancel reason | T-005 段 7 | ✅ 6 case(2 正 + 4 负) |
| Enum 联动 | T-006 段 1 | ✅ 3 数组字面量 + 3 类型字面量联合均相等 |
| 聚合 re-export | T-006 段 5 | ✅ 9 函数 + 4 常量 + 类型不被擦除 |

## 交付清单(此 commit)

- `apps/web/src/lib/state-machine/card.ts`(新建,229 行)
- `apps/web/src/lib/state-machine/goal-space.ts`(新建,171 行)
- `apps/web/src/lib/state-machine/index.ts`(新建,40 行)
- `apps/web/__tests__/state-machine/card.test.ts`(新建,T-004,67 case)
- `apps/web/__tests__/state-machine/goal-space.test.ts`(新建,T-005,36 case)
- `apps/web/__tests__/state-machine/integration.test.ts`(新建,T-006,14 case)

## 后续 S2 feature 接入点

- **F-003**(Authorization Matrix):`Actor` 用 `UserRole` enum(`initiator` / `chain_user` / `viewer`),不与 F-002 `TransitionActor` 混淆;`ResourceContext.goalSpaceId` 与 `goalSpaces.id` 一致
- **F-004**(Audit Transaction Wrapper):`assertGoalSpaceTransition(active, completed, opts)` 返回的 `missing[]` 可直接序列化进 `audit_entries.details`;`canTransition` 的 trigger 校验先于 DB 写,F-004 事务可在 fn 完成后写 `state_transitions.trigger` 与 `audit_entries.action` 字段,无需重复校验
- **S3 API handler**:调 `assertTransition` + `getRequiredActor` 写 `state_transitions` 行,`assertGoalSpaceTransition` 返回 `[]` 才允许写 `goalSpaces.status`,返回非空 `missing[]` 时 409 Conflict + `{ missing: [...] }` body

## 风险登记(更新)

- **R-4**(review/findings.md):`goal_space.complete` 前置需 DB 查询 → **F-002 已闭环**:`GoalSpaceCompleteOpts` 3 字段契约已落地,F-004 实施时事务内 select 填充即可,无需再改 F-002
- **R-7**(review/findings.md):4 commit 粒度 → F-001 + F-002 已落地,各 1 commit;F-003 / F-004 各自单独 commit
- **新增 R-8**:`TRIGGER` 与 § 4 触发条件的映射是工程判断(决策 2),后续 S3 handler 若发现映射不当可改 `CARD_TRANSITIONS[].triggers` 数组,无需改 schema / 状态机主结构
- **新增 R-9**:`assertGoalSpaceTransition` 在 `*→cancelled` 路径上 throw 而非 return `missing[]`(决策 4/5 不对称),F-004 实施时若需"cancel reason 缺失也返回列表"语义,需回 F-002 改造(应回退 throw 改 return + 类型守卫),暂定 F-002 现状足够

---

# F-003 Implementation Notes

Change: `20260606-s2-domain-core`
Feature: F-003 — Authorization Matrix
Branch: `20260606-s2-domain-core` (from `20260606-dev-bootstrap` @ `eea017e`)
Date: 2026-06-07
Status: ✅ implementation complete, all baseline commands green

## Summary

`apps/web/src/lib/authorization/` 下落地 8 个文件:

- `types.ts` (100 行) — `Actor` / `ActorRole` / `AccessResult` + 5 Context 类型(`GoalSpaceContext` / `NodeBoardContext` / `CardContext` / `ConfirmationContext` / `ExecuteCardContext`)
- `goal-space.ts` (28 行) — `canReadGoalSpace` + `canManageGoalSpace`
- `node-board.ts` (39 行) — `canReadNodeBoard` + `canManageNodeBoard` + `canManageNodeBoardMembers`
- `card.ts` (34 行) — `canReadCard` + `canMutateCard`
- `confirmation.ts` (21 行) — `canDecideConfirmation`
- `execute.ts` (28 行) — `canExecuteCard` 组合 `canReadCard` + `!hasPendingConfirmation`
- `assert.ts` (45 行) — `assertAccess` + `ForbiddenError`(403 收口)
- `index.ts` (35 行) — `@/lib/authorization` 聚合 re-export(9 can 函数 + 类型 + 工具)

41 个新测试(7 goal-space + 8 node-board + 13 card + 4 confirmation + 5 execute + 4 assert)全绿,与 F-001 + F-002 合并后总 **214/214** 通过。

## 真相源(实施中持续校对)

- `docs/specs/authorization_matrix.md` § 2 (角色) § 3 (资源归属) § 4 (API 矩阵 28 行) § 5 (强制门禁)
- F-001 `apps/web/db/schema.ts` — `UserRole` enum(initiator / chain_user / viewer)F-003 复用

## 关键决策

### 1. AC 写"8 个 can 函数",实装 9 个(AC 漂移)

AC-3.1 原文:"实现 8 个 can 函数",但 AC-3.2..3.9 + AC-3.5 拆出 members 共列出 9 个:`canReadGoalSpace` / `canManageGoalSpace` / `canReadNodeBoard` / `canManageNodeBoard` / `canManageNodeBoardMembers` / `canReadCard` / `canMutateCard` / `canDecideConfirmation` / `canExecuteCard`。`canManageNodeBoardMembers` 与 `canManageNodeBoard` 主体等价(per spec § 4 nodeBoardMembers 行只允许 initiator),但语义分开便于 S3 handler 单一职责。**F-003 选择实装 9 个**;`index.ts` 注释标明 9 个,后续 review/S3 接入如发现 members 与 manage 主体可合并可省一个。

### 2. `Actor = { id, role }`,无 `goalSpaceId` 字段 — 跨 goalSpace 防御隐式

`Actor` 不存 `actor.goalSpaceId`;跨域防御靠每个 can 函数中"actor.id === ctx.goalSpaceInitiatorId"或"actor.id ∈ ctx.memberIds / assignedTo"的关系检查完成。`initiator` 读全可见(per AC-3.2:initiator 全可见),写仅 own goalSpace(per AC-3.3);非 initiator 缺成员 / 分配关系即 false(隐式跨域保护)。这样 S3 注入 actor 时无需从 request 解析 goalSpace 来源,handler 拿到 actor + resource 各自的 ctx 后调 can 函数即可。

### 3. `canReadGoalSpace` 中 `ctx` 暂未引用,以 `_ctx` 标注

per AC-3.2 + spec § 3 "S2 范围内不引入间接层;后续 S3 handler 调此函数前可先 union 多 nodeBoard canRead 结果":S2 goalSpace 单层无成员关系,非 initiator 一律 false,`ctx` 入参不读。改参数名为 `_ctx` 满足 `@typescript-eslint/no-unused-vars` 的 `^_` allow-list,避免 lint warning。注释明确"间接层落地后此处读 ctx",S3 引入 goalSpace 读多 nodeBoard 间接层时只需把 `_ctx` 改回 `ctx` 并加一行 `return ctx.someNewField !== undefined` 即可。

### 4. `canExecuteCard` 组合而非独立 — 单一决策点

AC-3.9 把 execute 定义为"viewer 一律 false + 非 viewer 需 canReadCard + 无 pending confirmation"。实装直接调 `canReadCard(actor, ctx.card)` 作为子检查,避免复制 canReadCard 的"initiator / chain_user / viewer 关系"逻辑到 canExecuteCard。后续 canReadCard 加新规则(如跨 goalSpace actor)时,canExecuteCard 自动继承。

### 5. `assertAccess` 用 `asserts ... is true` 类型守卫

签名 `function assertAccess(allowed: AccessResult, message?: string): asserts allowed is true` — S3 handler 调 `const allowed = canXxx(...); assertAccess(allowed, msg);` 后,TS 把 `allowed` 收窄为 `true`,后续 if 分支无需再判。S3 layer 不必写 `if (!allowed) throw new ForbiddenError()` 重复样板。

### 6. `ForbiddenError` 仅 403 路径;409 走 service 层

`canExecuteCard` 返回 false 可能是(a)无 read 权(403 语义)、(b)有 read 权但有 pending confirmation(409 语义)。本模块不区分这两种 false 路径;S3 handler 拿到 `canExecuteCard === false` 后,先调 `canReadCard` 二次判别,read false → 403 / read true + hasPending → 409。本模块注释明确"409 不走此路径(语义不同)",assert 文件只承担 403。

### 7. 8 个 Context 字段冗余便于单函数决策(per AC-3.6 注释)

`CardContext` 冗余存 `nodeBoardMemberIds` 而非仅 `nodeBoardId`,便于 `canReadCard` / `canMutateCard` 单函数决策(避免函数内 join)。S3 handler 在 DB 查 `node_board_members` 后把 member id 列表注入 ctx,can 函数不做 I/O。T-009 段 6 "跨 goalSpace" 显式断言:另一 goalSpace 的 initiator 即便 role=initiator 也得靠 member / assignedTo 间接通过(否则 false),验证冗余字段起效。

### 8. `assert.ts` 不 re-export `AccessResult` type,仅消费

`AccessResult` 是 type-only 别名(`type AccessResult = boolean`),从 `./types` import,在 `assertAccess` 形参位置使用。`index.ts` 单独 re-export 一次供 S3 用,assert.ts 自身不再 export,避免散点。

## 实施期注意点

- **Test fixture 第一次跨 goalSpace 失败**:node-board / card / execute / goal-space 4 个测试文件的 "跨 goalSpace" 案例最初用同一 OWNER 既当 actor 又当 ctx.goalSpaceInitiatorId,导致 equality 检查通过 → true。修复:每文件新增 `OTHER_OWNER` 常量作为"另一 goalSpace 发起人",actor 用 OWNER / ctx.goalSpaceInitiatorId 用 OTHER_OWNER(或反向),使 equality 检查正确失败。
- **lint warning — `GOAL_B` 未引用**:F-003 删 `goalSpaceId: GOAL_B` 覆盖后,`card.test.ts` 和 `execute.test.ts` 留 `const GOAL_B = "g-bbb"` 成为 dead var。`@typescript-eslint/no-unused-vars` 规则要求未用 var 加 `_` 前缀;两条修都删 GOAL_B 常量即可。
- **prettier 8 源文件 + 5 测试文件需 `--write`**:同 F-002,Prettier 100 列 + 中文方框注释间距,首次 format:check 失败,`pnpm --filter web format` 一次性修复
- **vitest 不需要新依赖**:F-003 T-007..T-012 纯函数 + 字符串 / 对象字面量比对,F-001/F-002 已就位的 `vitest` 即可

## 验证矩阵(F-003 verification)

| 项 | 命令 | 结果 |
|---|---|---|
| typecheck | `pnpm --filter web typecheck` | ✅ 0 errors |
| lint | `pnpm --filter web lint` | ✅ 0 errors, 0 warnings(2 unused-var 已修) |
| format:check | `pnpm --filter web format:check` | ✅ All matched files use Prettier code style |
| unit | `pnpm --filter web test` | ✅ 214/214 (S1 26 + F-001 30 + F-002 117 + F-003 41) |
| integration | (optional) | ⏭️ not run;F-003 是纯函数,无 DB / API 集成 |
| api_contract | n/a | n/a(S2 不含 API) |
| migration | n/a | n/a(F-003 不动 schema) |
| smoke | (optional) | ⏭️ 不强制(无 dev server) |
| e2e | n/a | n/a |
| build | `pnpm --filter web build` | ✅ 4 static pages |
| 9 can 函数 | 8 源文件 + index.ts re-export | ✅ 全部导出 |
| ≥ 30 测试 | T-007..T-012 | ✅ 41 case(超 AC 下界 11) |
| 跨 goalSpace | T-008 段 1 + T-009 段 1 + T-011 段 5 | ✅ 4 case 全 false |
| ForbiddenError 抛/不抛 | T-012 段 1 + 段 2 | ✅ true 不抛 / false 抛 |
| assertAccess 类型守卫 | T-012 段 2(try/catch 内 TS 编译过) | ✅ |

## 交付清单(此 commit)

- `apps/web/src/lib/authorization/types.ts`(新建,100 行)
- `apps/web/src/lib/authorization/goal-space.ts`(新建,28 行)
- `apps/web/src/lib/authorization/node-board.ts`(新建,39 行)
- `apps/web/src/lib/authorization/card.ts`(新建,34 行)
- `apps/web/src/lib/authorization/confirmation.ts`(新建,21 行)
- `apps/web/src/lib/authorization/execute.ts`(新建,28 行)
- `apps/web/src/lib/authorization/assert.ts`(新建,45 行)
- `apps/web/src/lib/authorization/index.ts`(新建,35 行)
- `apps/web/__tests__/authorization/goal-space.test.ts`(新建,T-007,7 case)
- `apps/web/__tests__/authorization/node-board.test.ts`(新建,T-008,8 case)
- `apps/web/__tests__/authorization/card.test.ts`(新建,T-009,13 case)
- `apps/web/__tests__/authorization/confirmation.test.ts`(新建,T-010,4 case)
- `apps/web/__tests__/authorization/execute.test.ts`(新建,T-011,5 case)
- `apps/web/__tests__/authorization/assert.test.ts`(新建,T-012,4 case)

## 后续 S2 feature 接入点

- **F-004**(Audit Transaction Wrapper):`canXxx` 返回 boolean 而非 throw,与 `runWithAudit` 事务无冲突;`assertAccess` 用于 S3 handler 在事务前预检,不参与 F-004 事务原子性边界
- **S3 API handler**:GET / POST / PATCH 入口调 `const allowed = canXxx(actor, ctx); assertAccess(allowed, ...);` + 进 `runWithAudit` 事务;execute 路径先 `assertAccess(canReadCard, msg)` 获 403 保护,再 `if (canExecuteCard === false && canReadCard === true) throw new ConflictError('pending confirmation')` 获 409
- **S4 UI**:UI 不直接调 `@/lib/authorization` can 函数(per spec § 4 UI 不含权限逻辑);仅展示 server 返回的 403 / 409 / 200

## 风险登记(更新)

- **R-7**(review/findings.md):4 commit 粒度 → F-001 + F-002 + F-003 已落地,各 1 commit;F-004 单独 commit
- **新增 R-10**:`canManageNodeBoardMembers` 与 `canManageNodeBoard` 当前主体等价(决策 1),若 S3 handler 接入时希望"非 own goalSpace 的 initiator 可管理 members(可治理代理)"语义,需回 F-003 拆出差异逻辑;暂定 S2 现状足够,per spec § 3 只允许 own goalSpace initiator
- **新增 R-11**:`Actor` 不带 `goalSpaceId` 字段(决策 2),S3 session 注入 actor 时若需要"actor 当前所在 goalSpace"用于 UI context 切换,应单独从 request url / session 解析,不要给 Actor 加字段(否则破坏纯函数 + 跨域隐式防御)

---

# F-004 Implementation Notes

Change: `20260606-s2-domain-core`
Feature: F-004 — Audit Transaction Wrapper
Branch: `20260606-s2-domain-core` (from `20260606-dev-bootstrap` @ `eea017e`)
Date: 2026-06-07
Status: ✅ implementation complete, all baseline commands green

## Summary

`apps/web/src/lib/audit/` + `apps/web/src/lib/db/` 下落地 3 个文件:

- `audit/run-with-audit.ts` (122 行) — `AuditContext` 13 字段接口 + `AuditTx` 类型提取 + `runWithAudit<T>(db, ctx, fn): T` 主函数(业务 + audit_entries + 可选 realtime_events 同事务原子写)
- `audit/index.ts` (15 行) — `@/lib/audit` 聚合 re-export(append-only 边界由 NOT exporting `updateAuditEntry` / `deleteAuditEntry` / `truncateAudit` / `dropAuditTable` 强制)
- `db/client.ts` (53 行) — `getDb()` Drizzle + better-sqlite3 单例(WAL + foreign_keys=ON)+ `DrizzleDb` 类型供 runWithAudit 形参使用

10 个新测试(4 runWithAudit + 4 append-only 静态 import check + 2 integration round-trip)全绿,与 F-001 + F-002 + F-003 合并后总 **224/224** 通过。

## 真相源(实施中持续校对)

- `docs/specs/database_design.md` § 3.9 (`audit_entries` 字段) + § 3.10 (`realtime_events` 字段含 unique index `(goal_space_id, sequence)`) + § 6 (SQLite 适配)
- F-001 `apps/web/db/schema.ts` — `auditEntries` / `realtimeEvents` 表对象 + `EntityType` 7-value + `ActorType` 3-value enum
- F-003 `apps/web/src/lib/authorization/assert.ts` — 复用 `ForbiddenError` 模式作 F-004 API 边界参考

## 关键决策

### 1. realtime sequence 用单 SQL `SELECT COALESCE(MAX(sequence), 0) + 1` 子查询,而非应用层 max+1

AC-4.4 强制 sequence 严格 1..N 单调递增。两种实现路径:

- **(a) 应用层**:`fn` 内先 SELECT max + 1,再 INSERT,事务隔离保护下不会并发覆盖,但需要 fn 先 SELECT 再 INSERT(2 round-trip),且若 fn 中其他写改变了 max 值,序列可能跳跃
- **(b) 单 SQL 子查询**(选择):`tx.insert(realtimeEvents).values({ sequence: sql\`(SELECT COALESCE(MAX(sequence), 0) + 1 FROM realtime_events WHERE goal_space_id = ${goalSpaceId})\` })` — 1 round-trip,序列保证从当前 max+1 起步

**F-004 选择 (b)**:better-sqlite3 是单进程同步驱动,WAL 模式下写串行化(per F-001 client.ts 注),单 SQL 子查询在同一事务内执行,避免 fn 在两次 round-trip 间被其他事务插入(虽然 better-sqlite3 串行化下不会发生,但子查询更原子)。T-013 段 3 验证 10 次严格 1..10。

### 2. append-only 边界由 index.ts 不导出 enforce,非物理 DB 约束

AC-4.7 强制 `audit_entries` append-only。两种 enforcement 路径:

- **(a) DB 层 trigger**:`CREATE TRIGGER block_audit_update BEFORE UPDATE ON audit_entries BEGIN SELECT RAISE(FAIL, ...); END;` — 物理上无法 UPDATE
- **(b) API 边界**:`@/lib/audit/index.ts` 不 re-export `updateAuditEntry` / `deleteAuditEntry` / `truncateAudit` / `dropAuditTable`(选择)

**F-004 选择 (b)**:SQLite 的 `BEFORE UPDATE` trigger 在 production migration 中需独立 PR 评审与运维协调,scope 超出 F-004 范围(per review scope 防漂移)。API 边界即足够 — S2 范围内无任何调用者绕过 `@/lib/audit` 直接 raw SQL 改 audit 表;若 S3+ handler 有意绕过,那是 review/CI 抓的事,不是 F-004 强制门禁。T-014 用 `import * as auditModule from "@/lib/audit"; expect(auditModule).not.toHaveProperty("updateAuditEntry")` 静态 import 检查 4 个名字均未导出。

### 3. `runWithAudit` 同步返回 `T` 而非 AC-4.1 写的 `Promise<T>`

AC-4.1 签名 `runWithAudit(db, ctx, fn: (tx) => Promise<T>): Promise<T>`,但 better-sqlite3 是同步驱动,drizzle-orm/better-sqlite3 的 `db.transaction()` 返回 `T` 而非 `Promise<T>`。若硬走 async 路径,需 wrap `async tx =>` 内部 await(虽然 better-sqlite3 同步事务在 await 时已经 commit,语义错乱)。

**F-004 选择**:`runWithAudit<T>(db, ctx, fn: (tx: AuditTx) => T): T` — 与底层 better-sqlite3 同步事务对齐,fn 同步执行,审计 + realtime 写也在 fn 同一同步上下文。若 S3+ 切到 Postgres/pg 异步驱动,该函数签名将由 owner 升级为 `Promise<T>`,迁移时一并处理。S2 范围内不预留 async 兼容(避免无意义的 Promise 包装层)。

### 4. `AuditContext` 13 字段含 `goalSpaceId` + 3 个 realtime 字段,即使 `skipRealtime=true` 也必填

`goalSpaceId` / `eventType` / `resourceType` / `resourceId` 4 个字段在 `skipRealtime=true` 时实际不写表,但仍要求 caller 填。两种设计:

- **(a) Realtime 字段放子对象 `realtime?: { ... }`**:caller 需在 skipRealtime=true 时省略子对象,类型安全但 caller 体验差(每写一次都要判 skip 标记)
- **(b) 平铺 13 字段,skip 时仍填**(选择):类型简单,call site 一次写齐;skip 仅影响"实际是否 insert",不影响 ctx 形状

**F-004 选择 (b)**:简化 caller 体验。T-013 段 4 skipRealtime 测试 case 仍传 `goalSpaceId: "g1"` 等字段,验证"传了但 skip 后不写表"的契约。S3+ caller 写 ctx 时可考虑工厂函数统一生成默认值(后续 S3 决定)。

### 5. `AuditTx` 用条件类型从 `DrizzleDb["transaction"]` 提取,避免重复声明

Drizzle better-sqlite3 的 transaction 回调形参类型是 `BetterSQLite3Transaction<TSchema>`,本可以直接 `import` 那个类型,但 Drizzle 0.36 没有顶层 export `BetterSQLite3Transaction`,需从内部路径取(易碎)。

**F-004 选择**:`type AuditTx = Parameters<DrizzleDb["transaction"]>[0] extends (tx: infer T) => unknown ? T : never` — 从 `DrizzleDb` 类型反推,跟随 Drizzle 内部签名变化自动适应。`DrizzleDb` 已在 `db/client.ts` 导出,run-with-audit.ts 仅 import 类型,无运行时循环依赖。

### 6. `getDb()` 单例模式:重复调用返回同一 connection,避免 better-sqlite3 连接泄漏

F-004 AC-4.8 要求导出 `getDb()`。better-sqlite3 每次 `new Database(path)` 都打开新 file handle + WAL file,进程内多实例会:
- 占用多 file handle(可能突破 OS limit)
- 同进程跨事务可见性错乱(WAL 模式允许多 reader + 1 writer,但同进程多 connection 仍可能锁定竞争)

**F-004 选择**:模块级 `_cached: { sqlite, db } | null`,首次调用创建 + 设置 pragma + 缓存,后续返回同一对象。`@/lib/audit` 测试(T-013/T-015)显式不走 `getDb()`(per AC-4.8 description:"测试自建 new Database(':memory:') + drizzle(...) 不走本函数"),保持测试隔离与单例路径不混。

## 实施期注意点

- **test JSON 字段首次断言错**:`details` / `beforeState` / `afterState` / `payload` 字段 schema 标 `mode: "json"`,Drizzle 读时**自动 parse** 为 JS 对象(非 string)。初次写测试用 `JSON.parse(a.details as unknown as string)` → 失败 `SyntaxError: "[object Object]" is not valid JSON`。修复:删 `JSON.parse` 直接 `expect(a.details).toEqual({...})`。F-001 / F-002 / F-003 测试都是 enum literal union 字符串比对,未遇此问题;F-004 第一次触碰 JSON 字段 round-trip,记录给 S3+ handler 写读时参考。
- **`db:migrate` 需在干净 `dev.db` 跑**:S1 阶段 `dev.db` 已 gitignore,但 F-001 实施时该文件已存在(本地)。F-004 跑 `db:migrate` 前 `rm -f apps/web/db/dev.db` 强制干净,验证 `migrations applied successfully` 与 schema 11 张表存在(F-001 baseline 复用此模式)
- **vitest environmentMatchGlobs 已就位**:F-001 T-002 schema-migrate 触发 R-2(jsdom 加载 better-sqlite3 native module 偶发失败),`vitest.config.mts` 加 `__tests__/audit/**` glob → `node` env。F-004 T-013/T-015 复用此配置,无新 config 改动
- **prettier 3 文件 format-on-save**:`run-with-audit.ts` (src) + `run-with-audit.test.ts` + `integration.test.ts`,Prettier 把多行对象字面量压成单行(100 列内),首次 `format:check` 失败 → `pnpm --filter web format` 自动修

## 验证矩阵(F-004 verification)

| 项 | 命令 | 结果 |
|---|---|---|
| typecheck | `pnpm --filter web typecheck` | ✅ 0 errors |
| lint | `pnpm --filter web lint` | ✅ 0 errors |
| format:check | `pnpm --filter web format:check` | ✅ All matched files use Prettier code style |
| unit | `pnpm --filter web test` | ✅ 224/224 (S1 26 + F-001 30 + F-002 117 + F-003 41 + F-004 10) |
| integration | T-015 真实 in-memory DB 端到端 round-trip | ✅ 2 case(11 audit 字段 + 7 realtime 字段全 round-trip;AC-4.5 跨 goalSpace 序列隔离) |
| api_contract | n/a | n/a(S2 不含 API) |
| migration | `pnpm --filter web db:check` + `db:migrate` | ✅ schema 一致 + 迁移应用成功(干净 dev.db) |
| smoke | (optional) | ⏭️ 不强制(无 dev server) |
| e2e | n/a | n/a |
| build | `pnpm --filter web build` | ✅ 4 static pages |
| 业务+audit+realtime 三段提交 | T-013 段 1 | ✅ 1 row each table |
| audit fail → 业务回滚 | T-013 段 2(BEFORE INSERT trigger RAISE(FAIL)) | ✅ cards/audit/realtime 三段均为 0 row |
| sequence 严格 1..10 | T-013 段 3 | ✅ 10 events sequence = [1..10] |
| skipRealtime 不写 realtime | T-013 段 4 | ✅ audit 1 row / realtime 0 row |
| append-only 静态 import 检查 | T-014 | ✅ 4 个名字均未导出 |
| audit 11 字段 round-trip | T-015 段 1(JSON 字段 Drizzle auto-parse) | ✅ |
| AC-4.5 跨 goalSpace 序列隔离 | T-015 段 2 | ✅ g-A [1,2,3] / g-B [1,2] |

## 交付清单(此 commit)

- `apps/web/src/lib/audit/run-with-audit.ts`(新建,122 行)
- `apps/web/src/lib/audit/index.ts`(新建,15 行)
- `apps/web/src/lib/db/client.ts`(新建,53 行)
- `apps/web/__tests__/audit/run-with-audit.test.ts`(新建,T-013,4 case)
- `apps/web/__tests__/audit/append-only.test.ts`(新建,T-014,4 case)
- `apps/web/__tests__/audit/integration.test.ts`(新建,T-015,2 case)

## 后续 S2 feature 接入点

- **S3 API handler**:`GET /api/goal-spaces` / `POST /api/cards` / `PATCH /api/cards/:id` 等写路径一律 `db.transaction((tx) => { ...业务写... return runWithAudit(db, ctx, () => { ... return result; }); })` 模式,或直接 `runWithAudit(db, ctx, (tx) => { ...业务写... return result; })`。S3 handler 写 `ctx` 时应封装一个 `buildAuditContext(actor, action, entity, before, after)` 工厂函数,避免 13 字段散点
- **F-002 接入点**:`assertGoalSpaceTransition(active, completed, opts)` 返回的 `missing: string[]` 可写进 `AuditContext.details.missing` 让审计可追溯"为什么 goal space 没能 complete"
- **F-003 接入点**:`assertAccess` 在 runWithAudit 事务**前**调(预检);事务内仍可调 can 函数二次确认(防御 S3 handler 误用),但 forbidden 不应 throw 进事务(否则业务回滚 + 错误日志混乱)
- **getDb()** 由 S3+ handler / middleware 注入,测试代码继续用 `new Database(':memory:')` 走自己的 connection

## 风险登记(更新)

- **R-7**(review/findings.md):4 commit 粒度 → F-001 + F-002 + F-003 + F-004 已落地,各 1 commit(等人类 commit 指令)
- **新增 R-12**:append-only 边界由 API 层 enforce,非物理 DB trigger(决策 2);若 S3+ 引入 raw SQL 通道(运维脚本 / 调试工具)直接 UPDATE/DELETE audit_entries,DB 仍可改。S3 范围如涉及此类通道,需补 BEFORE UPDATE/DELETE trigger migration
- **新增 R-13**:`runWithAudit` 同步返回(决策 3)与 AC-4.1 写 `Promise<T>` 不一致,迁移到 pg 异步驱动时需升级签名;S3 范围内同步,迁移期由 owner 同步修改 caller 端(不预留兼容层,避免死代码)
- **新增 R-14**:`getDb()` 单例 + `process.cwd()` 相对路径在 vitest 单测下不命中(S2 测试已显式不走),但 S3+ handler 在 `next start` / `next dev` 进程内 cwd 变化时(`process.cwd() === apps/web/`)需保持;若 S3 部署到 Vercel / Docker 等 cwd 不定的环境,需把 db 路径改成 env(`DATABASE_URL` / `DEV_DB_PATH`)+ 配置文件(`drizzle.config.ts` 也读同一 env)。S2 范围内保持 `process.cwd()` 简单路径,记录给 S3 owner


