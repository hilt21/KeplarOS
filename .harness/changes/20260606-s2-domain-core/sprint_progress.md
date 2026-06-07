# Sprint Progress: S2 领域核心

Change ID: `20260606-s2-domain-core`
Status: **implementation complete (F-001 + F-002 + F-003 + F-004 implemented & baseline green; awaiting F-004 commit + Phase 5 Delivery)**
Branch: `20260606-s2-domain-core` (created 2026-06-07 from `20260606-dev-bootstrap` @ `eea017e`)
Phase 1 sub-project: **S2 领域核心**
Parent change: `20260606-s1-scaffold` (commit `eea017e`,已 commit)

## Status Summary

**Phase**: Implementation (Phase 3) — F-001 ✅ committed (`74e61d1`); F-002 ✅ committed (`0fc9dd3`); F-003 ✅ committed (`26d0311` + post-commit doc sweep `9785ead`); F-004 ✅ implementation complete & 224/224 tests green & 5 baseline + db:check + db:migrate all clean,awaiting F-004 commit
**Overall Progress**: **95%**(Phase 1+2+3 done;Phase 3 done 4/4 features;Phase 4 testing baseline green;Phase 5 delivery pending)
**Target Features**: F-001 Schema / F-002 State Machine / F-003 Authorization / F-004 Audit Transaction(全部 P0)
**Implementation Branch**: `20260606-s2-domain-core`(created 2026-06-07)

## Phase Status

| Phase | Status | Notes |
|------|--------|-------|
| Request Analysis | **Done** | 4/4 工件就位 + 人类"批准" 2026-06-07 |
| Review | **Done** | `review/findings.md` written,recommendation: Proceed;7 个 non-blocking risks + 5 missing tests + 5 open questions(均有倾向) + scope 防漂移加注 |
| Implementation | **In Progress (F-001 + F-002 + F-003 committed; F-004 implementation complete, awaiting commit)** | 分支 `20260606-s2-domain-core` 已建;F-001 ✅ committed at `74e61d1`(17 files, +3485 / -12);F-002 ✅ committed at `0fc9dd3`(9 files, +1427 / -17);F-003 ✅ committed at `26d0311` + post-commit doc sweep `9785ead`(17 + 1 files, +936 / -15 / +2 / -1);F-004 ✅ implementation 完成,5 baseline + db:check + db:migrate 全绿,等人类 commit 指令 |
| Testing | In Progress (F-004 baseline green) | F-001 baseline 命令全绿(5/5 + db:check + db:migrate + sqlite3 .tables);F-002 baseline 全绿(5/5 + 117 新测试 = 173 总);F-003 baseline 全绿(5/5 + 41 新测试 = 214 总);F-004 baseline 全绿(5/5 + db:check + db:migrate + 10 新测试 = 224 总);`testing/results.md` 写完待 Phase 4 收口 |
| Delivery | Not Started | `delivery/summary.md` + `handoff.md`;`sprint_progress.md` 推 `complete`;S2 → S3 handoff 写完 |

## Current Blockers

**No blockers.** F-001 实施中。

## Completed

**Phase 1 Request Analysis(done 2026-06-07):**
- [x] 读取并理解 `## Application Owner Runtime` SOP(CLAUDE.md lines 47-77)
- [x] 读取 `.harness/agents/application-owner.md`(workflow 5 阶段)
- [x] 读取 `.harness/rules/coding-discipline.md` 与 `README.md`
- [x] 读取 `.harness/skills/request-analysis/SKILL.md`(Phase 1 SOP)
- [x] 读取 `.harness/skills/coding-skill/SKILL.md` / `unit-test-write/SKILL.md`(后续阶段 SOP)
- [x] 读取 S1 handoff(`.harness/changes/20260606-s1-scaffold/delivery/handoff.md`)定位 S2 范围
- [x] 读取 S1 spec 全文 + `docs/specs/phase1_scope.md` § 5 确认 S2 = 领域核心
- [x] 读取 `docs/specs/database_design.md`(11 张表 + 字段 + 索引 + SQLite 适配)F-001 真相源
- [x] 读取 `docs/architecture/state_transition.md`(卡片 7 态 + 转移表 + trigger)F-002 真相源
- [x] 读取 `docs/specs/authorization_matrix.md`(角色 + 资源归属 + API 矩阵 + 强制门禁)F-003 真相源
- [x] 读取 `docs/architecture/test_matrix.md` § 6 最小测试门禁 + 覆盖率要求
- [x] 读取 `DESIGN.md` 确认 S2 不涉及 UI
- [x] 读取 S1 `apps/web/db/schema.ts` 占位 + `drizzle.config.ts` + `package.json` scripts 摸清现状
- [x] 创建 `.harness/changes/20260606-s2-domain-core/request_analysis/` 目录
- [x] 写 `request_analysis/spec.md`(4 个 feature 范围 + 12 AC + 7 Risks + 5 Open Questions)
- [x] 写 `request_analysis/tasks.md`(4 feature × 9/5/9/7 tasks + 15 test tasks + sequencing)
- [x] 写 `request_analysis/feature_list.json`(F-001/F-002/F-003/F-004 全部 `not_started` × 3)
- [x] 写 `sprint_progress.md`(本文件)

**Phase 2 Review(done 2026-06-07):**
- [x] 加载 `.harness/skills/expert-reviewer/SKILL.md` + `.harness/templates/review-findings.md`
- [x] 写 `review/findings.md`(recommendation: Proceed;7 风险 + 5 missing tests + 5 open questions + scope 防漂移)
- [x] 更新 `sprint_progress.md`(Phase 1+2 → Done)

**Phase 3.1 Branch(done 2026-06-07):**
- [x] `git checkout -b 20260606-s2-domain-core 20260606-dev-bootstrap` → 分支创建成功

## In Progress

- (空)— F-001 + F-002 + F-003 已 commit,F-004 implementation 完成,等人类"commit"指令。

## Pending

- [x] F-001 实施 + 测试 + baseline 通过
- [x] F-001 写 `implementation/notes.md` + 更新 `feature_list.json`(F-001 `completed` × 3)
- [x] F-001 commit `74e61d1`(17 files, +3485 / -12)
- [x] 人类"开始第二个feature"指令 → F-002 启动
- [x] F-002 实施:`apps/web/src/lib/state-machine/{card,goal-space,index}.ts` + 3 测试文件(`__tests__/state-machine/{card,goal-space,integration}.test.ts`)117 case
- [x] F-002 5 baseline + 173/173 test 全绿
- [x] F-002 追加 `implementation/notes.md` F-002 段 + 更新 `feature_list.json`(F-002 `completed` × 3)
- [x] F-002 commit `0fc9dd3`(9 files, +1427 / -17)
- [x] 人类"开始实施 F-003"指令
- [x] Phase 3.4:实施 F-003(Authorization Matrix)→ 8 源 + 6 测试 + 1 commit
- [x] F-003 追加 `implementation/notes.md` F-003 段 + 更新 `feature_list.json`(F-003 `completed` × 3)
- [x] F-003 5 baseline + 214/214 测试全绿
- [x] F-003 commit `26d0311`(17 files, +936 / -15) + post-commit doc sweep `9785ead`(1 file, +2 / -1)
- [x] 人类"执行"指令 → F-004 启动
- [x] Phase 3.5:实施 F-004(Audit Transaction Wrapper)→ 3 源(`run-with-audit.ts` / `index.ts` / `db/client.ts`)+ 3 测试 + 1 commit 待落
- [x] F-004 追加 `implementation/notes.md` F-004 段 + 更新 `feature_list.json`(F-004 `completed` × 3)
- [x] F-004 5 baseline + db:check + db:migrate + 224/224 测试全绿(S1 26 + F-001 30 + F-002 117 + F-003 41 + F-004 10)
- [ ] 人类"commit"指令 → F-004 commit 落仓
- [ ] Phase 4 Testing:写 `testing/results.md`(5 baseline + 224/224 测试记录)收口
- [ ] Phase 5 Delivery:`delivery/summary.md` + `handoff.md` 写完;`sprint_progress.md` 推 `complete`;S2 → S3 handoff

## Current Focus

- **Phase 4 + 5 收口**。F-001 + F-002 + F-003 + F-004 已 commit(`74e61d1` + `0fc9dd3` + `26d0311` + `9785ead` + `ce6883c`),S2 实施阶段全部完成。等人类指令启动 Phase 4 testing/results.md 与 Phase 5 delivery。

## Next Step

1. 收到指令后:Phase 4 Testing 收口 → 写 `testing/results.md`(5 baseline + 224/224 测试记录)
2. Phase 5 Delivery → 写 `delivery/summary.md` + `delivery/handoff.md`;`sprint_progress.md` 推 `complete`;S2 → S3 handoff

## Risks & Notes (摘自 review/findings.md,精简版)

- **R-1 Drizzle partial unique index 限制**:F-001 用 `.where(sql\`...\`)` API 表达;`db:generate` 后人工校对 + 补;`db:check` 0 errors 是 done 硬门槛
- **R-2 better-sqlite3 同步 API 与 vitest jsdom 兼容性**:F-001 测试如遇兼容问题,`vitest.config.mts` 用 `environmentMatchGlobs` 把 schema-migrate.test.ts 切到 `node` 环境
- **R-3 ~ R-7**:S2 实施阶段持续关注,详见 `review/findings.md`

## Change Log

- `2026-06-07`: Sprint progress created. 4 件 request_analysis 工件就位,等待人类批准。
- `2026-06-07`: Human "批准" 触发 Phase 2 Review;`review/findings.md` written,recommendation: Proceed。
- `2026-06-07`: Human "开始实施" 触发 Phase 3.1;分支 `20260606-s2-domain-core` created from `20260606-dev-bootstrap` @ `eea017e`;Phase 3.2 F-001 启动。
- `2026-06-07`: **F-001 ✅ 完成**。`apps/web/db/schema.ts` 11 张表 + 12 enum + 22 types;`apps/web/db/migrations/0000_amazing_the_fury.sql` 生成;`package.json` +4 db:* scripts;`__tests__/schema*.test.ts` 30 个新 case;5 baseline + db:check + db:migrate + sqlite3 .tables 全部 0 errors;`implementation/notes.md` 写完;`feature_list.json` F-001 → `completed` × 3;56/56 测试全绿。等人类 F-001 commit 指令。
- `2026-06-07`: **F-001 commit `74e61d1`** — 17 files, +3485 / -12。"feat(s2-f001): Drizzle schema + initial migration"。Working tree clean。等人类"开始实施 F-002"指令。
- `2026-06-07`: 人类"开始第二个feature" → F-002 启动。
- `2026-06-07`: **F-002 ✅ implementation 完成**。`apps/web/src/lib/state-machine/{card,goal-space,index}.ts` 3 source + 3 test 文件;Card 7 态 + 13 跨态 + 4 自环 + 11 trigger + role 分类;Goal Space 4 态 + complete 前置 8 布尔组合 + cancel reason 必填;`@/lib/state-machine` 聚合 re-export;5 baseline + 173/173 测试全绿(S1 26 + F-001 30 + F-002 117);`implementation/notes.md` 追加 F-002 段(9 决策 + 2 新风险);`feature_list.json` F-002 → `completed` × 3。等人类 F-002 commit 指令。
- `2026-06-07`: **F-002 commit `0fc9dd3`** — 9 files, +1427 / -17。"feat(s2-f002): Card & Goal Space state machines"。Working tree clean。等人类"开始实施 F-003"指令。
- `2026-06-07`: 人类"开始实施F-003" → F-003 启动。
- `2026-06-07`: **F-003 ✅ implementation 完成**。`apps/web/src/lib/authorization/{types,goal-space,node-board,card,confirmation,execute,assert,index}.ts` 8 source + 6 test 文件;9 个 can 函数 + Actor / 5 Context / ForbiddenError / assertAccess;`@/lib/authorization` 聚合 re-export;5 baseline + 214/214 测试全绿(S1 26 + F-001 30 + F-002 117 + F-003 41);`implementation/notes.md` 追加 F-003 段(8 决策 + 2 新风险 R-10/R-11);`feature_list.json` F-003 → `completed` × 3。等人类 F-003 commit 指令。
- `2026-06-07`: **F-003 commit `26d0311`** — 17 files, +936 / -15。"feat(s2-f003): Authorization matrix"。Working tree clean。等人类"开始实施 F-004"指令。
- `2026-06-07`: 人类"执行" → F-004 启动。
- `2026-06-07`: **F-004 ✅ implementation 完成**。`apps/web/src/lib/audit/{run-with-audit,index}.ts` + `apps/web/src/lib/db/client.ts` 3 source + 3 test 文件(`__tests__/audit/{run-with-audit,append-only,integration}.test.ts`)10 case;`runWithAudit<T>(db, ctx, fn)` 业务 + audit_entries + 可选 realtime_events 同事务原子写;realtime sequence 用单 SQL `SELECT COALESCE(MAX,0)+1` 子查询(AC-4.4);append-only 由 `@/lib/audit` index.ts NOT exporting 4 个名字 enforce(AC-4.7);`getDb()` Drizzle + better-sqlite3 单例(WAL + foreign_keys=ON,AC-4.8);`@/lib/audit` 聚合 re-export;5 baseline + db:check + db:migrate + 224/224 测试全绿(S1 26 + F-001 30 + F-002 117 + F-003 41 + F-004 10);`implementation/notes.md` 追加 F-004 段(6 决策 + 4 实施期注意点 + 3 新风险 R-12/R-13/R-14);`feature_list.json` F-004 → `completed` × 3。等人类 F-004 commit 指令。
- `2026-06-07`: **F-004 commit `ce6883c`** — 9 files, +804 / -19。"feat(s2-f004): Audit transaction wrapper + db client"。Working tree clean。等人类"Phase 4 + 5"指令。
