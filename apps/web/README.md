# @keplar/web — Phase 1 S1 脚手架

KEPLAR Phase 1 S1(脚手架与基础设施)的 Next.js 15 应用。本目录在
[Phase 1 范围冻结](../docs/specs/phase1_scope.md)下只交付**开箱即跑的工程骨架**,
不实现任何领域逻辑、状态机、API、UI 业务组件;后续子项目 S2 领域核心、S3
API/SSE、S4 Dashboard UI 将在此基础上增量交付。

## 对应子项目

- 父变更:`20260606-s1-scaffold`(本仓库 `.harness/changes/20260606-s1-scaffold/`)
- 父分支:`20260606-dev-bootstrap`
- Phase 1 子项目:**S1 脚手架与基础设施**
- 上游真相源:[`DESIGN.md`](../../DESIGN.md)(UI 令牌)
- 下游约束:[`docs/specs/phase1_scope.md`](../../docs/specs/phase1_scope.md) 第 2/3 节

## 技术栈

| 维度      | 选型                                               | 版本          |
| --------- | -------------------------------------------------- | ------------- |
| 运行时    | Node.js                                            | ≥ 20          |
| 包管理    | pnpm(workspace)                                    | 11.x          |
| 框架      | Next.js(App Router)                                | 15.x          |
| 视图      | React                                              | 19.x          |
| 类型      | TypeScript(`strict: true`)                         | 5.6.x         |
| ORM(占位) | Drizzle + better-sqlite3                           | 0.36.x / 11.x |
| 样式      | Tailwind 4(CSS-first,`@theme` 桥接 DESIGN.md 令牌) | 4.x           |
| 测试      | Vitest + jsdom                                     | 2.1.x / 25.x  |
| Lint      | ESLint 9 flat config(待补)                         | 9.x           |
| Format    | Prettier 3(待补)                                   | 3.x           |
| CI        | GitHub Actions(`web-ci.yml`)                       | —             |

## 本地启动

```bash
# 在仓库根(已声明 pnpm-workspace.yaml)
pnpm install

# 进入本应用
cd apps/web

# 启动 dev server(http://localhost:3000)
pnpm dev

# 生产构建
pnpm build && pnpm start
```

## 验证

```bash
pnpm typecheck   # tsc --noEmit,严格模式
pnpm lint        # eslint(待 ESLint config 解锁后启用)
pnpm test        # vitest run,smoke + tokens 用例
pnpm build       # next build
```

## DESIGN.md 令牌桥接

`src/styles/tokens.css` 以 CSS 变量(自定义属性)形式映射 `DESIGN.md` 全部
颜色、间距、半径、字号、动效令牌。`src/app/globals.css` 通过 `@theme` 把
这些 CSS 变量桥接到 Tailwind 4 主题,使 `bg-bg` / `text-text-primary` /
`p-md` 等 utility 可用。**禁止在组件或页面中硬编码 hex 值或 px 数值**;
如需新增令牌,先在 `DESIGN.md` 表格添加,再映射到 `tokens.css`。

## 目录结构

```text
apps/web/
├── src/
│   ├── app/
│   │   ├── globals.css      # Tailwind 4 入口 + token 桥接
│   │   ├── layout.tsx       # 根布局,lang=zh-CN,data-theme=dark,字体注入
│   │   └── page.tsx         # S1 占位页
│   └── styles/
│       └── tokens.css       # DESIGN.md → CSS 变量(只读映射)
├── __tests__/
│   ├── smoke.test.ts        # 渲染环境与工作区别名 smoke
│   └── tokens.test.ts       # DESIGN.md 桥接覆盖
├── db/
│   ├── schema.ts            # S1 占位空 schema(S2 填充领域表)
│   └── migrations/          # drizzle-kit 输出目录
├── public/                  # 静态资源
├── drizzle.config.ts        # Drizzle Kit 配置
├── eslint.config.js         # (待补,见 implementation/notes.md)
├── next.config.ts           # Next.js 配置
├── next-env.d.ts            # Next.js 类型引用
├── package.json             # @keplar/web 工作区包
├── postcss.config.mjs       # Tailwind 4 PostCSS 入口
├── tsconfig.json            # TS strict + 路径别名(@/*, @db/*)
├── vitest.config.ts         # Vitest 配置
└── .gitignore               # Next.js/Node/Drizzle 忽略规则
```

## S2+ 后续子项目落地

- **S2 领域核心**:在 `db/schema.ts` 引入 `goalSpace` / `nodeBoard` / `card` / `audit` 等表;新增 `db/migrations/0001_*.sql` 迁移;补状态机单测与权限矩阵用例。
- **S3 API/SSE**:在 `src/app/api/` 引入 REST 路由;在 `src/app/api/events/` 引入 SSE handler;补 `__tests__/api.*.test.ts` 契约测试。
- **S4 Dashboard UI**:在 `src/app/(dashboard)/` 引入看板页;补 Storybook + 视觉回归。
