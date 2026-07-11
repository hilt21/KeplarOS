# KEPLAR OS 产品与实现双向一致性审查

**审查日期：** 2026-07-11  
**实现快照：** `master` at `c717aed`；相对 `origin/master` 领先 64 个提交。  
**方法：** 将产品基线、后续决策、开发计划和实际实现分开取证。计划或测试名称不等同于实现；代码存在也不自动等同于仍有效的产品需求。

## 1. 仓库与材料识别

### 1.1 事实模型

- `docs/specs/` 和 `docs/architecture/` 是 2026-05-08 起建立的产品、领域与架构基线；它们不是同一时间同步维护的单一真相源。
- `docs/README.md` 保存了合并后的 Phase 1 范围及后续阶段摘要，是阶段范围的主要入口。
- `.harness/changes/` 是每项开发工作的过程证据。已交付材料可证明当时的实现和验证；未完成的材料只能证明计划或中断状态。
- `docs/superpowers/plans/` 是设计/实施计划，`docs/superpowers/decisions/` 是明确接受的技术决策。两者均不直接证明交付。
- `apps/web/` 是当前唯一活跃产品运行时：Next.js、TypeScript、Drizzle、SQLite、REST/SSE、Vitest 与 Playwright。`crates/` 和 `apps/desktop/` 目前是骨架/未来方向，而非等价运行时。
- `docs/CODEMAPS/` 自称“代码优先”的快速导航，应在实现能力判断上优先于较早的叙述文档，但仍需以源码复核。

### 1.2 工作区边界

- 本次未修改业务代码、测试、配置、迁移或 Git 历史。
- 发现既有未跟踪目录 `.playwright-mcp/`、`.superpowers/`；它们未被修改，也不作为权威产品证据。`.superpowers/brainstorm/` 中的原型仅作补充线索。
- 审查覆盖核心链路：认证 → Goal Space → Node Board → Card → Agent 执行/确认 → 审计与 SSE → Web 工作台；没有把未来桌面、真实外部系统或生产拓扑误报为已实现。

### 1.3 权威性与新鲜度判断

| 材料 | 审查用途 | 判断 |
| --- | --- | --- |
| `docs/specs/prd.md`、`docs/architecture/user_stories.md` | 原始产品意图 | 高价值基线，但包含尚未落地的目标态。 |
| `docs/README.md` Phase 1 与 `docs/architecture/system_architecture.md` | 交付范围与架构约束 | Phase 1/Web-first 边界仍有效；阶段状态需更新。 |
| `docs/specs/{interface_spec,database_design,ai_agent_contracts,authorization_matrix,realtime_events}.md` | 可验证契约 | 领域规则大多被实现；个别 endpoint/能力仍是目标态。 |
| `docs/superpowers/decisions/*.md` | 后续已接受决策 | ADR-001～003 已由当前授权、状态机、迁移体现。 |
| `.harness/changes/*` 与 Superpowers plans | 开发演进证据 | 必须按每项实际交付状态使用。 |
| `apps/web/**`、迁移、测试、Git | 当前实现 | 实现事实的最高优先级。 |
| `docs/specs/global_unified_spec.md` | 历史片段 | 仅 8 条无标题条目，且仍称未接入 Playwright；不能再作为当前基线。 |

## 2. 开发前产品基线分析

### 2.1 原始产品意图

KEPLAR 的目标不是一般任务看板，而是让企业团队围绕一个可治理的业务目标协作：**Goal Space** 承载目标、约束和验收；**Node Board** 承载节点视图和成员边界；**Card** 承载可流转任务；AI 泳道负责结构化加工；人负责关键确认；审计轨迹回答“发生了什么”。证据：`docs/specs/prd.md` §1–§9、`README.md` “Vision/How It Works”、`docs/architecture/system_architecture.md` §4。

核心用户是发起人、链路用户和 AI 协同角色；早期架构图另有治理视图。核心工作流定义为：自然语言目标 → YAML Story → Goal Space → Node Board → Cards → 六角色 AI 处理 → 人工确认/阻塞回流 → 审计与 SSE。证据：`docs/README.md` “Phase 1 最小完整闭环”、`docs/architecture/user_stories.md` US-001～013、`docs/specs/ai_agent_contracts.md` §3–§4。

### 2.2 原始范围与约束

- Phase 1 后来被冻结为 Web-first 本地演示：Next.js/React/TypeScript/Drizzle/SQLite/SSE，允许 stub/fixture 执行器，必须具备状态机、权限、确认门禁、审计和核心测试。证据：`docs/README.md` “Phase 1”。
- Tauri、Rust Axum、真实 MCP/ACP/A2A 外部写、生产 Kubernetes、企业 SSO/多租户被明确延后。证据：`docs/README.md`、`docs/architecture/deployment_topology.md` §1、`docs/specs/non_functional_requirements.md` §0。
- 架构原则是领域语义统一、Web-first、状态转换受角色与确认约束、业务写入与审计/实时事件原子关联。证据：`docs/architecture/system_architecture.md` §1–§6；`docs/CODEMAPS/architecture.md` “Key invariants”。

### 2.3 原始文档的模糊和冲突

1. `prd.md` 将外部系统集成列入“核心范围” (§5.1/§8.5)，但已冻结的 Phase 1 明确排除真实外部写。这应解释为长期产品能力，而非当前版本承诺。
2. US-001/US-002 假定创建 Goal Space 时自动生成并可编辑 YAML Story、启动会话时自动生成初始 Cards；接口与数据模型没有为该入口定义完成的持久化/编辑契约。
3. 架构文档以“统一领域模型 + 双运行时”叙述，但同时写明桌面/Rust 是 Future；应避免让读者误以为当前有两个等价实现。
4. “角色化工作视图”“治理视图”被表达为产品原则，但早期用户故事的验收标准未定义各角色在当前 Web 版本必须看到或能做什么。

## 3. 开发演进与当前实现分析

### 3.1 后续决策与计划

- 2026-06-10 ADR-001 将 Goal Space 的读取权限扩展到 Node Board 成员；ADR-002 以 `(from,to,trigger)` 三元组保证人工触发的审计归属；ADR-003 把默认用户角色改为 `chain_user`。现行源码和迁移均可找到对应实现：`lib/authorization/goal-space.ts`、`lib/state-machine/card.ts`、`db/migrations/0003_s3_schema_blockers.sql`。
- Phase 2 计划将本地 demo 演进成 Web Collaboration Beta：会话认证、REST、SSE、确认门禁、确定性 AI 执行和 Web UI；明确继续延期桌面、真实外部写、Kubernetes 和企业 SSO。证据：`docs/superpowers/plans/2026-06-19-phase2-web-collaboration-beta.md` §1。
- Phase 3 计划强调浏览器可用性、创建表单、browser-first E2E、实时可靠性、真实 SQLite 约束和交付文档。证据：`docs/superpowers/plans/2026-06-26-phase3-web-beta-hardening.md` §1、Feature Sequence。
- 2026-06-29 后的前端抛光计划引入持久三栏壳、主工作区、任务时间线、右侧 DetailPane、命令面板和 Agent 状态展示。其性质是工作台交互/呈现演进，不是新的领域对象或新的业务承诺。

### 3.2 哪些计划有交付证据

- **Phase 2 API 核心：已交付。** Harness 中 auth、Goal Space、Node Board、Card、confirmation、execution、SSE 变更的实现/测试/交付状态均为 Complete/Delivered；当前有 27 个 `/api/v1` Route Handlers、服务/仓储分层和对应 API 测试。
- **治理内核：已交付。** `apps/web/db/schema.ts` 具有 Goal Space、Node Board、Card、Session、Agent Execution、Human Confirmation、Audit、Realtime 等表；`run-with-audit.ts`、状态机、授权模块和单元/API/迁移测试形成证据链。
- **确定性 Agent 模拟：已交付。** `lib/execution/roles.ts` 注册六个角色；`fixture-executor.ts` 明确无外部 I/O，根据卡片状态和风险返回确定性结果或确认请求；`services/executions.ts` 持久化执行和事件。
- **Web 创建和基础协作表面：已交付。** `/login`、Goal Space 创建、Node Board 创建、Kanban、时间线、SSE 连接、确认队列和 E2E 文件存在；相应 Harness 条目大多记录为 Done/Delivered。
- **前端三栏工作台：已交付但部分数据未完成。** `components/app-shell.tsx`、`master-pane.tsx`、`detail-pane/**`、`timeline/**` 及 2026-07-02 至 07-11 提交证明结构已落地；不能据此推断所有面板都是完整业务操作面。

### 3.3 计划完成性与过程记录缺口

- `.harness/changes/20260624-f2-10-e2e-delivery/` 仍记为 Not Started，但随后 Git 提交 `751920d`、Playwright 配置及 E2E 测试显示至少部分 F2-10 已落地。该 Harness 条目不能再作为真实完成状态。
- `.harness/changes/20260626-phase3-browser-first-e2e/` 仍为 `implementation_in_progress`，而 `1e9d03f` 已声称以浏览器驱动 beta setup。结论应为“有实现证据，但缺少完整交付/验证闭环”，不是“Phase 3 完成”。
- 2026-07-09 DetailPane 接线的代码已经合入（`6bafe3a`），但其 Harness 目录仅有 request-analysis 文件。过程记录缺少实现、测试与交付证据。

### 3.4 当前真实产品能力

- 带签名 cookie 的登录、退出与当前用户 API；三种数据角色：`initiator`、`chain_user`、`viewer`。
- Goal Space 可创建、列出、读取、更新、启动、完成、取消；Node Board 可创建、维护成员；Card 可创建、读取、更新、分配、阻塞/解阻、按合法状态转换。
- Card 状态固定为 `backlog/todo/dev/review/done/blocked/cancelled`；执行、确认、审计和实时事件被服务层编排，并有 SQLite 迁移与测试。
- 六角色 fixture 执行可推进特定状态或生成确认门禁；高/关键风险、外部写标签等不会导致实际外部写。
- SSE 支持事件持久化、replay、游标/去重/断线处理；任务时间线和 Agent 状态面板可消费部分事件。
- 认证后的 Web 工作台提供 Goal Space/任务索引、Kanban、任务时间线、确认队列及创建入口。

### 3.5 已知的部分实现或无需求来源能力

- **自然语言→YAML Story→初始卡片：未实现。** `CreateGoalSpaceForm` 只提交 `name`、`description` 和空的约束/验收数组；`startGoalSpaceService` 的响应为 `cards_generated: 0`；源码中无 Story/YAML 生成服务或 route。它仍是原始产品承诺而非当前能力。
- **角色化“不同工作视图”：仅实现授权与单一工作台的部分呈现。** 角色用于服务层授权；没有发现独立的发起人、链路用户、治理视图或明确的当前版本 UI 验收。
- **人工确认 UI：部分实现。** 领域/API 的确认门禁较完整；当前页面会读取 pending confirmations，但 Task 页面/Goal Space 页面留有 `onSendTaskMessage` server action stub，且旧 `CardDetailDrawer` 的动作映射不是当前主路径的充分证据。
- **DetailPane：部分真实、部分占位。** 07-10 修复了 Agent SSE 桥和从 URL 推导的 Goal Space 名称；但 `app/(app)/layout.tsx` 仍传入空的 `nodeBoardsByGoalSpace`，Token 计量、运行时/API 字段仍是标记为 TODO 的常量，`AppShell` 明确将 `cardRuntime` 设为 `null`。
- **健康检查：规格有、实现未见。** `interface_spec.md` §9、NFR §5.3/授权矩阵列出 `/api/health*`，当前 `/api/v1` 路由中不存在对应 route。它应作为未来/未实现契约，不能宣称已交付。

## 4. 双向差异审查

### 4.1 原始基线 → 当前实现

#### D-01 自然语言规划入口未落地

- **差异：** 原始核心链路的第一步要求生成、预览、编辑 YAML Story 和初始 Cards；当前只允许手工创建空的 Goal Space，启动返回 `cards_generated: 0`。
- **证据：** `prd.md` §8.2、`user_stories.md` US-001/US-002、`ai_agent_contracts.md` §3.1；对照 `components/create-goal-space-form.tsx`、`lib/services/goal-spaces.ts`、`__tests__/api/goal-spaces.test.ts`。
- **影响：** 产品入口从“目标驱动 Agent 协作”退化为“人工先建容器”；AI 的关键价值主张不可被当前版本验证。
- **建议：** 需要人工决策：将该能力正式列为下一阶段 P0，并先冻结可编辑 Story/草稿 Card 的契约；或正式把当前版本定位为“手工建模的治理工作台”。
- **置信度：** 高。

#### D-02 外部集成被合理延后，但 PRD 未显式版本化

- **差异：** PRD 把外部系统集成置于核心范围；Phase 1/2/3 均明确 fixture-only、无真实外部写。
- **证据：** `prd.md` §5.1/§8.5；`docs/README.md` Phase 1/2；`fixture-executor.ts` 文件头与实现。
- **影响：** 若不标记版本范围，读者会误以为 MCP/ACP/A2A 已可用。
- **建议：** 正式纳入当前基线为“执行边界与确认模型已实现，外部执行器延期”。
- **置信度：** 高。

#### D-03 角色化体验没有达到原始描述

- **差异：** 原始设计承诺角色不同视图/入口；当前实现有角色授权和同一工作台，未证实专属视图或治理运营面板。
- **证据：** `prd.md` §4、§8.1；`system_architecture.md` §2；对照 `schema.ts` 的三角色、`authorization/**`、`components/app-shell.tsx`。
- **影响：** 当前角色模型更接近访问控制，而非完整角色化协作体验。
- **建议：** 补充实现或缩窄当前基线措辞为“角色化授权和资源可见性”；专属工作视图作为后续范围。
- **置信度：** 中高。

#### D-04 可视化治理已实现核心记录，交互闭环尚不完整

- **差异：** 审计、状态转换、SSE、时间线已落地，但部分卡片运行时/消息/节点上下文动作仍为 stub 或 placeholder。
- **证据：** `schema.ts`、`audit/run-with-audit.ts`、`realtime/**`、`components/timeline/**`；对照 `app-shell.tsx`、`(app)/layout.tsx`、两个页面的 `onSendTaskMessage` stub。
- **影响：** “透明治理”作为数据/事件能力可信，作为所有决策均可在 UI 完成的承诺不可信。
- **建议：** 保留已交付的审计/SSE基础；把 UI 运行时详情和可操作治理列为补充实现。
- **置信度：** 高。

### 4.2 当前实现 → 原始基线

#### D-05 Web Beta 的认证、SSE 可靠性和浏览器 E2E是合理演进

- **差异：** 初始产品文档未细化 cookie 会话、CSRF/Origin 约束、replay cursor、SSE 去重和浏览器 E2E。
- **证据：** Phase 2/3 plans；`middleware.ts`、`auth/**`、`realtime/{stream,replay,useSseStream}.ts`、`e2e/*.spec.ts`、迁移 `0011_auth_credentials.sql`。
- **影响：** 增加了可信协作所需的实现质量，并未改变核心产品对象或治理原则。
- **建议：** 保留，正式纳入架构/当前产品基线。
- **置信度：** 高。

#### D-06 持久三栏工作台是合理 UX 演进，但不是完整新产品范围

- **差异：** Master/Primary/Detail 三栏、命令面板、任务时间线和 Agent 状态是后续设计计划引入的交互结构。
- **证据：** `docs/superpowers/specs/2026-06-29-frontend-polish-design.md`、对应 plans、`components/{app-shell,master-pane,detail-pane,timeline}/**`。
- **影响：** 有利于“上下文可见”，但若把 placeholder 当真实指标/运行信息，会误导用户。
- **建议：** 保留壳与已接线数据；明确 token、Card runtime、真实 Node Board 右栏信息仍延期。
- **置信度：** 高。

#### D-07 Harness 状态不能单独代表当前交付状态

- **差异：** 部分已合入能力的 Harness 条目仍停在 request-analysis/in-progress，尤其 F2-10、P3 browser-first E2E、07-09 DetailPane。
- **证据：** 对应 `.harness/changes/*/sprint_progress.md` 与 2026-06-25、06-27、07-10 Git 提交。
- **影响：** 审计、交接和版本范围会出现虚假的“未完成”或缺失验证。
- **建议：** 不改写历史；为这些变更补最小交付/验证补录，或在阶段基线中标注“代码已合入、Harness 闭环缺失”。
- **置信度：** 高。

#### D-08 文档新鲜度已造成实质误导

- **差异：** `global_unified_spec.md` 称 Playwright 未接入，而当前有 `playwright.config.ts`、五个 E2E spec、`pnpm e2e`；`docs/README.md` 仍将 Phase 2 写为“进行中”，但其核心能力已有交付证据，Phase 3 又未形成完整收口。
- **证据：** `global_unified_spec.md` 第 7 条、`apps/web/playwright.config.ts`、`apps/web/e2e/**`、Harness 状态与 Git log。
- **影响：** 新开发者可能重复建设或错误判断发布成熟度。
- **建议：** 标记历史片段为非基线；把阶段描述改为能力状态而非笼统完成/进行中。
- **置信度：** 高。

## 5. 建议的当前产品基线

### 定位

当前版本应定位为：**面向企业团队的、Web-first 的受治理协作 Beta 工作台**。它让用户手工建立 Goal Space、Node Board 和 Cards，并用受权限、状态机、确认、审计与实时事件约束的确定性 Agent 演示协作流。

它不是当前版本就能把任意自然语言目标自动变成项目计划并真实操作外部系统的通用 AgentOS。

### 用户、问题与价值

- **核心用户：** 发起人、被授权的链路用户、只读查看者；六个 AI 角色是系统执行角色，不是独立登录用户。
- **核心问题：** 团队缺少可共享的目标上下文、可控的任务状态、可追溯的责任与确认记录。
- **核心价值：** 在同一个 Goal Space 中，将可见性、授权、状态约束、人工确认和审计/实时回放结合起来，降低跨角色协调和追责成本。

### 当前领域对象与工作流

核心对象为 Goal Space、Node Board、Node Board Member、Card、Agent Execution、Human Confirmation、Audit Entry、Realtime Event 和运行 Session。

当前可验证工作流是：登录 → 手工创建 Goal Space → 手工创建 Node Board/Card → 在合法状态下触发 fixture Agent 或人工转换 → 必要时生成/处理 confirmation → 持久化审计和 SSE 事件 → 在 Kanban/时间线中查看状态。

### 当前范围、后续范围与排除项

- **当前范围：** Web/SQLite 单机 Beta、三角色授权、Goal Space/Board/Card 生命周期、确认门禁、确定性六角色 fixture、审计与 SSE、浏览器创建路径和基础 E2E。
- **后续范围：** 可编辑的自然语言 Story 和初始卡片草稿、角色专属工作视图、完整卡片运行时/任务对话/治理动作、真实 token 计量、真实外部执行器、生产可观测性和部署。
- **明确排除：** 当前没有 Tauri/Rust 服务端等价实现、真实 MCP/ACP/A2A 写入、企业 SSO/多租户、生产 HA/Kubernetes，也不应把 fixture 输出当真实业务交付。

### 人与 Agent 的职责边界

- 人创建/补充业务上下文，拥有资源权限，并确认高风险、低置信、不可逆或外部写相关动作。
- Agent 在当前版本只按固定角色和确定性规则加工单张 Card；它不会调用网络、文件系统、Git、MCP、ACP、A2A 或第三方系统。
- 系统保证状态、确认、审计和事件的关联；不保证自动规划、真实执行质量或最终业务正确性。

### 架构原则与待决策项

- 保持 Web-first 单一运行时；未来桌面/Rust 必须复用契约，不能平行发明领域语义。
- 每次业务写入应继续维持业务记录、审计记录和实时事件的一致性；确认门禁优先于执行与完成。
- 仍需决定：当前 Beta 是先补“自然语言→Story→草稿卡片”还是先把现有手工工作台的治理 UI 闭环；角色化视图的最小可验收定义；何时以及以何种隔离方式接入真实外部执行。

## 6. 待人工决策

1. 选择当前版本主叙事：**手工建模的受治理协作工作台**，还是把 **自然语言→Story→草稿卡片** 恢复为下一阶段 P0。该选择决定产品入口与验收。
2. 定义发起人、链路用户、查看者在 Web Beta 的最小“角色化视图”差异；仅有授权是否足够。
3. 决定是否将 `docs/specs/prd.md` 维护为唯一产品基线，或为阶段范围建立单独的、可版本化的产品基线文档。
4. 决定 `/api/health*` 是当前 Beta 必须补齐的运行能力，还是只保留为 Future/Production 契约。
5. 决定如何补录 F2-10、P3 browser-first E2E 和 DetailPane 的 Harness 交付证据；不应伪造当时未运行的验证。
6. 决定 `.superpowers/brainstorm/` 的原型是否应纳入版本控制或从产品证据中排除。

## 7. 文档修订记录

- `docs/specs/prd.md`：新增“当前版本产品基线（2026-07-11 审查更新）”，明确已交付能力、延后能力和不可宣称的能力；原始愿景和需求未被删除。
- `docs/README.md`：将 Phase 2 的笼统“进行中”替换为按能力描述的当前状态，并链接本审查与 PRD 当前基线。
- `docs/architecture/system_architecture.md`：将 Web 运行时描述对齐到当前 Next.js route/service 实现，并明确 Rust crates 仍非等价运行时。
- `docs/specs/global_unified_spec.md`：标记为过时历史片段，禁止作为当前规范来源；保留原文以保存历史信息。

未修改业务代码、测试、配置、数据或已有 Harness 历史记录。
