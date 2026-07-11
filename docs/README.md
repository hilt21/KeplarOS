# 📖 KEPLAR 文档

> 欢迎来到本项目的文档中心！

---

## 📖 概述

本文档目录是 KEPLAR 项目的设计资产事实源，按主题划分为三个类别：

| 类别 | 子路径 | 内容 |
|------|--------|------|
| 🏗️ 架构设计 | [`architecture/`](architecture/) | 系统结构、状态机、数据流、用例、用户故事、部署拓扑、测试矩阵 |
| 📐 规范契约 | [`specs/`](specs/) | PRD、非功能需求、权限矩阵、AI Agent 契约、数据库设计、接口规范 |
| 📍 Codemaps | [`CODEMAPS/`](CODEMAPS/) | AI/工程师快速上手的 token-lean 架构、API、数据、依赖地图 |
| 📋 开发计划 | 本 README | [Phase 1～5 产品开发计划](#phase-1-5-development-plan) 与维护说明 |

> **提示**：项目根目录的 [README.md](../README.md) 包含快速开始和项目简介。
> **新提示**：AI Agent 与新工程师建议从 [📍 Codemaps](CODEMAPS/README.md) 进入，再按需深入本目录的规范与架构文档。

---

## 📚 文档目录

按主题分组，点击进入。所有路径均为相对路径。

### 🏗️ 架构（Architecture）

| 文档                                                          | 说明                                |
| ------------------------------------------------------------- | ----------------------------------- |
| [系统架构](architecture/system_architecture.md)               | 整体分层、模块、依赖                |
| [状态流转](architecture/state_transition.md)                   | Card 7 态状态机                     |
| [Goal Space 状态](architecture/goal_space_state.md)            | Goal Space 生命周期                  |
| [Human Confirm 状态](architecture/human_confirm_state.md)      | 人工确认流程                          |
| [数据流](architecture/data_flow.md)                            | 组件间数据移动                        |
| [Swimlane 流程](architecture/swimlane_flow.md)                 | 业务流程泳道图                       |
| [用例图](architecture/use_case.md)                            | 角色与用例关系                       |
| [用户故事](architecture/user_stories.md)                       | 人机角色故事                         |
| [AI 交互流](architecture/interaction_flows.md)                 | AI 角色交互推导                      |
| [ER 图](architecture/er_diagram.md)                            | 实体关系图                            |
| [部署拓扑](architecture/deployment_topology.md)                | 服务器/集群/网络部署结构              |
| [测试矩阵](architecture/test_matrix.md)                        | 覆盖矩阵、场景、验收标准              |

### 📐 规范（Specification）

| 文档                                                | 说明                                       |
| --------------------------------------------------- | ------------------------------------------ |
| [PRD](specs/prd.md)                                 | 产品需求文档                                |
| [全局统一规范](specs/global_unified_spec.md)         | 全局统一术语与约定                          |
| [非功能性需求](specs/non_functional_requirements.md) | 性能、可扩展、安全、可观测                   |
| [权限矩阵](specs/authorization_matrix.md)           | 角色、归属、确认门禁、审计要求               |
| [AI Agent 契约](specs/ai_agent_contracts.md)         | 执行器契约、角色输出、retry、blocked 路由   |
| [实时事件](specs/realtime_events.md)                 | SSE 事件信封、回放游标、重连、多标签页       |
| [数据库设计](specs/database_design.md)               | 表结构、迁移                                |
| [接口规范](specs/interface_spec.md)                  | REST API 端点、SSE 事件、错误码             |

---

## 🔍 如何使用本文档

### 按角色

> 💡 **首次进入项目？** 先看 [📍 Codemaps → 按角色](CODEMAPS/README.md#by-role) 决定从哪张图起步，再按需深入本目录。

| 我是                       | 我先看这些                                                                                                |
| -------------------------- | --------------------------------------------------------------------------------------------------------- |
| 🧑‍💼 **业务 / 产品**         | [PRD](specs/prd.md) → [用户故事](architecture/user_stories.md) → [用例图](architecture/use_case.md)        |
| 🏛️ **架构师**              | [系统架构](architecture/system_architecture.md) → [数据流](architecture/data_flow.md) → [部署拓扑](architecture/deployment_topology.md) |
| 💻 **前端 / 后端工程师**    | [状态流转](architecture/state_transition.md) → [接口规范](specs/interface_spec.md) → [测试矩阵](architecture/test_matrix.md) |
| 🤖 **AI / Agent 工程师**    | [📍 Codemaps](CODEMAPS/README.md) → [AI Agent 契约](specs/ai_agent_contracts.md) → [权限矩阵](specs/authorization_matrix.md) |
| 🧪 **QA / 测试**           | [测试矩阵](architecture/test_matrix.md) → [接口规范](specs/interface_spec.md)                              |
| 🛠️ **运维 / SRE**          | [部署拓扑](architecture/deployment_topology.md) → [非功能性需求](specs/non_functional_requirements.md)    |

### 按场景

- **🆕 第一次进项目** → 先读 [📍 Codemaps](CODEMAPS/README.md)（按角色表），再按需要回到本目录深入
- **🆕 接手 Phase 2** → 直接读 [📋 Phase 1～5 开发计划](#phase-1-development-plan) 中的 Phase 2 节
- **🔨 新增功能** → 先查 [测试矩阵](architecture/test_matrix.md) 决定门禁，再看 [状态流转](architecture/state_transition.md) 确认合法迁移
- **🗄️ 修改数据库** → 必读 [数据库设计](specs/database_design.md) 与 [状态流转](architecture/state_transition.md)
- **🤝 加权限约束** → 必读 [权限矩阵](specs/authorization_matrix.md)
- **📡 加 SSE 事件** → 必读 [实时事件](specs/realtime_events.md)

---

## 📌 其他资源

仓库根级的项目级文档，不在本文档目录里：

| 文档                              | 说明                                  |
| --------------------------------- | ------------------------------------- |
| [项目 README](../README.md)     | 项目门面与快速入口                     |
| [DESIGN.md](../DESIGN.md)       | UI 令牌与视觉系统（前端必读）          |
| [AGENTS.md](../AGENTS.md)       | 智能体协作规范                          |
| [CLAUDE.md](../CLAUDE.md)       | Claude/Agent 行为准则（仓库私有）       |

应用级入口：

- [@keplar/web](../apps/web/README.md) — Next.js Web 应用开发手册

---

## 📋 Phase 1～5 开发计划

> **完整保留** Phase 1 的范围细节（已合并自原 `docs/specs/phase1_scope.md`），
> Phase 2 简要状态，Phase 3～5 暂留待规划。

<a id="phase-1"></a>

### ✅ Phase 1 — Web-first Board Demo Slice（已完成）

> Phase 1 冻结为 **Web-first Board demo slice**：本地 Next.js / TypeScript / Drizzle /
> SQLite 完整闭环，可现场演示、可追踪、可人工治理。

**最小完整闭环**：

```text
Natural goal
  → YAML Story
  → Goal Space
  → Node Board
  → Cards
  → AI Lane Execution
  → Human Confirmation Gate
  → Audit Trail
  → SSE Dashboard
```

#### 1. 冻结结论

Phase 1 冻结为 **Web-first Board demo slice**。

完成状态：**Phase 1 已完成**。完成边界覆盖 §2 列出的本地 Web demo 能力；§3 能力
仍不得作为 Phase 2 Web Collaboration Beta 的验收条件。

#### 2. 必须包含 {#phase-1-included}

| 能力 | 说明 |
|------|------|
| Web runtime | Next.js / React 作为第一阶段唯一必交付运行时 |
| Domain core | TypeScript/Drizzle schema 是领域、接口、数据库类型主来源 |
| Persistence | SQLite demo path 必须可运行；PostgreSQL schema 保持兼容 |
| Goal Space | 支持创建、启动、查看进度、完成或取消 |
| Node Board | 支持节点视图和成员访问边界 |
| Card | `backlog/todo/dev/review/done/blocked/cancelled` 状态流转 |
| AI lanes | 通过稳定 executor contract 接入，允许 stub/fixture 驱动 demo |
| Human confirmation | pending confirmation 是强制门禁 |
| Audit trail | 所有状态变更、AI 输出、人工确认必须可追踪 |
| SSE | Dashboard 单向实时状态推送 |
| Tests | 覆盖状态机、权限矩阵、确认门禁、审计事务、schema 创建 |

#### 3. 不在范围内 {#phase-1-excluded}

| 暂不实现 | 原因 |
|----------|------|
| Tauri desktop runtime | 不是 Board demo 主路径；保留架构约束，后续对齐 contract |
| Rust Axum server | 双运行时会扩大首轮 blast radius |
| 真实 MCP/ACP/A2A 外部写集成 | 先用稳定 execution boundary 和 mock/fixture |
| 生产 Kubernetes / HPA 部署 | 当前目标本地/演示可运行 |
| 多租户 / 企业 SSO | 权限矩阵先覆盖角色和资源归属 |
| 完整 E2E 性能压测 | 核心路径稳定后再加入 |

#### 4. 已满足的冻结条件

- ✅ Prompt contract 覆盖 Backlog Refiner 与 Review Guard — `docs/specs/ai_agent_contracts.md`
- ✅ AI executor contract 定义输入、输出、错误、retry、blocked — `docs/specs/ai_agent_contracts.md`
- ✅ SSE 事件定义 event id、重连补偿、多标签页策略 — `docs/specs/realtime_events.md`
- ✅ Audit trail 定义最小字段、append-only、事务边界 — `docs/specs/database_design.md`
- ✅ Phase 1 测试门禁已收敛 — `docs/architecture/test_matrix.md`
- ✅ 部署 / 非功能指标已拆分 Phase 1 门禁与 Future/Production 目标 — `docs/architecture/deployment_topology.md` + `docs/specs/non_functional_requirements.md`

#### 5. 开发入口顺序（已完成）

1. Next.js / TypeScript / Drizzle / SQLite 基础工程。
2. 领域 schema、状态机、权限矩阵、审计事务与测试门禁。
3. REST API、SSE realtime events、stub/fixture AI executor。
4. Dashboard UI 与端到端 demo 路径。

#### 6. Phase 1 Completion {#phase-1-completion}

Phase 1 is complete. The completed baseline is a local Web-first Board demo with
Next.js, TypeScript, Drizzle, SQLite, domain schema, state machines, authorization
helpers, audit transaction helpers, realtime event persistence, and executable
verification scripts.

---

### 🚧 Phase 2 — Web Collaboration Beta（核心能力已交付，阶段收口待补）

> Phase 2 从已完成的 Web-first 基线出发，把 demo 升级为可协作 Beta。

当前代码已具备认证 API、Goal Space/Node Board/Card 生命周期、确认门禁、
确定性 fixture AI 执行、审计/SSE 和 Web 工作流。该状态不表示自然语言
Story 生成、真实外部执行或生产化能力已完成；Phase 3 的部分 UI/E2E 工作
也有代码证据但 Harness 交付记录尚未全部闭环。

**关键方向**：

- 🔐 Authenticated APIs（真实会话）
- 🎯 确定性 AI lane 执行
- 📡 持续 SSE 实时推送
- 🖥️ Dashboard UI 工作流与端到端验证

**继续延期**（承袭 §3）：Tauri · Rust Axum · 生产 K8s · 企业 SSO · 真实 MCP/ACP/A2A 外部写集成

> 📋 Phase 2 详细计划留档在 `.harness/changes/20260619-phase2-*`。当前可验证的
> 产品范围见 [`specs/prd.md` §15](specs/prd.md#15-当前版本产品基线2026-07-11-审查更新)，
> 差异与待补交付记录见
> [`review/2026-07-11-product-implementation-consistency-audit.md`](review/2026-07-11-product-implementation-consistency-audit.md)。

---

### 🚧 Phase 3 — Web Beta Hardening（部分已实现，未完成阶段收口）

已留档范围包括登录、Goal Space/Node Board 创建、browser-first E2E、实时可靠性和
SQLite 约束验证，详见 `docs/superpowers/plans/2026-06-26-phase3-web-beta-hardening.md`。
当前不得把该计划整体视为已完成：其部分 Harness 条目仍处于 in-progress 或缺少 delivery
记录。桌面/移动 native shell、外部 AI 集成和企业 SaaS 化仍是后续候选方向。

### 🔮 Phase 4 — 待规划

长期方向。详见过程文档 `docs/superpowers/plans/`。

### 🔮 Phase 5 — 待规划

长期方向。详见过程文档 `docs/superpowers/plans/`。

---

## 🛠️ 维护说明

### 新增文档

1. 在 `docs/architecture/`、`docs/specs/` 下创建 `.md` 文件
2. 顶部用 `# 标题`，文件名遵循 `snake_case.md`，正文可用中文
3. 在本 README 对应分类下添加相对路径链接

### 修改现有文档

- **不要重构未变动的相邻内容**（CLAUDE.md "Surgical Changes"）
- **跨文档引用必须用相对路径**（如 `specs/interface_spec.md`），不要用绝对 URL
- **不要回溯改写历史快照**（`.harness/changes/`、`docs/review/`、`docs/superpowers/plans/`）

### 文档集分区

| 路径                       | 角色                                        |
| -------------------------- | ------------------------------------------- |
| `docs/`                    | 跨项目设计资产（架构、规范、计划）           |
| `docs/CODEMAPS/`           | AI Agent / 工程师快速上手的 token-lean 地图  |
| `apps/<app>/README.md`     | 单个应用的使用与开发手册                     |
| 仓库根 `README.md`         | 项目门面与快速入口                            |

### 链接约定

- 同目录内：`<file>.md`
- 上级：`../<file>.md`
- 多级上级：每上一级加一段 `../`，如 `../<file>.md`（一级）、`../../<file>.md`（两级）

---

<sub>📅 持续维护。修改前请参考 CLAUDE.md 的设计原则与变更前置流程。</sub>
