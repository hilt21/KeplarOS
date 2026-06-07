# Request Analysis Spec

Change ID: `20260606-s2-domain-core`
Status: request_analysis
Branch: not yet created (S1 提交 commit `eea017e` on `20260606-dev-bootstrap`,S2 分支在 Phase 2 Review 通过后、Phase 3 Implementation 前创建)
Parent change: `20260606-s1-scaffold` (已 commit `eea017e`,S2 继承其 `apps/web/` 脚手架与 `pnpm-lock.yaml`)
Phase 1 sub-project: **S2 领域核心**

## Request Summary

在 S1 脚手架之上交付 KEPLAR Phase 1 领域核心:11 张业务表的 Drizzle schema + 初始迁移、卡片与目标空间状态机、权限矩阵、审计事务包装器,以及覆盖这些纯逻辑的单元测试门禁。S2 不引入 API handler、不引入 SSE、不引入 UI 业务组件、不引入真实 AI executor — 这些属于 S3 / S4。S2 的产出可直接被 S3 复用(API 层调用 F-002/F-003/F-004 的纯函数),也可被 S4 复用(UI 层读 S2 schema 类型)。

## Assumptions

- S1 提交 `eea017e` 已落地,`apps/web/`(Next.js 15 + Drizzle + Vitest + ESLint 9 + Prettier 3 + Tailwind 4)、`pnpm-workspace.yaml`、`pnpm-lock.yaml`、CI workflow 全部就位且 5/5 验证命令零 warning 通过。
- Drizzle + better-sqlite3 已在 `apps/web/db/schema.ts`(占位空 schema)与 `drizzle.config.ts` 配好;S2 在此基础上扩展。
- 领域 schema 真相源是 `docs/specs/database_design.md` § 1 § 2 § 3 § 4(11 张表 + 字段 + 索引 + 关系 + 删除策略),状态机真相源是 `docs/architecture/state_transition.md` § 1 § 2 § 6,权限矩阵真相源是 `docs/specs/authorization_matrix.md` § 2 § 3 § 4 § 5。
- S2 的"领域核心"指 4 个 P0 feature(F-001 Schema / F-002 State Machine / F-003 Authorization / F-004 Audit Transaction),全部使用 `apps/web/src/lib/` 子目录;每个 feature 自带 Vitest 单元测试。
- S2 不引入新的顶层依赖;状态机、权限、审计事务均为纯函数 + Drizzle 事务 API,无需额外 npm 包。
- S2 沿用 S1 的 SQLite demo 路径;PostgreSQL 兼容性由 S2 schema 类型 + 命名约定保证(`text` 存 UUID / `text` + `JSON()` 函数访问 JSONB),实际 PG 验证不在 S2 范围。
- Drizzle 0.36 已知在 SQLite 下对部分 DDL(如 partial unique index)有 limitations,S2 接受在 `db/schema.ts` 中直接补 `sql\`...\`` 块覆盖 Drizzle 不能完整表达的索引/默认值,详见 F-001 Risks。
- 实施者环境(本 session)无 GUI,无 `act`,无网络;S2 与 S1 同样以 `pnpm` 五条命令(typecheck / lint / format:check / test / build)作为可行验证,`pnpm dev` 浏览器手测推迟。

## Scope

### In Scope

- **F-001 Drizzle Schema + Initial Migration**
  - `apps/web/db/schema.ts` 引入 11 张表(users / goal_spaces / node_boards / node_board_members / sessions / agent_executions / cards / state_transitions / human_confirmations / audit_entries / realtime_events)的 Drizzle SQLite 定义;UUID 主键用 `text` + `lower(hex(randomblob(16)))` 默认;JSONB 用 `text` 默认 `'{}'` 或 `'[]'`,应用层用 `JSON.parse/stringify`;`deleted_at` 软删除;`created_at` / `updated_at` 默认 `CURRENT_TIMESTAMP`。
  - 引入 Drizzle 不直接支持的部分:partial unique index(node_board_members 软删除唯一、cards display_id 软删除唯一、node_boards.key 软删除唯一、realtime_events 复合 sequence 唯一、human_confirmations pending 唯一),用 `sql\`CREATE UNIQUE INDEX ... WHERE ...\`` 块补。
  - 命名:TypeScript 字段驼峰,数据库列小写下划线,用 Drizzle 自动映射;类型从 schema 推导导出(`InferSelectModel` / `InferInsertModel`)。
  - 首个迁移:`pnpm --filter web db:generate` 生成 `apps/web/db/migrations/0001_*.sql`(或手写同效 SQL,Drizzle 生成的 SQL 与 `docs/specs/database_design.md` § 7.1 必须一致);`pnpm --filter web db:migrate` 在 `apps/web/db/dev.db` 上成功应用,11 张表 + 索引实际存在。
  - 新增脚本:`db:generate`、`db:migrate`、`db:studio`(可选,S2 不强制);`db:check` 调用 `drizzle-kit check` 验证 schema 与迁移一致。
  - enum 常量与 string literal type:`goalSpaceStatus` / `cardState` / `nodeBoardStatus` / `sessionStatus` / `agentExecutionStatus` / `transitionActor` / `confirmationStatus` / `confirmationTriggerType` / `userRole` / `entityType` 等 TS literal union,值与 `docs/specs/database_design.md` § 1 / `state_transition.md` § 1 / `authorization_matrix.md` § 2 完全一致。

- **F-002 Card & Goal Space State Machines**
  - `apps/web/src/lib/state-machine/` 实现纯函数,不依赖 Drizzle 实例(便于单元测试)。
  - **Card State Machine**:`backlog / todo / dev / review / done / blocked / cancelled` 7 状态;按 `state_transition.md` § 2 / § 4 转移表实现 `canTransition(from, to, trigger)` 与 `assertTransition(from, to, trigger)`;`isTerminalState(state)` 判定 `done / cancelled` 终态;`getRequiredActor(from, to)` 返回 `human | ai_role | system`(per § 4 表的"执行者"列);trigger 名与 § 6 `TransitionTrigger` 一致。
  - **Goal Space State Machine**:`draft / active / completed / cancelled` 4 状态;转移表:initiator 触发 `start`(draft→active)、`complete`(active→completed,要求无 pending blocker & 全部卡片 done/cancelled)、`cancel`(任意非终态→cancelled,需 `cancel_reason`);`assertGoalSpaceTransition(from, to, opts)` 校验终态与前置;opts 在 F-004 事务内由 wrapper 填 `hasPendingConfirmation / hasBlockedCard / allCardsDoneOrCancelled`。
  - 全部合法转移允许 + 非法转移拒绝 + 终态不可再转;`complete` 前置条件由纯函数返回缺哪条条件列表,不直接读写 DB;实际 DB 校验在 F-004 审计事务包装器中组合调用。

- **F-003 Authorization Matrix**
  - `apps/web/src/lib/authorization/` 实现 pure functions,输入 actor + 资源 + 资源归属,输出 boolean 或 throw。
  - actor 抽象:`Actor { id: string; role: 'initiator' | 'chain_user' | 'viewer' }`;S2 不引入真实用户登录,S3 注入 `Actor` from session。
  - 资源归属校验函数(per `authorization_matrix.md` § 3 + § 4):
    - `canReadGoalSpace(actor, goalSpace): boolean`
    - `canManageGoalSpace(actor, goalSpace): boolean`(仅 initiator == `goal_spaces.initiator_id`)
    - `canReadNodeBoard(actor, nodeBoard, members): boolean`(initiator 全可见;非 initiator 需为有效成员)
    - `canManageNodeBoard(actor, nodeBoard): boolean`(initiator only)
    - `canManageNodeBoardMembers(actor, nodeBoard): boolean`(initiator only,删除/添加成员)
    - `canReadCard(actor, card, members): boolean`(initiator 全可见;非 initiator 限可访问节点 / 分配给自己)
    - `canMutateCard(actor, card, members): boolean`(viewer 禁止;chain_user 限可访问节点 / 分配给自己;initiator 全允许)
    - `canDecideConfirmation(actor, goalSpace): boolean`(initiator only)
    - `canExecuteCard(actor, card, members, hasPendingConfirmation): boolean`(viewer 禁止;需卡片可访问 + 无 pending confirmation)
  - 跨 goal_space_id 访问必须返回 `false`;不抛错,仅返回 boolean + 可选 `reason`;S3 API handler 转译为 403。
  - 单元测试覆盖:每条 API 行(§ 4 表)+ initiator/chain_user/viewer × 每种资源 × allow/deny = 至少 30 个 case。

- **F-004 Audit Transaction Wrapper**
  - `apps/web/src/lib/audit/` 实现 `runWithAudit(db, ctx, fn)` 高阶函数;`db` 是 Drizzle 实例(better-sqlite3 driver),`ctx` 含 `entityType / entityId / actor / action / beforeState / afterState / details`,`fn` 在事务内执行业务变更,返回时由 wrapper 写 `audit_entries`(append-only)。
  - 业务变更 + `audit_entries` 写 + 可选 `realtime_events` 写必须**同事务**;`audit_entries` 写失败时事务回滚,主操作不生效;`realtime_events` 写失败同此。
  - 同一 `goal_space_id` 内 `realtime_events.sequence` 单调递增;wrapper 内部用事务内 `INSERT ... SELECT max(sequence)+1 FROM realtime_events WHERE goal_space_id = ?` 单 SQL 解决,避免长事务下 max 被覆盖。
  - 不导出 `updateAuditEntry` / `deleteAuditEntry` 函数,append-only 由 API 边界 enforce(代码 review 维度)。
  - 单元测试覆盖:同事务原子性(业务 + audit + realtime 全成功);业务成功 + audit 失败 → 业务回滚;realtime sequence 递增;append-only(无 update/delete 导出)。

### Out of Scope

- REST API handler、route、SSE endpoint(属于 S3)。
- 真实 AI executor(stub/fixture 也在 S3)。
- 看板 UI、Dashboard 页面、目标空间页(属于 S4)。
- Playwright E2E(属于 S4 或更后)。
- PostgreSQL Drizzle dialect 切换、Skeema / Atlas 迁移工具、Prod K8s 部署(Phase 1 显式排除)。
- 多租户 / SSO / 真实 OAuth(Phase 1 显式排除)。
- `node_boards.members` JSON 字段(规范显式禁止,仅 `node_board_members` 表)。
- 修改 `Cargo.toml` / `apps/desktop/` / `crates/*` / `DESIGN.md` / `docs/**` / `README.md` / `AGENTS.md` / `CLAUDE.md` / `LICENSE`。
- 引入 Husky / lint-staged / commitlint(后续按需评估)。
- 引入 better-sqlite3 之外的 driver(S2 仅 SQLite)。
- 任何前端 UI 改动(§ `DESIGN.md` 业务组件属于 S4);S2 仅产 Drizzle 类型 + 纯函数 + 测试。

## Affected Areas

- **API**: not_applicable(S3 才引入;F-002/F-003 的纯函数将由 S3 handler 调用)
- **Data model**: **in**(11 张表 + 索引 + enum literal types)
- **Authorization**: **in**(角色 × 资源 × action 矩阵;F-003)
- **UI/UX**: not_applicable(纯后端领域核心,无视觉改动)
- **Tests**: **in**(Vitest 单元测试覆盖 4 个 feature;`apps/web/__tests__/{schema,state-machine,authorization,audit}.*.test.ts`)
- **Docs**: minimal(`apps/web/README.md` 增补 "db:generate / db:migrate" 与 schema 表结构概览,不改 DESIGN.md 或 docs/specs)

## Acceptance Criteria (S2 整体)

- [ ] AC-1 `apps/web/db/schema.ts` 导出 11 张表的 Drizzle 表定义 + 全部 enum literal union + 推导的 `InferSelectModel` / `InferInsertModel` 类型;`pnpm --filter web typecheck` 0 errors。
- [ ] AC-2 `pnpm --filter web db:generate` 在 `apps/web/db/migrations/0001_*.sql` 生成 Drizzle 迁移;与 `docs/specs/database_design.md` § 7.1 字段与索引一致;`pnpm --filter web db:check` 0 errors。
- [ ] AC-3 `pnpm --filter web db:migrate` 在干净的 `apps/web/db/dev.db` 上成功应用 0001 迁移;迁移后 11 张表 + 全部 unique / partial unique / 普通索引存在;`sqlite3 apps/web/db/dev.db ".tables"` 列出全部表名。
- [ ] AC-4 enum 常量与 `docs/specs/database_design.md` § 1 / `state_transition.md` § 1 / `authorization_matrix.md` § 2 完全一致,无遗漏枚举值。
- [ ] AC-5 `apps/web/src/lib/state-machine/` 提供卡片 7 态与目标空间 4 态的 `canTransition` / `assertTransition` / `isTerminalState` / `getRequiredActor`;`pnpm --filter web test -- state-machine` 全绿;至少覆盖全部合法转移 + 全部非法转移 + Done/Cancelled 终态 + 角色分类 + `goal_space_complete` 前置条件缺哪条。
- [ ] AC-6 `apps/web/src/lib/authorization/` 提供 § Scope F-003 列出的 8 个 can 函数;`pnpm --filter web test -- authorization` 全绿;至少 30 个 case(initiator/chain_user/viewer × 资源 × allow/deny);跨 `goal_space_id` 访问一律 false。
- [ ] AC-7 `apps/web/src/lib/audit/runWithAudit` 在 better-sqlite3 上同事务写业务 + `audit_entries` + `realtime_events`;`pnpm --filter web test -- audit` 全绿;覆盖业务成功 + audit 失败 → 业务回滚;realtime sequence 单调递增;无 `updateAuditEntry` / `deleteAuditEntry` 导出。
- [ ] AC-8 5 条 baseline 命令(`pnpm --filter web typecheck` / `lint` / `format:check` / `test` / `build`)全部 0 errors 0 warnings;`pnpm --filter web test` 累计 26/26(S1 继承)+ S2 新增全部 it 全绿。
- [ ] AC-9 `.gitignore` 不需新增(数据库 dev.db 与 .drizzle 已在 S1 加入);`apps/web/db/dev.db*` 不被 commit。
- [ ] AC-10 本 change 的所有工件位于 `.harness/changes/20260606-s2-domain-core/` 与 `apps/web/src/lib/{state-machine,authorization,audit}/`、`apps/web/db/{schema.ts,migrations/,*.ts}`、`apps/web/__tests__/`、`apps/web/package.json`(仅 scripts 增补)之内;S1 脚手架其他文件与 S1 工件不被删除或重写。
- [ ] AC-11 `Cargo.toml`、`apps/desktop/`、`crates/*`、`docs/**`、`DESIGN.md`、`README.md`、`LICENSE`、`AGENTS.md`、`CLAUDE.md`、`.harness/**`(除本 change 与 S1 change 之外)、`.github/workflows/web-ci.yml` 不被本 change 修改。
- [ ] AC-12 单元测试覆盖率(`vitest --coverage` 若开启;S2 不强制 ≥ 80% 阈值,但 4 个 `__tests__/` 子目录下的测试需分别全绿)。

## Risks

- **R-1 — Drizzle 0.36 partial unique index 限制**
  - 影响:F-001 `node_board_members` 软删除部分唯一、cards `display_id` 软删除唯一等需要 `WHERE deleted_at IS NULL` 的 partial index;Drizzle 0.36 在 SQLite 下 `uniqueIndex` 不直接支持 `WHERE`。
  - 缓解:`apps/web/db/schema.ts` 末尾用 `export const partialIndexes = sql\`CREATE UNIQUE INDEX ... WHERE ...\`` 块;`0001_*.sql` 迁移由 `db:generate` 生成后人工补或直接手写;`db:check` 验证。

- **R-2 — better-sqlite3 同步 API 在 vitest jsdom 下的可用性**
  - 影响:F-004 `runWithAudit` 用 better-sqlite3 同步事务;vitest jsdom 环境是否能正确加载 native module,本 session 无 GUI 无法跑 `dev` 验证。
  - 缓解:`vitest.config.mts` 中若 jsdom 不兼容 better-sqlite3,改用 happy-dom 或 node 环境跑 `audit.test.ts`;`environmentMatchGlobs` 按文件路由。

- **R-3 — `realtime_events.sequence` 在并发下的序号分配**
  - 影响:better-sqlite3 同步 + Node 单线程,实际并发不发生;但 wrapper 必须 `max(sequence) + 1`,长事务下读到的 max 会被新事务覆盖。
  - 缓解:用事务内 `INSERT ... SELECT max(sequence)+1 FROM realtime_events WHERE goal_space_id = ?` 单 SQL 解决;F-004 单元测试覆盖连续 10 次插入 sequence 严格递增。

- **R-4 — `goal_space.complete` 前置条件需要 `cards` / `human_confirmations` 查询**
  - 影响:状态机纯函数不直查 DB,F-002 返回"缺哪条条件"列表;F-004 包装器在事务内直查并组合;组合边界是 S2 内 F-002 与 F-004 的契接口。
  - 缓解:`assertGoalSpaceTransition(from, to, opts)` 接受 `opts: { hasPendingConfirmation: boolean; hasBlockedCard: boolean; allCardsDoneOrCancelled: boolean }`,由 F-004 在事务内填,S2 内单测覆盖全部缺一条件场景。

- **R-5 — `pnpm dev` 浏览器手测无 GUI**
  - 影响:S2 没有 UI 改动,实际上无 `dev` 验证项;但 F-001 的 `db:migrate` 跑通后,需要在 dev server 启动时能 `import { db } from "@/db"` 初始化连接 — S2 不强制 dev server 自启,推迟到 S3 一起验。
  - 缓解:`apps/web/README.md` 标注"`pnpm db:migrate` 后 dev server 自动建表";S2 不强求 `pnpm dev` 跑通。

- **R-6 — `config-protection` hook 已解除,但 S2 不会触碰 ESLint/Prettier config**
  - 影响:无新增 linter/formatter config 文件;F-001 仅 `db/schema.ts` + `db/migrations/*.sql`;不需要再触发 hook。
  - 缓解:无动作。

- **R-7 — S2 范围被 4 个 feature 拆分,每个 feature 必须独立可交付**
  - 影响:F-002 / F-003 / F-004 引用 F-001 的 enum 类型,但 enum 是 TS literal union,不依赖 Drizzle 实例;F-002/003/004 单元测试可独立 mock。
  - 缓解:`__tests__/state-machine.test.ts` / `authorization.test.ts` / `audit.test.ts` 三组测试均不依赖 `db/schema.ts` 实际加载(better-sqlite3 实例在 `audit.test.ts` 用临时 in-memory db 创建);`schema.test.ts` 仅做 enum 一致性 + `drizzle-kit check`,不依赖其他 feature。

## Open Questions

- **Q-1: F-001 的迁移 SQL 走 `drizzle-kit generate` 还是手写?**
  - 默认:`db:generate` 生成后人工校对 + 补 partial index;`db:check` 验证。
  - 备选:直接手写 `0001_*.sql`,跳过 `db:generate`;优点:与 `docs/specs/database_design.md` § 7.1 100% 对齐,缺点:失去 Drizzle 推导的 schema 变更历史。
  - **倾向**:`db:generate` + 人工补,因为 S2 之后还有 schema 演进,history 有用。

- **Q-2: F-003 是否返回 `void` 还是 `{ allowed: boolean; reason?: string }`?**
  - 默认:返回 boolean(简单),可选 `assertAccess(...)` 抛错版本给 S3 handler 用。
  - 备选:统一返回 `Result<T, AccessError>`,需要类型库或手写 `Result`;S2 不引入依赖。
  - **倾向**:boolean + `assertAccess` 双 API,简单且 S3 易用。

- **Q-3: F-004 `runWithAudit` 是否暴露 `realtime_events` 写开关?**
  - 默认:`ctx.skipRealtime?: boolean` 默认 false;纯查询不需要写 realtime,允许跳过。
  - **倾向**:skipRealtime 默认 false,审计敏感路径(状态变更、确认决策)自动写。

- **Q-4: 4 个 feature 拆 4 个 commit 还是 1 个 commit?**
  - 默认:Phase 3 Implementation 一个 feature 一个 commit,每个 commit 包含该 feature 的 schema/code/test 全部,便于 review 与 revert。
  - 备选:1 个 commit 含全部,简单但 revert 粒度粗。
  - **倾向**:4 个 commit,F-001 → F-002 → F-003 → F-004 顺序,因 F-002/003/004 引用 F-001 类型。

- **Q-5: S2 是否新建分支?**
  - 默认:`git checkout -b 20260606-s2-domain-core 20260606-dev-bootstrap`,S2 完成后 PR 回 `20260606-dev-bootstrap`,与 S1 累积。
  - 备选:直接在 `20260606-dev-bootstrap` 上提交,S2 与 S1 累计提交。
  - **倾向**:新建 `20260606-s2-domain-core`,保留 S2 单独 review / revert 的能力。

## Approval Gate

Request Analysis **must stop here** until explicit human approval is given. Approval terms: "approved"、"执行"、"继续实现"或等价指令。未获批准前不得:

- 修改 `apps/web/db/schema.ts`(当前是 S1 占位 `export const schema = {}`)
- 创建 `apps/web/src/lib/state-machine/`
- 创建 `apps/web/src/lib/authorization/`
- 创建 `apps/web/src/lib/audit/`
- 写 `apps/web/db/migrations/0001_*.sql`
- 增补 `apps/web/package.json` 的 `db:*` 脚本
- 改 `apps/web/README.md` 的 schema 概览
- 创建新 Vitest 测试文件

新分支 `20260606-s2-domain-core` 在 Phase 2 Review 通过后、Phase 3 Implementation 第一个 feature 开始前创建。
