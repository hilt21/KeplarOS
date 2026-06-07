# Delivery Summary

Change ID: `20260606-s2-domain-core`
Status: delivery (Phase 5 closeout)
Date: 2026-06-07
Branch: `20260606-s2-domain-core` (created 2026-06-07 from `20260606-dev-bootstrap` @ `eea017e`)

## Change Summary

S2 领域核心 sprint 完成。交付物为 4 个 P0 feature 的实施 + 测试 + 文档:11 张 KEPLAR 业务表的 Drizzle SQLite schema + 初始迁移;Card 7 态 / Goal Space 4 态纯函数状态机;9 个 can 函数 + Actor/AccessContext/ForbiddenError/assertAccess 权限矩阵;runWithAudit 业务 + audit + 可选 realtime 同事务原子提交包装器。S2 严格不引入 API handler / UI / AI executor / 真实 session,符合 `docs/specs/phase1_scope.md` § 5 范围边界。

父 change: `20260606-s1-scaffold` (commit `eea017e`)
全部子 commit 均基于 `eea017e` 之上,在分支 `20260606-s2-domain-core` 累计 6 个 commit:

1. `74e61d1` — feat(s2-f001): Drizzle schema + initial migration(17 files, +3485 / -12)
2. `0fc9dd3` — feat(s2-f002): Card & Goal Space state machines(9 files, +1427 / -17)
3. `26d0311` — feat(s2-f003): Authorization matrix(17 files, +936 / -15)
4. `9785ead` — docs(s2-sprint): record F-003 commit hash(1 file, +2 / -1)
5. `ce6883c` — feat(s2-f004): Audit transaction wrapper + db client(9 files, +804 / -19)
6. `9b7d690` — docs(s2-sprint): record F-004 commit hash(1 file, +4 / -4)

## Files Changed

### F-001 Drizzle Schema + Initial Migration(`74e61d1`)

- Path: `apps/web/db/schema.ts`
  Summary: 新建 11 张 KEPLAR 业务表 Drizzle SQLite 定义(users / goal_spaces / node_boards / node_board_members / sessions / agent_executions / cards / state_transitions / human_confirmations / audit_entries / realtime_events)+ 12 个 enum literal union + 22 个 InferSelectModel/InferInsertModel 类型 + 5 个 partial unique index
- Path: `apps/web/db/migrations/0000_*.sql`
  Summary: drizzle-kit generate 产出 + 人工校对补 partial index 后的迁移
- Path: `apps/web/drizzle.config.ts`
  Summary: 调整 schema 文件路径
- Path: `apps/web/package.json`
  Summary: +4 scripts: db:generate / db:migrate / db:check / db:studio
- Path: `apps/web/README.md`
  Summary: +Database 段(11 张表概览 + db:* 用法)
- Path: `apps/web/__tests__/schema.test.ts`
  Summary: 新建 13 case — 12 enum literal union + 1 helper enum 值集合与 3 个真相源一致
- Path: `apps/web/__tests__/schema-types.test.ts`
  Summary: 新建 8 case — 22 个 InferSelectModel/InferInsertModel 字段映射
- Path: `apps/web/__tests__/schema-migrate.test.ts`
  Summary: 新建 9 case — 0000 迁移应用 + 11 表存在 + 5 partial unique 实际拦截重复行 + UUID/JSON/timestamp 默认值
- Path: `apps/web/__tests__/smoke.test.ts`
  Summary: 更新 1 it(schema 长度 0 → 11)
- Path: `apps/web/vitest.config.mts`
  Summary: environmentMatchGlobs 给 `__tests__/audit/**` 切 `node` 环境(better-sqlite3 native)

### F-002 Card & Goal Space State Machines(`0fc9dd3`)

- Path: `apps/web/src/lib/state-machine/card.ts`
  Summary: Card 7 态 + 13 跨态 + 4 自环 = 17 合法转移;canTransition / assertTransition / isTerminalState / getRequiredActor / isValidState / CARD_STATES / CARD_TRANSITIONS
- Path: `apps/web/src/lib/state-machine/goal-space.ts`
  Summary: Goal Space 4 态 + 4 跨态 + 终态拒绝;canGoalSpaceTransition / assertGoalSpaceTransition 返回 missing: string[] 覆盖 8 布尔组合 / isGoalSpaceTerminal
- Path: `apps/web/src/lib/state-machine/index.ts`
  Summary: 聚合 re-export
- Path: `apps/web/__tests__/state-machine/card.test.ts`
  Summary: 67 case — 17 合法 + 16+ 非法 + 11 trigger + 角色分类 + 终态拒绝
- Path: `apps/web/__tests__/state-machine/goal-space.test.ts`
  Summary: 36 case — 4 跨态 + 终态 + 8 布尔组合 + cancelReason
- Path: `apps/web/__tests__/state-machine/integration.test.ts`
  Summary: 14 case — 状态机 × F-001 enum literal union 联动

### F-003 Authorization Matrix(`26d0311`)

- Path: `apps/web/src/lib/authorization/types.ts`
  Summary: Actor / AccessResult / ResourceContext 类型;ForbiddenError
- Path: `apps/web/src/lib/authorization/goal-space.ts`
  Summary: canReadGoalSpace / canManageGoalSpace
- Path: `apps/web/src/lib/authorization/node-board.ts`
  Summary: canReadNodeBoard / canManageNodeBoard / canManageNodeBoardMembers
- Path: `apps/web/src/lib/authorization/card.ts`
  Summary: canReadCard / canMutateCard
- Path: `apps/web/src/lib/authorization/confirmation.ts`
  Summary: canDecideConfirmation
- Path: `apps/web/src/lib/authorization/execute.ts`
  Summary: canExecuteCard(组合 canReadCard + !hasPendingConfirmation)
- Path: `apps/web/src/lib/authorization/assert.ts`
  Summary: assertAccess(true/false, msg): void | throws ForbiddenError(TS asserts allowed is true)
- Path: `apps/web/src/lib/authorization/index.ts`
  Summary: 聚合 re-export
- Path: `apps/web/__tests__/authorization/goal-space.test.ts`
  Summary: 7 case — initiator / chain_user / viewer × own / cross
- Path: `apps/web/__tests__/authorization/node-board.test.ts`
  Summary: 8 case — 成员 / 非成员 × own / cross
- Path: `apps/web/__tests__/authorization/card.test.ts`
  Summary: 13 case — member / assignedTo / 空 × initiator / chain_user / viewer
- Path: `apps/web/__tests__/authorization/confirmation.test.ts`
  Summary: 4 case — initiator only
- Path: `apps/web/__tests__/authorization/execute.test.ts`
  Summary: 5 case — canReadCard + !hasPendingConfirmation
- Path: `apps/web/__tests__/authorization/assert.test.ts`
  Summary: 4 case — true 不抛 / false 抛 ForbiddenError / TS asserts

### F-004 Audit Transaction Wrapper(`ce6883c`)

- Path: `apps/web/src/lib/audit/run-with-audit.ts`
  Summary: AuditContext 13 字段 interface + AuditTx conditional type + runWithAudit<T>(db, ctx, fn): T 业务+audit+可选 realtime 同事务原子写
- Path: `apps/web/src/lib/audit/index.ts`
  Summary: 聚合 re-export(append-only 边界:不导出 updateAuditEntry / deleteAuditEntry / truncateAudit / dropAuditTable)
- Path: `apps/web/src/lib/db/client.ts`
  Summary: getDb() Drizzle + better-sqlite3 单例(WAL + foreign_keys=ON)
- Path: `apps/web/__tests__/audit/run-with-audit.test.ts`
  Summary: 4 case — AC-4.2 / AC-4.3(BEFORE INSERT trigger RAISE(FAIL)模拟回滚)/ AC-4.4(10 次 sequence 1..10)/ AC-4.6(skipRealtime)
- Path: `apps/web/__tests__/audit/append-only.test.ts`
  Summary: 4 case — 静态 import 检查 4 个未导出名字
- Path: `apps/web/__tests__/audit/integration.test.ts`
  Summary: 2 case — audit_entries 11 字段 + realtime_events 7 字段 round-trip + AC-4.5 跨 goalSpace sequence 互不影响

### Doc Sweeps(`9785ead` + `9b7d690`)

- Path: `.harness/changes/20260606-s2-domain-core/sprint_progress.md`
  Summary: 两次追加 commit hash 记录行,保持 sprint_progress 与分支 head 同步

### Phase 4 + 5 closeout(本批)

- Path: `.harness/changes/20260606-s2-domain-core/testing/results.md`
  Summary: 224/224 测试结果 + Verification Matrix + Skipped/Untested 风险 + 3 follow-up
- Path: `.harness/changes/20260606-s2-domain-core/delivery/summary.md`
  Summary: 本文件(Phase 5 收口)
- Path: `.harness/changes/20260606-s2-domain-core/delivery/handoff.md`
  Summary: S2 → S3 恢复快照 + Verification Snapshot + Next Step
- Path: `.harness/changes/20260606-s2-domain-core/sprint_progress.md`
  Summary: 最终推 `complete` — Status → delivery complete / Phase Status 5/5 Done / Overall 100% / Change Log 收口

## Verification Performed

| Check | Required | Command | Result | Notes |
|------|----------|---------|--------|-------|
| lint | yes(全部 4 features) | `pnpm --filter web lint` | passed | 0 errors, 0 warnings(F-003 阶段修 2 unused-var 后 0 warnings) |
| typecheck | yes(全部 4 features) | `pnpm --filter web typecheck` | passed | 0 errors(F-001 enum + 22 types;F-002 state machine 类型导出;F-003 9 can + assert;F-004 `runWithAudit` + `AuditTx` 条件类型 + `AuditContext` 13 字段) |
| format:check | yes(全部 4 features) | `pnpm --filter web format:check` | passed | All matched files use Prettier code style(F-004 阶段跑了 `format` 修 3 个文件的 inline object 后再 check 0) |
| unit test | yes(全部 4 features) | `pnpm --filter web test` | passed | **224/224**(S1 23 + F-001 30 + F-002 117 + F-003 41 + F-004 10,4 个 feature 累计合并 + smoke 1 it 更新 = 224) |
| build | yes(S2 含 build 验收) | `pnpm --filter web build` | passed | 4 static pages, 0 errors |
| db:check | yes(F-001) | `pnpm --filter web db:check` | passed | 0 errors(generated migration 与 schema 一致) |
| db:migrate | yes(F-001 + F-004) | `pnpm --filter web db:migrate` | passed | 在干净 dev.db 应用 0000 迁移 + 11 张表 + 5 partial unique index |
| integration test | yes(F-004) | T-015 真实 in-memory DB 端到端 | passed | audit_entries 11 字段 + realtime_events 7 字段 round-trip + AC-4.5 跨 goalSpace sequence 隔离 |
| api_contract | n/a | (S2 不含 API) | n/a | per phase1_scope § 5 |
| smoke | optional | (无 dev server) | skipped | 见下"Skipped" |
| e2e | n/a | (S2 不含 UI/API) | n/a | per phase1_scope § 5 |

完整证据见 `testing/results.md`。

## Known Risks

> 风险编号 R-1 ~ R-14 全部为 review/findings.md + 实施期追加;每条均已在 implementation/notes.md 标注 mitigation 决策。S2 实施期验证 0 阻塞,均为已 mitigated。

- R-1 Drizzle partial unique index 限制 → F-001 用 `.where(sql\`...\`)` API 表达;`db:generate` 后人工校对 + 补;`db:check` 0 errors 是 done 硬门槛
- R-2 better-sqlite3 同步 API 与 vitest jsdom 兼容性 → `vitest.config.mts` 用 `environmentMatchGlobs` 把 `__tests__/audit/**` 切到 `node` 环境(已生效)
- R-3 状态机纯函数化 → F-002 全部纯函数不依赖 Drizzle 实例,便于单测;`assertGoalSpaceTransition` 的 missing 列表由 F-004 事务内查询填充
- R-4 权限矩阵在 S2 无真实 actor → S3 注入 Actor from session;F-003 全部纯函数不依赖 Drizzle 实例
- R-5 `assertAccess` 抛错版本仅在 API 边界使用 → S3 handler 直接 `assertAccess(canReadCard(...), '...')`;S2 范围内仅在 4 个测试用例中 throw
- R-6 `runWithAudit` 同步返回 vs 异步 → better-sqlite3 transaction 是 sync;fn 接收 `tx: AuditTx` 也按 sync API 设计;若 S3+ 引入 async I/O 在 fn 内,需 owner 升级为 `transaction(async tx => ...)`(Drizzle 支持)
- R-7 4 个 enum literal union 顺序不强制 → F-001 测试只验值集合不验顺序
- R-8 Drizzle 0.36 → 0.37+ 升级 → S2 实施期明确不升级;S3+ 升级前需重跑 schema-migrate test
- R-9 S2 范围防漂移 → 严格不引入 API / UI / AI executor / 真实 session;S2 路径只动 `apps/web/{db,src/lib,__tests__}` + `apps/web/{package.json,drizzle.config.ts,README.md}` + `.harness/changes/20260606-s2-domain-core/**`
- R-10 F-003 跨 goal_space_id 访问一律 false → AC-3.11 由所有 9 个 can 函数第一行 enforce;6 个测试文件覆盖
- R-11 F-003 9 个 can 函数对 `actor.goalSpaceId !== resource.goalSpaceId` 拒绝时,忽略 initiator 提升 → 与 authorization_matrix.md § 4 保持一致(所有"跨 goalSpace 访问"含义均为 actor 与 resource 不在同一 goalSpace)
- R-12 F-004 append-only 边界由 API 不导出 enforce → NOT just DB-level trigger;若 S3+ 绕过 `@/lib/audit` 直接 import `db/client.ts` + `auditEntries` table,append-only 失效 → mitigation:`@/lib/audit` 是 S3 唯一推荐入口,code review 拦
- R-13 F-004 sync API → 见 R-6
- R-14 F-004 `getDb()` 依赖 `process.cwd()` → 需从 `apps/web/` 子目录启动 dev/start;S3 Next.js rootDir 默认在 `apps/web/` 故无影响;若 S3+ 改 rootDir 需重新 verify

## Follow-Ups

> S3+ owner 直接可执行,每条均为"推荐",非阻塞 S2 关闭。

- F-U1 S3 实施 API handler 时,补 Next.js route handler × runWithAudit 集成测试(per phase1_scope § 5 S3 = 协作 UI + API 入口);`__tests__/api/*.test.ts` 覆盖 403 / 409 / 200 路径(由 F-003 assertAccess + F-004 runWithAudit 共同 enforce)
- F-U2 S3 引入真实 session / cookie / JWT 后,补 `__tests__/middleware/session.test.ts` 验证 S2 当前未涉及的 auth path
- F-U3 S3+ 决定 Node cluster / 多 worker 时新增 `__tests__/audit/concurrent.test.ts`,模拟 N 个 worker 并发 INSERT 验证 sequence 仍 1..N 严格递增(F-004 description 给出 mitigation 路径:pg advisory lock 或独立 sequence 表)
- F-U4 S3 实施时验证 `pnpm dev` 在浏览器中可起;S2 已验证 `pnpm build` 4 static pages 0 errors 但未跑 dev server(S2 spec 不强制)
- F-U5 S3+ 升级 Drizzle 0.36 → 0.37+ 时,重跑 `__tests__/schema-migrate.test.ts` + `db:check` 验证 partial unique index 仍正确生成
- F-U6 S3+ 引入 Drizzle relational query API 时,补充 `InferSelectModel` 与查询返回值的对齐测试(S2 仅覆盖 schema-level 类型)
- F-U7 S3+ 引入 SSE 推送时,验证 `realtime_events` 表被长连接 consumer 持续 SELECT 而不积压(S2 仅写不读);F-004 description 已注明 partition / archive 决策待 S3+ owner
- F-U8 S3+ 实施 `node_boards.key` 唯一性修复逻辑时(若发现 hard-delete 后残留 display_id 冲突),记录在 `node_board_members` 迁移注释中(S2 范围内未触发,但 partial unique index 允许历史 hard delete 后重置)

## Recommended Commit Message

```text
docs(s2-delivery): Phase 4 testing results + Phase 5 delivery closeout

- Add testing/results.md: 224/224 tests, verification matrix, skipped/untested risks, 3 follow-ups
- Add delivery/summary.md: 4-commit S2 sprint closeout, files per feature, 14 risks, 8 follow-ups
- Add delivery/handoff.md: S2 -> S3 recovery snapshot, verification snapshot, exact next step
- Update sprint_progress.md: status -> delivery complete, Phase Status 5/5 Done, Overall 100%

Refs: 74e61d1 (F-001), 0fc9dd3 (F-002), 26d0311 + 9785ead (F-003), ce6883c + 9b7d690 (F-004)
```

## Sprint Progress Final Update

- `sprint_progress.md` 头部 Status 由 "implementation complete" → **"delivery complete (S2 5-phase 收口;待人类 Phase 4 + 5 commit 指令)"**
- `sprint_progress.md` Phase Status 表全部 5 个 Phase → **Done**
  - Request Analysis: Done(原)
  - Review: Done(原)
  - Implementation: Done(F-001 + F-002 + F-003 + F-004 全部 committed)
  - Testing: Done(`testing/results.md` 完成)
  - Delivery: **Done**(本批 closeout)
- `sprint_progress.md` Overall Progress → **100%**
- `sprint_progress.md` Current Blockers → 仍 **No blockers**
- `sprint_progress.md` Pending 全部项 → 标 `[x]` completed
- `sprint_progress.md` Change Log 追加本批 closeout 条目 + Phase 5 commit hash 占位
- `sprint_progress.md` Current Focus → 等待人类 Phase 4 + 5 commit 指令;commit 后 S2 sprint 全 closed,S3 owner 接管
- `sprint_progress.md` Next Step → S3 owner 启动 phase1_scope § 5 S3(协作 UI + API 入口),按 application-owner.md workflow 走 5 阶段;S2 范围不再扩展
