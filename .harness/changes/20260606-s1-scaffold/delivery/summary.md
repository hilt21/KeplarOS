# Delivery Summary

Change ID: `20260606-s1-scaffold`
Status: delivery (in progress — awaiting P0 blocker lift)
Branch: `20260606-dev-bootstrap`
Delivered: 2026-06-06

## What Was Delivered

KEPLAR Phase 1 S1(脚手架与基础设施)的 Next.js 15 工程骨架,19/22 计划工件
就位于 `apps/web/` 加上仓库根、`.github/workflows/` 三个工程级位置。完整
工件清单见 `implementation/notes.md` §"Files Changed"。**未交付 3 个文件
(ESLint/Prettier 配置)**,原因见下"Open Blockers"。

### 关键交付物

- **包管理**: `pnpm-workspace.yaml`(根)声明 `apps/*`,`apps/web/package.json`
  固定 pnpm 11.5.1 与 Node ≥ 20。
- **应用骨架**: Next.js 15 + TS strict + React 19,`@/*` 与 `@db/*` 路径别名,
  `app/layout.tsx` 注入 `lang="zh-CN"` 与 `data-theme="dark"`。
- **设计系统桥接**: `src/styles/tokens.css` 把 `DESIGN.md` 全部令牌映射为
  CSS 变量,`src/app/globals.css` 用 Tailwind 4 `@theme` 桥接,使
  `bg-bg` / `text-text-primary` / `p-md` 等 utility 可用。
- **数据层占位**: `drizzle.config.ts` 指向 `db/schema.ts` + `db/migrations/`,
  `schema.ts` 当前为 `{} as const`(S2 引入领域表)。
- **测试骨架**: Vitest 2.1 + jsdom + `vite-tsconfig-paths`,`smoke.test.ts`
  验证工作区别名与 jsdom 全局,`tokens.test.ts` 用 `it.each` 覆盖
  DESIGN.md 必出颜色/间距令牌。
- **CI**: `.github/workflows/web-ci.yml` 五步(setup-pnpm → install →
  typecheck → lint → test → build),触发 push 到 `master` / `20260606-dev-bootstrap`
  + PR `apps/web/**`。
- **文档**: `apps/web/README.md` 子项目入口,含技术栈、启动/验证命令、
  目录结构、DESIGN.md 桥接说明。
- **忽略规则**: 根 `.gitignore` 增补 Node/Next/Drizzle 跨工程区条目;
  `apps/web/.gitignore` 增补子级条目。

## Deviations From Spec(已 review 批准)

完整 5 条 deviation 与 review 决议见 `implementation/notes.md` §"Deviations
From Plan"。摘要:

1. React `^19.0.0` 而非字面 "React 18" — Next.js 15 配对要求。
2. `pnpm-workspace.yaml` 与根 `.gitignore` 增补位于仓库根 — 工具链规范要求。
3. 不创建根 `package.json` — review NF-1 解读为"不修改",已严格遵守。
4. `pnpm` 锁定 11.5.1 而非 spec 字面 "9.x" — 本机与 CI 一致,免漂移。
5. 引入 `vite-tsconfig-paths ^5.1.0` — `vitest.config.ts` 解析 `@db/*` 需要。

## Open Blockers

### P0 — `config-protection` Hook 阻挡 ESLint/Prettier 配置

`ecc` 插件的 `scripts/hooks/config-protection.js` 硬编码阻挡以下文件
**创建或修改**:`.eslintrc*`、`eslint.config.*`、`.prettierrc*`、
`prettier.config.*`、`biome.json`、`.ruff.toml`、`ruff.toml`、
`.shellcheckrc`、`.stylelintrc*`、`.markdownlint*`。本 session 多次尝试
`apps/web/eslint.config.{js,mjs}` 与 `apps/web/.eslintrc.cjs` 均被拒绝,
导致 `pnpm lint` 与 `pnpm format` 脚本无对应配置文件。

**影响范围**: `apps/web/package.json` 中 `lint` / `format` 脚本存在但
无可执行配置;CI 中 `Lint` 步骤会失败;AC-5 无法在此 session 验证;
`feature_list.json` 中 F-001 `test_status: "blocked"`、`done_status:
"not_started"` 维持此状态。

**人工解锁路径**(任选其一):
1. `~/.claude/settings.json` 的 `hooks.PreToolUse` 临时禁用
   `pre:edit-write:config-protection` 模式
2. 启动 Claude Code 时设 `ECC_DISABLED_HOOKS=pre:edit-write:config-protection`
3. 临时把 hook 的 `PROTECTED_FILES` 集合通过 ECC 插件配置排除

**解锁后应立即执行**: 创建 `apps/web/eslint.config.js`(ESLint 9 flat,
含 `@next/eslint-plugin-next` + `eslint-plugin-react` + `eslint-config-next`)
与 `apps/web/.prettierrc.json`,跑 `pnpm lint` 与 `pnpm format` 验证,
然后回头把 `feature_list.json` F-001 三个状态字段推到
`implementation_status: "completed"` / `test_status: "passed"` /
`done_status: "completed"`。

### P1 — `pnpm install` 未跑

本 session 无网络/时间窗口,`pnpm-lock.yaml` 未生成。CI 中
`pnpm install --frozen-lockfile` 因此**当前会失败**(lockfile 缺失)。
下次会话首动作:仓库根 `pnpm install` → 提交 `pnpm-lock.yaml` →
再跑 typecheck/test/build。

## Verification Status

| Check | Required | Status | Notes |
|-------|----------|--------|-------|
| `pnpm install` | yes | not_run | 详见 P1 |
| `pnpm --filter web typecheck` | yes | not_run | 依赖 install |
| `pnpm --filter web lint` | yes | **blocked** | 详见 P0 |
| `pnpm --filter web test` | yes | not_run | 依赖 install |
| `pnpm --filter web build` | yes | not_run | 依赖 install |
| `pnpm --filter web dev` (浏览器) | yes | not_run | 无 GUI |
| `act -j web-ci` | recommended | unavailable | `act` 未确认安装 |
| `drizzle-kit check` | optional | not_run | S2 才有 schema |

## Acceptance Criteria Status

| AC | Title | Status | Notes |
|----|-------|--------|-------|
| AC-1 | pnpm install 成功 + lockfile 提交 | **open** | P1 跟进 |
| AC-2 | dev server 渲染 S1 占位页 + 暗色令牌生效 | **open** | P1 跟进 + 手测 |
| AC-3 | `pnpm build` 0 error | **open** | P1 跟进 |
| AC-4 | `pnpm typecheck` 通过 | **open** | P1 跟进 |
| AC-5 | `pnpm lint` 通过 | **blocked** | P0 hook |
| AC-6 | `pnpm test` smoke 通过 | **open** | P1 跟进 |
| AC-7 | 根 `package.json` 不存在;`apps/web/package.json` 含全套脚本 | **partial** | 根 `package.json` 已存在但本 change 未修改,按 review NF-1 解读通过 |
| AC-8 | `.github/workflows/web-ci.yml` 触发条件正确 | **delivered** | 已写入 |
| AC-9 | `apps/web/README.md` 含启动/构建/测试/lint/桥接说明 | **delivered** | 已写入 |
| AC-10 | `db/schema.ts` 占位空 + drizzle config 无 error | **partial** | 文件已写入;`drizzle-kit check` 依赖 install |
| AC-11 | `.gitignore` 增补 | **delivered** | 根 + 子级已写入 |
| AC-12 | 越界文件未被修改 | **delivered** | `git status` 验证 |
| AC-13 | 工件均位于 `.harness/changes/...` 与 `apps/web/` 内 | **partial** | 仓库根两个文件(pnpm-workspace.yaml、.gitignore 增补)由 review NF-7 批准 |

## Next Sub-Project: S2 领域核心

S1 收尾后,启动 S2(领域核心: `goalSpace` / `nodeBoard` / `card` / `audit`
表 + 状态机 + 权限矩阵)时建议按本目录结构新增
`.harness/changes/20260606-s2-domain-core/`,本 change 中的
`db/schema.ts` 占位与 `tokens.css` 桥接**直接继承**,无需重做基础设施。
S2 的 `request_analysis/spec.md` 应明确引用 S1 的 `apps/web/README.md` 与
`implementation/notes.md` 衔接点。

## File Inventory At Delivery

仓库根 `git status` 预期(以本 session 末态为准,未提交):

```
?? .harness/changes/20260606-s1-scaffold/
?? pnpm-workspace.yaml
?? apps/web/
?? .github/workflows/web-ci.yml
M  .gitignore
```

未提交(non-destructive);按 `coding-discipline.md` "DO NOT commit unless
the human explicitly asks for a commit",commit 决策权在用户。
