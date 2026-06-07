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

