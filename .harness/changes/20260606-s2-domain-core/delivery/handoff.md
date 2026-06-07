# Handoff

Purpose: recovery snapshot for the next session. Keep it concise. Do not duplicate full sprint progress or full testing results; link or summarize them.

Change ID: `20260606-s2-domain-core`
Generated At: 2026-06-07
Status: delivery (Phase 5 closeout 收口;待人类 Phase 4 + 5 commit 指令)
Source branch: `20260606-s2-domain-core` (created 2026-06-07 from `20260606-dev-bootstrap` @ `eea017e`)
Parent change: `20260606-s1-scaffold` (commit `eea017e`,已 commit)

## Resume Summary

S2 领域核心 sprint 已 5-phase 全 close,4 个 P0 feature 全部 implemented + tested + committed。下个 session(S3 owner 启动)需要知道的:**S2 提供的是纯领域核心,不引入任何 API / UI / AI executor / 真实 session**;S3 范围是协作 UI + API 入口,会调用 S2 的 `@/lib/state-machine` / `@/lib/authorization` / `@/lib/audit` / `@db/schema` 这 4 个入口;**不要**在 S3 范围扩展 S2 路径(`apps/web/src/lib/{state-machine,authorization,audit}/` 是 S2 锁定,扩展需建新子目录 + 新 commit)。S3 owner 走 application-owner.md 的 5 阶段 workflow,新 change-id 格式 `YYYYMMDD-<s3-slug>`(S2 范围外)。完整 spec 见 `docs/specs/phase1_scope.md` § 5 + 本目录 `request_analysis/spec.md` + `delivery/summary.md`。

## Approval State

- Request analysis: **approved 2026-06-07**(人类"批准"指令)— 4 工件就位 `request_analysis/{spec,tasks,feature_list}.{md,md,json}`
- Review: **done 2026-06-07** — `review/findings.md` written,recommendation: Proceed;7 风险 + 5 missing tests + 5 open questions + scope 防漂移
- Implementation: **done** — F-001 `74e61d1` / F-002 `0fc9dd3` / F-003 `26d0311`(+ doc sweep `9785ead`)/ F-004 `ce6883c`(+ doc sweep `9b7d690`)
- Testing: **done** — `testing/results.md` written;224/224 tests pass;7 baseline/db:check/db:migrate/build checks all clean
- Delivery: **done** — `delivery/summary.md` + 本 handoff + `sprint_progress.md` 推 `complete`;等人类 commit 指令

## Last Known State

- Current phase: **Phase 5 Delivery closeout 写完,等人类 Phase 4 + 5 commit 指令**
- Current focus: `.harness/changes/20260606-s2-domain-core/{testing/results.md,delivery/summary.md,delivery/handoff.md,sprint_progress.md}` 4 文件待 commit
- Last completed artifact: `delivery/summary.md` 写完(本批 4 文件中第 2 个);下一步 `delivery/handoff.md`(本文件)

## Remaining Tasks

- Task: 人类指令"commit"触发 Phase 4 + 5 commit 落仓(建议 message `docs(s2-delivery): Phase 4 testing results + Phase 5 delivery closeout`,见 `delivery/summary.md` 末)
- Task: 人类指令"合并到 master" / "merge to master" / 等价语触发 PR 合并(在 commit 之后);S2 完成后,master head 含 `eea017e` + `74e61d1` + `0fc9dd3` + `26d0311` + `9785ead` + `ce6883c` + `9b7d690` + Phase 4 + 5 commit
- Task: S3 owner 启动新 session,按 application-owner.md 5 阶段 workflow 走;新 change-id 不复用 S2 ID
- Task: S3 实施时引用 `docs/specs/phase1_scope.md` § 5 + 本目录 `request_analysis/spec.md` 定位 S3 范围(协作 UI + API 入口 + 真实 session)

## Verification Snapshot

| Check | Result | Notes |
|------|--------|-------|
| lint | passed | 0 errors, 0 warnings |
| typecheck | passed | 0 errors(F-001 22 types;F-002 state machine;F-003 9 can + assert;F-004 `runWithAudit` + `AuditTx` + `AuditContext` 13 字段) |
| format:check | passed | All matched files use Prettier code style |
| unit | passed | **224/224**(S1 23 + F-001 30 + F-002 117 + F-003 41 + F-004 10) |
| integration | passed | T-015 真实 in-memory DB 端到端(audit_entries 11 字段 + realtime_events 7 字段 round-trip + AC-4.5 跨 goalSpace) |
| api_contract | not_applicable | S2 spec 不含 API(per `docs/specs/phase1_scope.md` § 5) |
| migration | passed | F-001 `db:check` 0 errors + `db:migrate` 在干净 dev.db 应用 0000 成功 + `sqlite3 .tables` 11 张表全在 |
| smoke | skipped | 本 session 无 GUI;`pnpm build` 4 static pages 0 errors 可推断 dev server 可起;S3 浏览器手测时一并验 |
| e2e | not_applicable | S2 spec 不含 UI/API(per `docs/specs/phase1_scope.md` § 5) |

详细测试证据见 `testing/results.md`;交付汇总见 `delivery/summary.md`。

## Failed, Skipped, Or Unavailable Verification

- Check: smoke(浏览器手测)
  Reason: 本 session 无 GUI,`pnpm dev` 未跑通视觉验证
  Risk: 低 — S2 是纯领域核心(无 UI 组件),`pnpm build` 4 static pages 通过可推断 dev server 也能起;S3+ 实施 API handler + UI 时由 S3 owner 在浏览器中执行
- Check: e2e
  Reason: S2 spec 明确不含 UI / API / AI executor(per `docs/specs/phase1_scope.md` § 5)
  Risk: 无 — S2 范围外,S3+ 引入 e2e(Playwright / Vitest browser)再启用

## Blockers

- 无。S2 sprint 5-phase 全 close,等人类 commit 指令即可。

## Files Touched

S2 sprint 全部 commit 改动文件列表(累计,不含本批 closeout 待 commit):

- `apps/web/db/schema.ts`(F-001,新建)
- `apps/web/db/migrations/0000_*.sql`(F-001,生成)
- `apps/web/drizzle.config.ts`(F-001,调整)
- `apps/web/package.json`(F-001,+4 db:* scripts)
- `apps/web/README.md`(F-001,+Database 段)
- `apps/web/vitest.config.mts`(F-001,environmentMatchGlobs)
- `apps/web/src/lib/state-machine/{card,goal-space,index}.ts`(F-002,3 源)
- `apps/web/src/lib/authorization/{types,goal-space,node-board,card,confirmation,execute,assert,index}.ts`(F-003,8 源)
- `apps/web/src/lib/audit/{run-with-audit,index}.ts`(F-004,2 源)
- `apps/web/src/lib/db/client.ts`(F-004,新建)
- `apps/web/__tests__/{smoke,schema,schema-types,schema-migrate,state-machine/*,authorization/*,audit/*}.test.ts`(累计 17 个测试文件)
- `.harness/changes/20260606-s2-domain-core/{request_analysis/*,review/findings.md,implementation/notes.md,request_analysis/feature_list.json,sprint_progress.md}`(sprint 工件,多次更新)

本批 Phase 4 + 5 closeout 待 commit 4 文件:
- `.harness/changes/20260606-s2-domain-core/testing/results.md`
- `.harness/changes/20260606-s2-domain-core/delivery/summary.md`
- `.harness/changes/20260606-s2-domain-core/delivery/handoff.md`(本文件)
- `.harness/changes/20260606-s2-domain-core/sprint_progress.md`(最终推 `complete`)

## Exact Next Step

- Step 1(下次 session):验证 `git status` 干净 + 分支 head 在 `9b7d690`(F-004 doc sweep)后
- Step 2(下次 session):等人类"commit"指令 → Phase 4 + 5 commit(suggested: `docs(s2-delivery): Phase 4 testing results + Phase 5 delivery closeout`)
- Step 3(下次 session):等人类"merge" / "PR"指令(若需要)→ 合并到 `20260606-dev-bootstrap` 或 `master`
- Step 4(S3 owner 启动):读 `docs/specs/phase1_scope.md` § 5 + 本目录 `request_analysis/spec.md` + `delivery/summary.md` + `testing/results.md` 了解 S3 范围
- Step 5(S3 owner):按 application-owner.md 5 阶段 workflow 走(S3 = 协作 UI + API 入口 + 真实 session);S3 调用 S2 入口(详见下"Notes")

## Notes For Next Session

- Note: S2 范围严格不动 `apps/desktop/` / `crates/*` / `Cargo.toml` / `DESIGN.md` / `docs/**` / `README.md`(除 `apps/web/README.md` Database 段)/ `AGENTS.md` / `CLAUDE.md` / `LICENSE` / `.github/workflows/web-ci.yml`;S3 owner 也应保持该边界
- Note: S3 实施时应**只**调用以下 4 个 S2 入口,不直接触碰内部实现:
  - `@/lib/state-machine` — 卡片 / 节点板 / goal space 状态机(详见 F-002 description)
  - `@/lib/authorization` — 9 个 can 函数 + assertAccess(详见 F-003 description)
  - `@/lib/audit` — runWithAudit + AuditContext(append-only 边界由本入口 enforce,详见 F-004 description)
  - `@db/schema` — 11 张表 + enum literal union(详见 F-001 description)
- Note: S3 实施 UI 时**必须**先读 `DESIGN.md`(CLAUDE.md "Design System" 段要求),不能直接 fork 设计
- Note: S3 引入真实 session 时,S2 范围内的 `can*` 函数接收 `Actor` 抽象(S2 已设计)由 S3 注入;不需要修改 S2 函数签名
- Note: S3 引入 SSE 实时推送时,消费 `realtime_events` 表(S2 仅写不读);consumer 端需决策 archive / partition 策略
- Note: S3 引入真实登录时,`users` 表的 password 字段由 S3 决定(S2 schema 仅含基础 8 字段,不含 password);如需加列须新 migration
- Note: 任何对 S2 路径的修改必须新开 sprint(change-id 复用 S2 模板但日期不同),不允许在 S3 change 内修改 S2 路径
- Note: F-004 `runWithAudit` 同步返回(S2 设计决策);若 S3+ 引入 async I/O 在 fn 内,需 S3 owner 升级为 `transaction(async tx => ...)`,Drizzle 支持
- Note: F-004 `getDb()` 依赖 `process.cwd()`;S3 Next.js rootDir 默认在 `apps/web/` 故无影响;若 S3 改 rootDir 须 verify
- Note: F-001 partial unique index 用 `.where(sql\`...\`)` API 表达;S3+ Drizzle 0.37+ 升级须重跑 `schema-migrate.test.ts` + `db:check`
