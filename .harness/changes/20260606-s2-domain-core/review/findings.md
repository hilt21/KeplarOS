# Review Findings

Change ID: `20260606-s2-domain-core`
Status: review
Reviewer: Application Owner(本会话)
Date: 2026-06-07

## Recommendation

**Proceed** — 4 件 request_analysis 工件范围明确、AC 可测、任务依赖链路清晰、风险已记录且有缓解方案。无 blocking findings;7 个非阻塞风险均有 owner 与缓解步骤;测试覆盖 4 个 feature 全链路;5 个 Open Questions 均有倾向答案,实施时按倾向走、不再回头。

## Reviewed Artifacts

- `request_analysis/spec.md`(172 行,4 features / 12 AC / 7 Risks / 5 Open Questions)
- `request_analysis/tasks.md`(171 行,30 implementation tasks / 15 test tasks / 8 sequencing steps)
- `request_analysis/feature_list.json`(234 行,4 features,全部 `not_started` × 3,verification matrix 完整)
- `sprint_progress.md`(103 行,Phase 1 全部 In Progress,后续 Not Started)

## Blocking Findings

- (无)

## Non-Blocking Risks(摘自 spec.md,带 reviewer 缓解)

- **R-1 — Drizzle 0.36 partial unique index 限制**(F-001)
  - 风险:`node_board_members (board, user) WHERE removed_at IS NULL` 等 5 条 partial unique index 需 `sql\`...\`` 块
  - 缓解:`db:generate` 后人工校对 + 补 partial index;或直接手写 `0001_*.sql`;`db:check` 0 errors 即视为 OK
  - Reviewer 加注:实施 F-001 时把 partial index 的 `db:check` 通过作为 done 的硬门槛,不要"差不多就过"
- **R-2 — better-sqlite3 同步 API 与 vitest jsdom 兼容性**(F-004)
  - 风险:jsdom 环境加载 native module 偶发失败
  - 缓解:`vitest.config.mts` 用 `environmentMatchGlobs: [{ glob: '__tests__/audit/**', environment: 'node' }]` 把 audit 测试切到 node 环境
  - Reviewer 加注:S1 已有 jsdom 通过的 smoke test,但 smoke 不读 native module;F-004 第一次跑 `pnpm test -- audit` 时如失败,优先切环境而不是改代码
- **R-3 — `realtime_events.sequence` 并发分配**(F-004)
  - 风险:长事务下 `max(sequence)+1` 被新事务覆盖
  - 缓解:单 SQL `INSERT INTO realtime_events (..., sequence) SELECT ..., COALESCE(max(sequence), 0) + 1 FROM realtime_events WHERE goal_space_id = ?`
  - Reviewer 加注:连续 10 次 sequence 严格递增的测试用例是硬验收点;SQLite 单线程 + better-sqlite3 同步,实际不会并发,但代码必须按并发写
- **R-4 — `goal_space.complete` 前置需要 DB 查询**(F-002 ↔ F-004 契接口)
  - 风险:状态机纯函数不直查 DB,但 `assertGoalSpaceTransition` 需要 `hasPendingConfirmation / hasBlockedCard / allCardsDoneOrCancelled` 三个 bool
  - 缓解:`opts: { hasPendingConfirmation, hasBlockedCard, allCardsDoneOrCancelled }` 由 F-004 在事务内 `select` 填充,F-002 仅做"缺哪条"判定
  - Reviewer 加注:F-002 单测需用 `assertGoalSpaceTransition(active, completed, { hasPendingConfirmation: true, hasBlockedCard: false, allCardsDoneOrCancelled: true })` 等 8 种组合(2^3),覆盖完整
- **R-5 — `pnpm dev` 浏览器手测无 GUI**
  - 风险:本 session 无法跑 dev server
  - 缓解:S2 不强求 dev server 自启,推迟到 S3 一起验;`README.md` 标注 `pnpm db:migrate` 后 dev server 可建表
  - Reviewer 加注:不要为了"验证 dev 跑通"扩大 S2 范围;S2 范围严格 = 4 个 feature
- **R-6 — `config-protection` hook 已解除**
  - 风险:S2 不触碰 ESLint/Prettier config,无新增触发
  - 缓解:无动作
  - Reviewer 加注:实施时如发现需要新增 linter 规则,先回 Phase 1 调整 scope,不要在 Phase 3 偷偷加
- **R-7 — 4 个 feature 拆 4 commit**
  - 风险:commit 粒度若不严,review 与 revert 困难
  - 缓解:严格 F-001 → F-002 → F-003 → F-004 顺序,每 feature 一个 commit,commit message 含 feature ID
  - Reviewer 加注:实施 F-001 时,把 `apps/web/db/schema.ts` + `db/migrations/0001_*.sql` + `apps/web/package.json`(仅 db:* 脚本)+ `__tests__/schema*.test.ts` + `README.md`(仅 Database 段)绑在一起 commit;不要把 F-001 的内容混到 F-002 commit 里

## Missing Tests

- **MT-1 — F-002 trigger 11 个 literal 全部覆盖**:`state_transition.md` § 6 列 11 个 trigger(`dependencies_ready` / `context_complete` / `execution_start` / `evidence_submitted` / `review_passed` / `review_failed` / `human_confirm` / `human_reject` / `human_confirm_timeout` / `blocked_resolved` / `task_cancelled`),tasks.md AC-2.5 已写"每个 trigger 至少一次合法转移"。Reviewer 加注:card.test.ts 加 1 个 `it.each` 参数化测试覆盖 11 trigger × 1 合法转移,确保不漏。
- **MT-2 — F-003 跨 goal_space_id false 全覆盖**:AC-3.11 已写,但 reviewer 加注:不能只测 1 个 case,需测 `goalSpaceA 的 actor` 访问 `goalSpaceB 的 resource` 全部资源类(goalSpace / nodeBoard / card / confirmation)共 4 个 false。
- **MT-3 — F-004 跨 goalSpace sequence 互不影响**:AC-4.5 已写;reviewer 加注:加 1 个 case 测 `goalSpaceA sequence 1..3,goalSpaceB sequence 1..5` 互不串扰,避免实现里 hardcode 单 sequence 序列。
- **MT-4 — F-001 partial unique index 实际生效**:AC-1.3 / T-002 已写"尝试插入重复行失败";reviewer 加注:必须真在临时 SQLite 跑迁移 + 实际 insert 重复行让 SQL 报错,不能只断言"索引存在"。
- **MT-5 — F-002 goal_space.cancel reason 必填**:`state_transition.md` § 1 写"cancelled 必填 cancel_reason";spec.md 没显式列 AC。Reviewer 加注:F-002 加 `assertGoalSpaceTransition(任意非终态, cancelled, { cancelReason?: string })` 校验 cancelReason 非空,补到 AC-2.x 或 T-005。

## Open Questions (5 个,reviewer 倾向确认)

- **Q-1: F-001 迁移走 `db:generate` 还是手写?** — **倾向 `db:generate` + 人工补 partial index**。实施时按此走,不再变更。
- **Q-2: F-003 返回 boolean 还是 Result?** — **倾向 boolean + `assertAccess` 抛错版本**。S3 handler 用 `assertAccess` 简单,无 type-level 复杂度。
- **Q-3: F-004 `runWithAudit` 是否暴露 `skipRealtime`?** — **倾向 `skipRealtime?: boolean` 默认 false**。纯查询可跳过,审计敏感路径自动写。
- **Q-4: 4 feature 拆 4 commit 还是 1 commit?** — **倾向 4 commit**(per R-7 缓解)。F-001 → F-002 → F-003 → F-004 顺序,因依赖类型链路。
- **Q-5: S2 是否新建分支?** — **倾向 `git checkout -b 20260606-s2-domain-core 20260606-dev-bootstrap`**,Phase 3.1 创建。S2 完成后 PR 回 `20260606-dev-bootstrap`。

## Reviewer 加注(scope 防漂移)

- 实施 F-001 时若发现 Drizzle 0.36 在 SQLite 下还有别的坑(如 `text` + JSON 函数查询语法、partial index 顺序),优先用 `sql\`...\`` 补,**不要**升级 Drizzle 0.36 → 0.37+(S2 范围外)
- 实施 F-002 时若发现 `state_transition.md` § 4 表有歧义(如某条转移的 actor 写"AI (Backlog Refiner)"但代码用 generic `ai_role`),按代码 `ai_role` 通用,docs 漂移留到 S2 交付时记到 `implementation/notes.md` 不主动改 `docs/`
- 实施 F-003 时**不要**为 S2 引入真实 session / login / cookie / JWT;`Actor` 由调用方(S3)注入,S2 范围内全是纯函数
- 实施 F-004 时**不要**为 audit 写单独的"realtime-only"或"audit-only" API;只导出 `runWithAudit`,append-only 由 import 检查 enforce
- **不要**在 S2 范围触碰 `apps/desktop/` / `crates/*` / `Cargo.toml` / `DESIGN.md` / `docs/**` / `README.md`(除 `apps/web/README.md` 的 Database 段) / `AGENTS.md` / `CLAUDE.md` / `LICENSE` / `.github/workflows/web-ci.yml`

## Sprint Progress Update

`sprint_progress.md` 更新为:
- Phase 1 Request Analysis:**Done**(4/4 工件就位 + 人类 "批准" 2026-06-07)
- Phase 2 Review:**Done**(本文件写入,recommendation: Proceed)
- Phase 3 Implementation:**Not Started**(待人类明确"开始实施"指令后,Phase 3.1 创建分支 + Phase 3.2 启动 F-001)
- Phase 4 / 5:Not Started
- New entry in Change Log:`2026-06-07`: Human "批准" 触发 Phase 2 Review;`review/findings.md` written,recommendation: Proceed。
- Blockers:无 technical blockers;待人类明确"开始实施"/"继续实现"指令进入 Phase 3.1
