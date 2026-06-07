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
