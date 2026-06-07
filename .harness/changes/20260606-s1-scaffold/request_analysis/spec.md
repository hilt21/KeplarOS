# Request Analysis Spec

Change ID: `20260606-s1-scaffold`
Status: request_analysis
Branch: `20260606-dev-bootstrap`
Parent change: none (first change on the bootstrap branch)
Phase 1 sub-project: **S1 脚手架与基础设施**

## Request Summary

为 KEPLAR Phase 1 建立可运行的 Web demo 基础工程(S1 脚手架与基础设施),使后续 S2 领域核心、S3 API/实时层、S4 Dashboard UI 都能在统一工程骨架上增量交付,不再各自重新搭脚手架。S1 不引入任何领域逻辑、状态机、权限矩阵、API 路由或产品 UI;唯一目标是"开箱即跑、类型干净、CI 全绿",为后续子项目提供"打开工程 → 改代码 → 跑测试 → 提 PR"的标准路径。

## Assumptions

- 仓库主分支为 `master`,本 change 在 `20260606-dev-bootstrap` 分支上推进。
- pnpm 9 在本地与 CI 环境中可安装,工作区协议可被 Next.js 15 识别。
- 现有 `Cargo.toml`(Rust 工作区)、`apps/desktop/` 占位、`crates/*` 占位不被本 change 修改或删除。
- `docs/specs/phase1_scope.md` 第 5 节的"Phase 1 开发入口顺序"是子项目分解的唯一权威来源。
- `DESIGN.md` 的视觉令牌(颜色、字体、间距、动效)是 S4 之前唯一的 UI 真相源,S1 脚手架需打通"DESIGN.md 令牌 → CSS 变量"链路,但不实现任何业务组件。
- 不存在多租户、生产部署、外部系统集成需求;所有这些都属于 Phase 1 显式排除范围或后续子项目。
- 实施者将安装 pnpm 9、Node 20+、并能访问 GitHub Actions;若环境不可用,会记录 unavailable-check 风险而非伪造结果。

## Scope

### In Scope

- pnpm 9 工作区初始化,根目录新增 `pnpm-workspace.yaml`,声明 `apps/*` 为工作区成员(暂不纳入 `crates/*`,后者走 Cargo 自有工作区)。
- `apps/web/` 下创建 Next.js 15 应用,使用 App Router、TypeScript strict、React 19,目录结构遵循 Next.js 官方约定(`app/`, `public/`, `lib/`, `src/styles/` 等按需)。
- Drizzle ORM + `better-sqlite3` 接入,新增 `apps/web/drizzle.config.ts` 与 `apps/web/db/schema.ts`(占位空 schema,无领域表),Drizzle Kit 出迁移目录 `apps/web/db/migrations/`(空,仅初始化)。
- 引入并配置 Vitest,放置在 `apps/web/vitest.config.ts`,配 1 个 smoke 测试用例(验证 `app/layout.tsx` 渲染所需的最小 React 18+ 环境)。
- 引入并配置 ESLint 9(flat config)+ Prettier 3,ESLint 集成 Next.js 推荐规则集,Prettier 与 ESLint 不冲突(关闭冲突规则)。
- 引入并配置 Tailwind 4,通过 `@theme` 指令将 `DESIGN.md` 中的颜色/字号/间距/动效令牌桥接为 CSS 变量;`apps/web/src/styles/tokens.css` 引用 `DESIGN.md` 表格,`apps/web/src/app/globals.css` 引入 Tailwind 4 + tokens。
- 在 `apps/web/src/app/page.tsx` 渲染一个最小占位首页,显示 "KEPLAR Phase 1 S1 Ready" 文案,使用 DESIGN.md 暗色默认主题,字体加载按 DESIGN.md(Google Fonts CDN)。
- 在 `apps/web/src/app/layout.tsx` 设置 `lang="zh-CN"`(DESIGN.md 与 PRD 中文场景)、`<html data-theme="dark">`、字体注入。
- 新增 GitHub Actions 工作流 `.github/workflows/web-ci.yml`,在 `push` 到 `20260606-dev-bootstrap` 与 `master`、以及对 `apps/web/**` 触发的 PR 上跑:install、typecheck、lint、test、build。
- 根目录 `.gitignore` 增补 Node/Next.js/Drizzle 产物条目(`node_modules/`、`.next/`、`*.tsbuildinfo`、`apps/web/db/dev.db*`、`apps/web/.drizzle/` 等)。
- `apps/web/README.md` 记录 S1 子项目如何启动、构建、测试、Lint,以及与 DESIGN.md / phase1_scope.md 的对应关系。
- 根目录 `package.json` 不被本 change 创建(本 change 不引入 Node 根清单);如需要工作区根脚本(例如 `pnpm -r typecheck`),后续子项目按需再决定。

### Out of Scope

- 领域 schema:Goal Space、Node Board、Card、Audit、User 等任何业务表(属于 S2)。
- 状态机、权限矩阵、审计事务、领域服务(属于 S2)。
- REST API 路由、SSE realtime events、AI stub/fixture executor(属于 S3)。
- 看板 UI、目标空间页、端到端 demo 路径(属于 S4)。
- Tauri 桌面运行时不创建、不修改 `apps/desktop/` 已有占位。
- Rust Axum server、5 个 crate(keplar-core/server/cli/rpc/scanner)的源码不创建、不修改;`Cargo.toml` 工作区声明保持现状。
- 真实 MCP/ACP/A2A 外部写集成(Phase 1 显式排除)。
- 生产 K8s / HPA / 多租户 / SSO(Phase 1 显式排除)。
- 替换 `package.json` 当前空对象;S1 不引入根级 Node 清单(可在 S2 起按需引入)。
- 删除或重写 `DESIGN.md`、`docs/specs/*`、`docs/architecture/*`;本 change 只读取它们。
- 引入 Husky / lint-staged / commitlint 等提交门禁(后续子项目按需评估)。
- 引入 Storybook / Chromatic / 视觉回归(后续子项目按需评估)。

## Affected Areas

- API: not_applicable
- Data model: not_applicable(占位 Drizzle schema,无领域表)
- Authorization: not_applicable
- UI/UX: minimal(仅 S1 验收页,使用 DESIGN.md 暗色默认与字体加载;不实现业务组件)
- Tests: Vitest 1 smoke 用例;ESLint + Prettier 配置;TypeScript strict 启用
- Docs: 新增 `apps/web/README.md`;`DESIGN.md` 令牌被代码引用但不被修改

## Acceptance Criteria

- [ ] AC-1 `pnpm install` 在仓库根成功,生成 `pnpm-lock.yaml` 并被提交。
- [ ] AC-2 `pnpm --filter web dev` 启动 Next.js 15 dev server,浏览器访问根路径渲染 "KEPLAR Phase 1 S1 Ready" 页面,且页面在 `data-theme="dark"` 下正确显示 DESIGN.md 暗色令牌背景。
- [ ] AC-3 `pnpm --filter web build` 成功生成生产构建,无类型错误与警告升级为 error。
- [ ] AC-4 `pnpm --filter web typecheck`(`tsc --noEmit`)通过,`tsconfig.json` 启用 `strict: true`。
- [ ] AC-5 `pnpm --filter web lint`(ESLint 9 flat config)通过,无 error,warning 数记录在 `implementation/notes.md`。
- [ ] AC-6 `pnpm --filter web test` 跑 Vitest,smoke 用例通过;测试文件位于 `apps/web/__tests__/` 或 `apps/web/src/**/__tests__/`。
- [ ] AC-7 仓库根不存在 `package.json` 根清单(若实现需新增,需走 scope amendment);`apps/web/package.json` 含 `dev/build/start/test/typecheck/lint` 脚本。
- [ ] AC-8 `.github/workflows/web-ci.yml` 存在,在 PR 触发与 push 到 `master` 触发时跑通 install/typecheck/lint/test/build 五步,本地 dry-run(`act` 或同等)可验证。
- [ ] AC-9 `apps/web/README.md` 存在,包含"如何启动/构建/测试/Lint/桥接 DESIGN.md 令牌"的最小说明。
- [ ] AC-10 `apps/web/db/schema.ts` 存在但为空 schema(`export const schema = {}` 或等价的占位),Drizzle Kit 能在不创建领域表的情况下完成 `drizzle-kit check` 或 `migrate` 空跑。
- [ ] AC-11 `.gitignore` 增补 `node_modules/`、`.next/`、`*.tsbuildinfo`、`apps/web/db/dev.db*`、`apps/web/.drizzle/` 等条目。
- [ ] AC-12 现有 `Cargo.toml`、`apps/desktop/`、`crates/*`、`docs/specs/*`、`docs/architecture/*`、`DESIGN.md`、`README.md`、`LICENSE`、`AGENTS.md`、`CLAUDE.md`、`.harness/**` 在本 change 中**未被修改**(除 `sprint_progress.md`、`request_analysis/*` 等本 change 自有工件外)。
- [ ] AC-13 本 change 的所有工件均位于 `.harness/changes/20260606-s1-scaffold/` 与 `apps/web/` 之内,不污染其他目录。

## Risks

- Risk: Tailwind 4 与 Next.js 15 兼容性(CSS-first 配置与 PostCSS 集成方式有变化)。
  - Mitigation: 实施时按 Tailwind 4 官方 Next.js 指南(`@tailwindcss/postcss` 插件),若发现阻塞,在 `implementation/notes.md` 记录并升级为 P1 blocker。
- Risk: pnpm 9 + Next.js 15 + Turbopack 在 monorepo 下的工作区协议解析问题。
  - Mitigation: 锁定 Next.js 15 补丁版,验证 `pnpm --filter web dev` 启动;失败时回退到 `next dev` 非 Turbopack 模式并记录。
- Risk: ESLint 9 flat config 与 `eslint-config-next` 兼容性问题。
  - Mitigation: 使用 Next.js 15 官方 flat config 示例;若不兼容,降级 ESLint 到 Next.js 当前稳定支持版本(8.x)并在 notes 中说明。
- Risk: Drizzle Kit `migrate` 在空 schema 下报错。
  - Mitigation: 不执行 `drizzle-kit migrate` 作为验收步骤,改为 `drizzle-kit check` 或仅验证 config 解析。
- Risk: CI 中 pnpm 缓存与 lockfile 漂移导致安装失败。
  - Mitigation: 固定 pnpm 版本(`packageManager` 字段或 `.npmrc`),使用 `pnpm install --frozen-lockfile`。
- Risk: Google Fonts CDN 在 CI/沙盒环境不可达,影响 build 时字体注入。
  - Mitigation: 使用 Next.js `next/font/google` 自托管字体而非 link 标签,或允许构建时网络失败降级为系统字体并在 notes 中记录。

## Open Questions

- Question: S1 是否需要新增根级 `package.json` 统一工作区脚本(`pnpm -r typecheck`)?
  - 默认:不需要,根级 Node 清单在 S2 起按需引入;若 CI 需要统一入口,可用 `pnpm --filter web <script>` 多次调用。
- Question: pnpm `packageManager` 字段写入位置?
  - 默认:写入 `apps/web/package.json`,CI 通过 `corepack enable` 自动选择。
- Question: Tailwind 4 桥接的 CSS 变量文件路径?
  - 默认:`apps/web/src/styles/tokens.css`(只读形式映射 DESIGN.md 表),在 `globals.css` 中 `@import` 之后 `@import "tailwindcss"`。
- Question: 测试运行器选择 Vitest 而非 Node `--test` 的依据?
  - 默认:Vitest 与 Next.js/Vite 生态更顺,Jest 兼容层不再必要;`tsx` 转译 TypeScript 测试文件。

## Approval Gate

Request Analysis must stop here until explicit human approval is given. Approval terms: "approved"、"执行"、"继续实现"或等价指令。未获批准前不得修改 `apps/web/`、`.github/workflows/`、`.gitignore` 等项目源码/配置。
