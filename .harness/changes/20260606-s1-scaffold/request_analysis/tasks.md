# Request Analysis Tasks

Change ID: `20260606-s1-scaffold`
Status: request_analysis

## Implementation Tasks

- [ ] T-1 pnpm 9 工作区初始化
  - Verify:
    - `pnpm-workspace.yaml` 存在,声明 `apps/*` 为成员
    - 仓库根执行 `pnpm install` 成功(不创建根 `package.json`,仅基于现有 `apps/web/package.json` 工作)
- [ ] T-2 `apps/web/` 创建 Next.js 15 应用
  - Verify:
    - `apps/web/package.json` 含 `name: "@keplar/web"`、`private: true`、`packageManager: "pnpm@9.x"`
    - `apps/web/tsconfig.json` 启用 `strict: true`,`target: "ES2022"`,`moduleResolution: "bundler"`
    - `apps/web/next.config.ts` 存在,`app/` 目录使用 App Router
    - `apps/web/src/app/layout.tsx` 设置 `lang="zh-CN"`、`<html data-theme="dark">`
    - `apps/web/src/app/page.tsx` 渲染 "KEPLAR Phase 1 S1 Ready"
- [ ] T-3 Drizzle ORM + better-sqlite3 接入(占位 schema)
  - Verify:
    - `apps/web/drizzle.config.ts` 指向 `apps/web/db/schema.ts` 与 `apps/web/db/migrations/`
    - `apps/web/db/schema.ts` 存在,导出空 `schema` 占位
    - `apps/web/db/migrations/` 目录存在,内含 `.gitkeep`
    - `pnpm --filter web drizzle-kit check` 通过(或仅 config 解析无 error)
- [ ] T-4 Vitest smoke 测试
  - Verify:
    - `apps/web/vitest.config.ts` 存在,使用 `vite-tsconfig-paths` 与 `jsdom` 环境
    - `apps/web/__tests__/smoke.test.ts` 存在,断言 React 18 渲染所需最小环境就绪
    - `pnpm --filter web test` 通过
- [ ] T-5 ESLint 9(flat config)+ Prettier 3
  - Verify:
    - `apps/web/eslint.config.mjs` 存在,集成 `eslint-config-next` 与 `eslint-config-prettier`
    - `apps/web/.prettierrc.json` 存在,关闭与 ESLint 冲突的格式规则
    - `pnpm --filter web lint` 通过,无 error
- [ ] T-6 Tailwind 4 + DESIGN.md 令牌桥接
  - Verify:
    - `apps/web/postcss.config.mjs` 引入 `@tailwindcss/postcss`
    - `apps/web/src/styles/tokens.css` 存在,`:root` 中以 CSS 自定义属性形式声明 `--color-bg`、`--color-surface`、`--color-primary`、`--space-md` 等(对照 DESIGN.md 颜色/间距表)
    - `apps/web/src/app/globals.css` 顶部 `@import "../styles/tokens.css";` 后 `@import "tailwindcss";` 并通过 `@theme` 把 CSS 变量映射到 Tailwind 主题
    - `pnpm --filter web build` 产物中 CSS 包含 DESIGN.md 令牌
- [ ] T-7 Next.js 字体注入
  - Verify:
    - `apps/web/src/app/layout.tsx` 使用 `next/font/google` 加载 `Instrument Sans` 与 `JetBrains Mono`
    - 构建产物中字体资源以 woff2 形式存在,无 CDN 外部 link 标签
- [ ] T-8 GitHub Actions CI
  - Verify:
    - `.github/workflows/web-ci.yml` 存在,触发条件覆盖 push 到 `master` 与 `20260606-dev-bootstrap`,以及 `apps/web/**` 触发的 PR
    - 工作流步骤顺序:checkout、setup-node(20)、corepack enable/pnpm 9、cache、install(`--frozen-lockfile`)、typecheck、lint、test、build
    - `act -j web-ci` 或等效本地校验通过
- [ ] T-9 `.gitignore` 增补
  - Verify:
    - 追加 `node_modules/`、`.next/`、`*.tsbuildinfo`、`apps/web/db/dev.db*`、`apps/web/.drizzle/`、`coverage/`、`*.log`
    - 现有 `Cargo.toml` / `.harness/` / `docs/` 等条目不被改动
- [ ] T-10 `apps/web/README.md`
  - Verify:
    - 含"开发"`build`/`test`/`lint`/`typecheck` 命令样例
    - 含"DESIGN.md 令牌如何通过 tokens.css 桥接"的简短说明
    - 含"phase1_scope.md 对应章节(S1 脚手架与基础设施)"的引用

## Test Tasks

- [ ] TT-1 Vitest smoke 测试
  - Verify: `pnpm --filter web test` 至少 1 个用例通过
- [ ] TT-2 TypeScript strict 通过
  - Verify: `pnpm --filter web typecheck` 0 错误
- [ ] TT-3 ESLint 9 通过
  - Verify: `pnpm --filter web lint` 0 错误,记录 warning 数
- [ ] TT-4 Next.js build 通过
  - Verify: `pnpm --filter web build` 0 错误,产物包含 CSS 变量
- [ ] TT-5 仓库 init.sh 兼容
  - Verify: `.harness/skills/init.sh` 在仓库根能跑出 "Node check/typecheck/lint/test/build" 五步全过(或明确 unavailable 项)

## Documentation Tasks

- [ ] DT-1 `apps/web/README.md` 编写
  - Verify: README 含 启动/构建/测试/Lint/桥接说明
- [ ] DT-2 `.harness/changes/20260606-s1-scaffold/implementation/notes.md` 编写
  - Verify: 含变更文件清单、AC 验收结果、未决风险、降级路径

## Sequencing

1. T-1 pnpm 工作区 → Verify: pnpm install 成功
2. T-2 Next.js 应用 → Verify: dev server 启动 + 占位页可访问
3. T-6 Tailwind 4 + DESIGN.md 令牌 → Verify: 暗色背景与字体生效
4. T-7 字体注入 → Verify: 字体资源 build 产物存在
5. T-5 ESLint + Prettier → Verify: lint 通过
6. T-4 Vitest → Verify: smoke 测试通过
7. T-3 Drizzle 占位 → Verify: drizzle-kit check 通过
8. T-9 `.gitignore` → Verify: 增补条目存在
9. T-8 GitHub Actions → Verify: 工作流语法校验
10. T-10 `apps/web/README.md` → Verify: 文档完整
11. TT-1..TT-5 端到端验证 → Verify: init.sh 五步全过
12. DT-1/DT-2 收尾 → Verify: 工件齐全

## Dependencies

- T-3 依赖 T-1(pnpm 工作区建立后才能定位 `apps/web/db/`)
- T-4 依赖 T-2(Next.js 应用创建后才有 React 渲染环境)
- T-5 可与 T-6/T-7 并行,但都在 T-2 之后
- T-8 依赖 T-1..T-7 全部完成
- T-9、T-10 与 T-2 之后任意点并行

## Stop Condition

Stop after writing request analysis artifacts and wait for human approval. 实施阶段须按 Application Owner Runtime Phase 3 走完"启动→逐 feature 实现→逐 feature 验证→逐 feature 完成",不得跨阶段或合并 feature。
