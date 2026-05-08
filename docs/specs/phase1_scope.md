# KEPLAR Phase 1 Scope

## 1. 冻结结论

Phase 1 冻结为 **Web-first Board demo slice**。

冻结状态：**可以开始 Phase 1 开发**。冻结边界只覆盖本文第 2 节列出的本地 Web demo 能力；第 3 节能力不得作为首轮开发验收条件。

目标不是实现全部未来架构，而是交付一个可现场演示、可追踪、可人工治理的最小完整闭环：

```text
Natural goal
  -> YAML Story
  -> Goal Space
  -> Node Board
  -> Cards
  -> AI Lane Execution
  -> Human Confirmation Gate
  -> Audit Trail
  -> SSE Dashboard
```

## 2. Phase 1 必须包含

| 能力 | 说明 |
|------|------|
| Web runtime | Next.js / React 作为第一阶段唯一必交付运行时 |
| Domain core | TypeScript/Drizzle schema 是第一阶段领域、接口和数据库类型主来源 |
| Persistence | SQLite demo path 必须可运行；PostgreSQL schema 保持兼容设计 |
| Goal Space | 支持创建、启动、查看进度、完成或取消 |
| Node Board | 支持节点视图和成员访问边界 |
| Card | 支持 `backlog/todo/dev/review/done/blocked/cancelled` 状态流转 |
| AI lanes | 先通过稳定 executor contract 接入，允许 stub/fixture 驱动 demo |
| Human confirmation | pending confirmation 是强制门禁 |
| Audit trail | 所有状态变更、AI 输出、人工确认必须可追踪 |
| SSE | 用于 Dashboard 单向实时状态推送 |
| Tests | 至少覆盖状态机、权限矩阵、确认门禁、审计事务、schema 创建 |

## 3. Phase 1 不在范围内

| 暂不实现 | 原因 |
|----------|------|
| Tauri desktop runtime | 不是 Board demo 主路径；保留架构约束，后续对齐同一 contract |
| Rust Axum server | 双运行时会扩大首轮 blast radius；Phase 1 先完成 Web API |
| 真实 MCP/ACP/A2A 外部写集成 | 先用稳定 execution boundary 和 mock/fixture；真实写操作后续接入门禁 |
| 生产 Kubernetes / HPA 部署 | 当前目标是本地/演示可运行；生产拓扑保留为后续设计 |
| 多租户和企业 SSO | 权限矩阵先覆盖角色和资源归属；企业身份集成后续扩展 |
| 完整 E2E 性能压测 | 核心路径稳定后再加入；首轮先做领域和合同测试 |

## 4. 已满足的冻结条件

- Prompt contract 已覆盖 Backlog Refiner 和 Review Guard；详见 `docs/specs/ai_agent_contracts.md`。
- AI executor contract 已定义输入、输出、错误、retry、blocked 行为；详见 `docs/specs/ai_agent_contracts.md`。
- SSE 事件已定义 event id、重连补偿和多标签页策略；详见 `docs/specs/realtime_events.md`。
- Audit trail 已定义最小字段、append-only 约束和事务边界；详见 `docs/specs/database_design.md`。
- Phase 1 测试门禁已收敛为状态机、权限矩阵、确认门禁、审计事务、schema 创建、实时事件和 AI execution contract；详见 `docs/architecture/test_matrix.md`。
- 部署和非功能指标已拆分为 Phase 1 本地 demo 门禁与 Future/Production 目标；详见 `docs/architecture/deployment_topology.md` 和 `docs/specs/non_functional_requirements.md`。

## 5. Phase 1 开发入口顺序

1. 建立 Next.js / TypeScript / Drizzle / SQLite 基础工程。
2. 先实现领域 schema、状态机、权限矩阵、审计事务和测试门禁。
3. 再实现 REST API、SSE realtime events、stub/fixture AI executor。
4. 最后接 Dashboard UI 和端到端 demo 路径。
