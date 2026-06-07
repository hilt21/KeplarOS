# Sprint Progress: S2 领域核心

Change ID: `20260606-s2-domain-core`
Status: **implementation in progress (F-001 done, awaiting commit)**
Branch: `20260606-s2-domain-core` (created 2026-06-07 from `20260606-dev-bootstrap` @ `eea017e`)
Phase 1 sub-project: **S2 领域核心**
Parent change: `20260606-s1-scaffold` (commit `eea017e`,已 commit)

## Status Summary

**Phase**: Implementation (Phase 3) — F-001 ✅ done (awaiting human commit instruction); F-002/F-003/F-004 not_started
**Overall Progress**: **40%**(Phase 1+2 done;Phase 3.1 done;Phase 3.2 F-001 done;F-002/F-003/F-004 not_started)
**Target Features**: F-001 Schema / F-002 State Machine / F-003 Authorization / F-004 Audit Transaction(全部 P0)
**Implementation Branch**: `20260606-s2-domain-core`(created 2026-06-07)

## Phase Status

| Phase | Status | Notes |
|------|--------|-------|
| Request Analysis | **Done** | 4/4 工件就位 + 人类"批准" 2026-06-07 |
| Review | **Done** | `review/findings.md` written,recommendation: Proceed;7 个 non-blocking risks + 5 missing tests + 5 open questions(均有倾向) + scope 防漂移加注 |
| Implementation | **In Progress (F-001 done, F-002 not_started)** | 分支 `20260606-s2-domain-core` 已建;F-001 Drizzle Schema + Initial Migration ✅ 完成(11 张表 + 12 enum + 5 partial index + 22 types + README);等待人类 commit 指令后启动 F-002 |
| Testing | Not Started | F-001 baseline 命令全绿(5/5 + db:check + db:migrate + sqlite3 .tables);F-002/003/004 各自 baseline 待跑 |
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

- (空)— F-001 已完成,等人类 commit 指令后启动 F-002。

## Pending

- [x] F-001 实施 + 测试 + baseline 通过
- [x] F-001 写 `implementation/notes.md` + 更新 `feature_list.json`(F-001 `completed` × 3)
- [ ] 人类明确 F-001 commit 指令(per "DO NOT commit unless human asks")
- [ ] Phase 3.3:实施 F-002(Card & Goal Space State Machines)→ 1 commit
- [ ] Phase 3.4:实施 F-003(Authorization Matrix)→ 1 commit
- [ ] Phase 3.5:实施 F-004(Audit Transaction Wrapper)→ 1 commit
- [ ] Phase 4 Testing:5 条 baseline 命令 + 各 feature 套件;`testing/results.md` 写完;`feature_list.json` 全部 `completed` / `passed` / `completed`
- [ ] Phase 5 Delivery:`delivery/summary.md` + `handoff.md` 写完;`sprint_progress.md` 推 `complete`

## Current Focus

- **待人类 F-001 commit 指令**。F-001 实施 + baseline + notes.md + feature_list.json 全部完成,所有 5 baseline 命令 + db:check + db:migrate + sqlite3 .tables 验证通过,56/56 测试全绿。

## Next Step

1. 等待人类 F-001 commit 指令(per "DO NOT commit unless human asks")
2. 收到 commit 指令后:1 commit "feat(s2-f001): Drizzle schema + initial migration" 包含 11 个文件
3. commit 后启动 F-002(Card & Goal Space State Machines):`apps/web/src/lib/state-machine/card.ts` + `goal-space.ts` + `index.ts` + 3 个测试文件

## Risks & Notes (摘自 review/findings.md,精简版)

- **R-1 Drizzle partial unique index 限制**:F-001 用 `.where(sql\`...\`)` API 表达;`db:generate` 后人工校对 + 补;`db:check` 0 errors 是 done 硬门槛
- **R-2 better-sqlite3 同步 API 与 vitest jsdom 兼容性**:F-001 测试如遇兼容问题,`vitest.config.mts` 用 `environmentMatchGlobs` 把 schema-migrate.test.ts 切到 `node` 环境
- **R-3 ~ R-7**:S2 实施阶段持续关注,详见 `review/findings.md`

## Change Log

- `2026-06-07`: Sprint progress created. 4 件 request_analysis 工件就位,等待人类批准。
- `2026-06-07`: Human "批准" 触发 Phase 2 Review;`review/findings.md` written,recommendation: Proceed。
- `2026-06-07`: Human "开始实施" 触发 Phase 3.1;分支 `20260606-s2-domain-core` created from `20260606-dev-bootstrap` @ `eea017e`;Phase 3.2 F-001 启动。
- `2026-06-07`: **F-001 ✅ 完成**。`apps/web/db/schema.ts` 11 张表 + 12 enum + 22 types;`apps/web/db/migrations/0000_amazing_the_fury.sql` 生成;`package.json` +4 db:* scripts;`__tests__/schema*.test.ts` 30 个新 case;5 baseline + db:check + db:migrate + sqlite3 .tables 全部 0 errors;`implementation/notes.md` 写完;`feature_list.json` F-001 → `completed` × 3;56/56 测试全绿。等人类 F-001 commit 指令。
