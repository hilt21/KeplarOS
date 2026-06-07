# Testing Results

Change ID: `20260606-s2-domain-core`
Status: testing complete
Date: 2026-06-07

## Tests Added Or Updated

- Test: `__tests__/smoke.test.ts`(S1 baseline;F-001 更新 1 个 it:schema 长度 0 → 11)
  Covers: S1 脚手架健康(jest/jsdom globals + workspace alias + schema 加载)
- Test: `__tests__/tokens.test.ts`(S1 baseline,23 case)
  Covers: S1 design token 解析
- Test: `__tests__/schema.test.ts`(F-001 T-001,13 case)
  Covers: 12 enum literal union + 1 helper enum 的值集合与 database_design.md / state_transition.md / authorization_matrix.md 三个真相源完全一致(AC-1.4 / AC-1.9)
- Test: `__tests__/schema-types.test.ts`(F-001 T-003,8 case)
  Covers: 22 个 InferSelectModel / InferInsertModel 类型的字段映射(round-trip 验证 11 张表 × 每表 ≥ 1 个字段)
- Test: `__tests__/schema-migrate.test.ts`(F-001 T-002,9 case)
  Covers: 0000 迁移应用成功 + 11 张表存在 + 5 个 partial unique index 实际拦截重复行 + UUID 默认值 32 字符小写 hex + JSON 默认 `{}` 合法 + timestamp 默认 `datetime('now')` ISO-8601(AC-1.6 / AC-1.7)
- Test: `__tests__/state-machine/card.test.ts`(F-002 T-004,67 case)
  Covers: Card 7 态 + 13 跨态 + 4 自环(共 17 条合法转移) + 16+ 非法转移拒绝 + 11 triggers literal 全在 + 角色分类(backlog→todo 需 ai_role,todo→dev 需 ai_role,blocked→* 需 system/human,task_cancelled 需 human/system) + 终态(Done/Cancelled)拒绝再转(AC-2.3 / AC-2.4 / AC-2.5 / AC-2.7)
- Test: `__tests__/state-machine/goal-space.test.ts`(F-002 T-005,36 case)
  Covers: Goal Space 4 态 + 4 跨态 + 终态拒绝 + assertGoalSpaceTransition 返回 missing: string[] 覆盖 8 布尔组合(hasPendingConfirmation × hasBlockedCard × allCardsDoneOrCancelled)+ cancelReason 必填(AC-2.6 / AC-2.8)
- Test: `__tests__/state-machine/integration.test.ts`(F-002 T-006,14 case)
  Covers: 状态机 × schema enum 联动(用 InferSelectModel<typeof cards> 验证 7 态值集合)、F-001 enum 完整性 × F-002 trigger 完整性交叉验证
- Test: `__tests__/authorization/goal-space.test.ts`(F-003 T-007,7 case)
  Covers: canReadGoalSpace / canManageGoalSpace × initiator / chain_user / viewer × own / cross goalSpace 组合(AC-3.2 / AC-3.3)
- Test: `__tests__/authorization/node-board.test.ts`(F-003 T-008,8 case)
  Covers: canReadNodeBoard / canManageNodeBoard / canManageNodeBoardMembers × 成员 / 非成员 × own / cross goalSpace(AC-3.4 / AC-3.5)
- Test: `__tests__/authorization/card.test.ts`(F-003 T-009,13 case)
  Covers: canReadCard / canMutateCard × member / assignedTo / 空 × initiator / chain_user / viewer(AC-3.6 / AC-3.7)
- Test: `__tests__/authorization/confirmation.test.ts`(F-003 T-010,4 case)
  Covers: canDecideConfirmation 仅 initiator(AC-3.8)
- Test: `__tests__/authorization/execute.test.ts`(F-003 T-011,5 case)
  Covers: canExecuteCard 组合 canReadCard + !hasPendingConfirmation × viewer 全 false / initiator 全 true / chain_user 限本节点(AC-3.9)
- Test: `__tests__/authorization/assert.test.ts`(F-003 T-012,4 case)
  Covers: assertAccess(true) 不抛 / assertAccess(false) 抛 ForbiddenError + `asserts allowed is true` TS 类型守卫编译通过(AC-3.10)
- Test: `__tests__/audit/run-with-audit.test.ts`(F-004 T-013,4 case)
  Covers: 业务+audit+realtime 三段同事务提交 / audit 写失败(BEFORE INSERT trigger RAISE(FAIL))触发整事务回滚 / 连续 10 次 sequence 严格 1..10 / skipRealtime=true 不写 realtime(AC-4.2 / AC-4.3 / AC-4.4 / AC-4.6 / AC-4.9)
- Test: `__tests__/audit/append-only.test.ts`(F-004 T-014,4 case)
  Covers: `@/lib/audit` 不导出 4 个名字:updateAuditEntry / deleteAuditEntry / truncateAudit / dropAuditTable(`import * as` 静态 import + `not.toHaveProperty`)(AC-4.7 / AC-4.10)
- Test: `__tests__/audit/integration.test.ts`(F-004 T-015,2 case)
  Covers: audit_entries 11 字段全 round-trip(JSON 字段 Drizzle auto-parse)+ realtime_events 7 字段全 round-trip + AC-4.5 跨 goalSpace sequence 互不影响(g-A [1,2,3] / g-B [1,2])

## Commands Run

```sh
# 5 baseline + 2 db commands + build
pnpm --filter web typecheck       # 0 errors
pnpm --filter web lint            # 0 errors
pnpm --filter web format:check    # All matched files use Prettier code style
pnpm --filter web test            # 17 test files, 224/224 tests passed
pnpm --filter web build           # 4 static pages, 0 errors
pnpm --filter web db:check        # Everything's fine
pnpm --filter web db:migrate      # migrations applied successfully (clean dev.db)
```

Result: **全绿**。S2 4 features × 5 baseline + db:check + db:migrate + build 0 errors / 0 warnings。

## Verification Matrix

| Check | Required | Command | Result | Notes |
|------|----------|---------|--------|-------|
| lint | yes | `pnpm --filter web lint` | passed | 0 errors, 0 warnings(F-003 阶段修 2 unused-var 后 0 warnings) |
| typecheck | yes | `pnpm --filter web typecheck` | passed | 0 errors(F-004 `runWithAudit` + `AuditTx` 条件类型 + `AuditContext` 13 字段全部类型对) |
| unit | yes | `pnpm --filter web test` | passed | 224/224(S1 26 + F-001 30 + F-002 117 + F-003 41 + F-004 10) |
| integration | yes(F-004) | T-015 真实 in-memory DB 端到端 | passed | F-004 T-015 覆盖 11 audit 字段 + 7 realtime 字段 round-trip + AC-4.5 跨 goalSpace |
| api_contract | n/a | (S2 不含 API) | n/a | n/a |
| migration | yes | `pnpm --filter web db:check` + `db:migrate` | passed | F-001 生成的 0000 migration 在干净 dev.db 应用成功;`db:check` schema 内部一致 |
| smoke | optional | (无 dev server) | skipped | S2 spec 不强制 dev server 启动;S1 smoke test 已覆盖 jest/jsdom/workspace alias 基础健康度 |
| e2e | n/a | (S2 不含 UI/API) | n/a | n/a |

## Skipped Or Unavailable Checks

- Check: smoke(浏览器手测)
  Reason: 本 session 无 GUI,`pnpm dev` 未跑通视觉验证
  Risk: S2 是纯领域核心(无 UI 组件),`pnpm build` 4 static pages 通过可推断 dev server 也能起;S3+ 实施 API handler + UI 时,`pnpm dev` 验证由 S3 owner 在浏览器中执行
- Check: e2e
  Reason: S2 spec 明确不含 UI / API / AI executor(per `docs/specs/phase1_scope.md` § 5)
  Risk: 无 — S2 范围外,S3+ 引入 e2e(Playwright / Vitest browser)再启用

## Feature Test Status

| Feature ID | Test Status | Notes |
|-----------|-------------|-------|
| F-001 | passed | 30 case(smoke 1 + schema 13 + schema-types 8 + schema-migrate 9 - 1 共享 it 调整 = 30 新 it 净增);5 baseline + db:check + db:migrate + sqlite3 .tables 全绿 |
| F-002 | passed | 117 case(card 67 + goal-space 36 + integration 14);5 baseline 全绿;173/173 含 F-001 合并 |
| F-003 | passed | 41 case(goal-space 7 + node-board 8 + card 13 + confirmation 4 + execute 5 + assert 4);5 baseline 全绿;214/214 含 F-001 + F-002 合并 |
| F-004 | passed | 10 case(run-with-audit 4 + append-only 4 + integration 2);5 baseline + db:check + db:migrate + build 全绿;224/224 含前三 feature 合并 |

## Untested Risks

- Risk: 真实并发场景下 better-sqlite3 写串行化 + WAL 模式是否真保证 realtime sequence 单调递增
  Reason not covered: T-013 / T-015 是单进程同步顺序执行,未模拟多 worker 并发 INSERT;better-sqlite3 在单进程内写串行化(per F-001 `client.ts` 注),但若 S3+ 引入 Node cluster / worker_threads / 多进程,需要新的并发测试
  Mitigation: S2 范围(单 Next.js dev / start 进程)不涉及;F-004 description 单 SQL 子查询 + better-sqlite3 串行化双层保证,S3+ 多进程化时由 owner 决定是否升级为 pg advisory lock 或 sequence 表
- Risk: 浏览器手测无 GUI 验证页面
  Reason not covered: smoke check 标记 skipped,本 session 无浏览器交互
  Mitigation: `pnpm build` 4 static pages 0 errors 可推断 dev server 可起;S3 验证 UI 时一并手测

## Follow-Up Test Recommendations

- Recommendation: S3+ 实施 API handler 时,补 Next.js route handler × runWithAudit 集成测试(per docs/specs/phase1_scope.md § 5 S3 = 协作 UI + API 入口);S3 范围的 vitest fetch mock + runWithAudit in-memory DB 路径应覆盖 HTTP 入口的 403 / 409 / 200 路径(由 F-003 assertAccess + F-004 runWithAudit 共同 enforce)
- Recommendation: S3+ 引入真实 session / cookie / JWT 后,补 `apps/web/__tests__/middleware/session.test.ts` 验证 S2 当前未涉及的 auth path
- Recommendation: 真实并发测试(若 S3+ 决定 Node cluster / 多 worker)新增 `__tests__/audit/concurrent.test.ts`,模拟 N 个 worker 并发 INSERT 验证 sequence 仍 1..N 严格递增

## Sprint Progress Update

- `sprint_progress.md` 状态由 "implementation complete, awaiting F-004 commit" 推进到 "Phase 4 testing complete;Phase 5 delivery in progress"
- `sprint_progress.md` Phase Status 表:Testing 由 "Not Started" → "Done"(本文件即证据)
- `sprint_progress.md` Status Summary "Overall Progress" 由 95% → 98%(Phase 4 done,Phase 5 文档收口待写)
- 本测试结果文件为本 S2 sprint 的 Phase 4 收口证据,S3+ owner 可直接引用
