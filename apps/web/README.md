# @keplar/web — Phase 1 S1 脚手架

KEPLAR Phase 1 S1(脚手架与基础设施)的 Next.js 15 应用。本目录在
[Phase 1 范围冻结](../../docs/README.md#phase-1)下只交付**开箱即跑的工程骨架**,
不实现任何领域逻辑、状态机、API、UI 业务组件;后续子项目 S2 领域核心、S3
API/SSE、S4 Dashboard UI 将在此基础上增量交付。

## 对应子项目

- 父变更:`20260606-s1-scaffold`(本仓库 `.harness/changes/20260606-s1-scaffold/`)
- 父分支:`20260606-dev-bootstrap`
- Phase 1 子项目:**S1 脚手架与基础设施**
- 上游真相源:[`DESIGN.md`](../../DESIGN.md)(UI 令牌)
- 下游约束:[`docs/README.md` § Phase 1](../../docs/README.md#phase-1) 第 2/3 节

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
│   ├── schema.ts            # S2 F-001 领域核心 schema(11 张表)
│   ├── migrations/          # drizzle-kit 输出目录
│   └── dev.db               # 本地开发 SQLite(已 gitignore)
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

## Database

S2 F-001 起 `db/schema.ts` 提供 11 张 SQLite 表 + 12 个 enum literal union

- 22 个 `InferSelectModel` / `InferInsertModel` 类型。真相源:
  [`docs/specs/database_design.md`](../../docs/specs/database_design.md)。

### 11 张表概览

| 表                    | 作用                                                     | 关键索引(partial 用 `*_active` / `_pending` 标识)                                                                                                                            |
| --------------------- | -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `users`               | 平台用户(`initiator` / `chain_user` / `viewer`)          | `idx_users_email_unique`                                                                                                                                                     |
| `goal_spaces`         | 目标空间(`draft` / `active` / `completed` / `cancelled`) | `idx_goal_spaces_initiator`, `idx_goal_spaces_status`                                                                                                                        |
| `node_boards`         | 节点板(挂载在 goal_space 下)                             | `idx_node_boards_goal_space_key_active` _(partial, `WHERE deleted_at IS NULL`)_, `idx_node_boards_goal_space`                                                                |
| `node_board_members`  | 节点板成员(支持软移除)                                   | `idx_node_board_members_board_user_active` _(partial, `WHERE removed_at IS NULL`)_, `idx_node_board_members_user`                                                            |
| `sessions`            | 协作会话(用户与 goal_space 的中间层)                     | `idx_sessions_user`, `idx_sessions_goal_space`, `idx_sessions_status`                                                                                                        |
| `cards`               | 任务卡(7 态状态机)                                       | `idx_cards_goal_space_display_id_active` _(partial, `WHERE deleted_at IS NULL`)_, `idx_cards_goal_space`, `idx_cards_node_board`, `idx_cards_state`, `idx_cards_assigned_to` |
| `agent_executions`    | AI agent 执行轨迹                                        | `idx_agent_executions_card`, `idx_agent_executions_session`, `idx_agent_executions_status`                                                                                   |
| `state_transitions`   | 状态机迁移审计                                           | `idx_state_transitions_entity`, `idx_state_transitions_created_at`                                                                                                           |
| `human_confirmations` | 人类确认请求(高风险动作)                                 | `idx_human_confirmations_card_pending` _(partial, `WHERE status = 'pending'`)_, `idx_human_confirmations_status`, `idx_human_confirmations_expires_at`                       |
| `audit_entries`       | 不可变审计流(append-only,F-004 强制)                     | `idx_audit_entries_entity`, `idx_audit_entries_occurred_at`                                                                                                                  |
| `realtime_events`     | SSE 推送事件(含单调 sequence)                            | `idx_realtime_events_goal_space_sequence` _(full unique, 跨 goalSpace 互不干扰)_, `idx_realtime_events_published_at`                                                         |

### SQLite 适配要点

- **UUID 主键**:`text` + `DEFAULT (lower(hex(randomblob(16))))` —— 不依赖外部扩展
- **JSONB 字段**:`text` + `mode: "json"` + 默认 `'{}'` / `'[]'` —— 应用层 parse/stringify,Drizzle ORM 透明
- **时间戳**:`text` + `DEFAULT (datetime('now'))` —— ISO-8601 字符串,SSE 与审计可读
- **soft delete**:`deleted_at` 字段(`node_boards` / `cards`)+ partial unique 索引
- **append-only**:`audit_entries` 仅有 INSERT 路径,F-004 的 `runWithAudit` 在事务内强制

### 常用命令

```bash
# 1. 修改 schema.ts 后重新生成迁移
pnpm --filter web db:generate

# 2. 在干净 dev.db 上应用全部迁移
rm -f apps/web/db/dev.db
pnpm --filter web db:migrate

# 3. schema 内部一致性 + migration 一致性校验
pnpm --filter web db:check

# 4. (可选) Drizzle Studio 浏览器可视化
pnpm --filter web db:studio

# 5. 验证 11 张表存在
sqlite3 apps/web/db/dev.db ".tables"
```

## S2+ 后续子项目落地

- **S2 领域核心**:✅ F-001 schema + migration 已落地;F-002 状态机 + F-003 权限矩阵 + F-004 审计事务 wrapper 进行中。详见 `.harness/changes/20260606-s2-domain-core/`。
- **S3 API/SSE**:在 `src/app/api/` 引入 REST 路由;在 `src/app/api/events/` 引入 SSE handler;补 `__tests__/api.*.test.ts` 契约测试。
- **S4 Dashboard UI**:在 `src/app/(dashboard)/` 引入看板页;补 Storybook + 视觉回归。
