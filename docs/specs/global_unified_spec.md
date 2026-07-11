# 历史规格片段（不作为当前基线）

> **状态：已过时，2026-07-11 审查标记。** 本文件是无章节的历史摘录，且至少包含
> “未接入 Playwright”的过时表述；当前仓库已有 Playwright 配置和 E2E 套件。保留原文
> 以保存历史信息，但不得将其作为产品、测试或阶段范围的事实源。
>
> 当前产品范围请见 [`prd.md` §15](prd.md#15-当前版本产品基线2026-07-11-审查更新)，
> 架构和测试约束分别见 `../architecture/` 与本目录的专项规格；完整审查见
> [`../review/2026-07-11-product-implementation-consistency-audit.md`](../review/2026-07-11-product-implementation-consistency-audit.md)。

---

## 保留的历史摘录

- **编码规范：** 当前 `apps/web` 已提供 ESLint 与 Prettier 配置，Phase 1 前端 TypeScript/React 代码以此统一风格。Rust 代码使用 rustfmt 默认配置和 Clippy 分析。命名方式：TS 侧采用驼峰，数据库字段和 JSON 接口字段采用小写下划线映射（使用 Drizzle 可自动转换）。
- **日志与监控：** Phase 1 必须记录运行时关键事件（目标创建、会话开始/结束、AI 执行结果、人工确认、审计写入、SSE 投递失败），可先使用结构化应用日志。OpenTelemetry 调用链路和指标采集属于后续生产化能力，不作为首轮冻结门禁。
- **配置管理：** Phase 1 至少支持 `DATABASE_URL`、`KEPLAR_DB_DRIVER`、`KEPLAR_DB_PATH`、端口号等环境变量。当前 `docker-compose.yml` 仅提供 PostgreSQL 依赖服务，不代表 Web/API/worker 已具备容器化部署；生产级 Docker/Kubernetes 配置后续冻结。
- **CI/CD：** 当前仓库除 `.github/workflows/card-verify.yml` 外，已提供 `.github/workflows/web-ci.yml` 作为应用级测试门禁，在变更 `apps/web` 或 workspace 依赖时执行 `pnpm check`（typecheck、lint、Vitest、build、format:check）。E2E、性能测试和发布构建仍未纳入当前基线。
- **版本管理：** 前端代码遵循 semantic versioning（在 `package.json` 中标注版本，并在发布脚本中同步 npm 包版本）。Rust workspace 版本由根 `Cargo.toml` 统一管理，crate 发布策略在 CLI/API 稳定后再冻结。依赖管理应固定版本号并提交对应 lock 文件以保证可复现性。
- **依赖管理：** 当前 workspace 根 `package.json` 已定义统一脚本，`apps/web/package.json` 已引入 Next.js、React、Drizzle、better-sqlite3 及相应开发依赖。新增前端、数据库驱动、测试工具或本地扩展时仍需同步记录用途和安全审计策略。生产部署如果使用 SQLite，需安装对应 SQLite 驱动；Rust 依赖应锁定兼容版本。
- **测试规范：** 当前 `apps/web` 已集成 Vitest，并纳入 `pnpm check` 与 `web-ci` 基线；未发现 Playwright 配置、脚本或 E2E 目录，Playwright 目前仍未接入。Phase 1 测试基线以现有 Vitest/TS 领域测试、Drizzle 迁移测试、接口合同测试和 SSE 事件合同测试为先；Playwright E2E 在核心用户流程和服务入口稳定后再加入。
- **代码审查与贡献：** 按 [贡献指南] 进行。开源项目采用 MIT 协议。文档和注释以中文/英文混合方式撰写，国际化条目可根据实际用户群考虑扩展。
