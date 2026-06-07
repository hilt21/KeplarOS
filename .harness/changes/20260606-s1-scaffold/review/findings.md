# Review Findings

Change ID: `20260606-s1-scaffold`
Status: review
Reviewer: Application Owner (self-review per expert-reviewer SKILL)
Review date: 2026-06-06

## Recommendation

**Proceed** — 无 blocking findings,Implementation 阶段可立即开始;非阻塞风险与一处 AC 措辞解读已在下方记录,实施时按本文件执行。

## Reviewed Artifacts

- `request_analysis/spec.md`(108 行,自审通过)
- `request_analysis/tasks.md`(105 行,自审通过)
- `request_analysis/feature_list.json`(68 行,JSON 解析通过)
- `sprint_progress.md`(78 行,阶段状态合理)

对照的外部真相源:
- `.harness/agents/application-owner.md`(工作流权威)
- `.harness/rules/coding-discipline.md`(实现边界)
- `docs/specs/phase1_scope.md`(Phase 1 边界)
- `DESIGN.md`(UI 令牌真相源)
- `.harness/skills/coding-skill/SKILL.md`(实现技能)

## Blocking Findings

无。

## Non-Blocking Findings(措辞澄清与解读)

### NF-1 AC-7 措辞解读

- **原文**: "AC-7 仓库根不存在 `package.json` 根清单(若实现需新增,需走 scope amendment);`apps/web/package.json` 含 `dev/build/start/test/typecheck/lint` 脚本。"
- **情况**: 仓库根 `package.json` 已经存在(内容为 `{"name":"keplar","version":"0.1.0","private":true,"scripts":{},"dependencies":{},"devDependencies":{}}`);字面意义上"不存在"无法满足。
- **解读**: AC-7 的真实意图是"**不在根 `package.json` 中新增脚本/依赖**";根清单保持只读,所有工作区命令通过 `pnpm --filter web <script>` 或后续 S2 起的根级 `package.json` 扩展(scaffold 不在此范围)。
- **实施约束**: 不修改根 `package.json`;若后续 S2 需要根级脚本,需走 scope amendment 并回到 Phase 1/2。
- **风险**: 低;若 S2 需要根级脚本,延后处理。

### NF-2 Google Fonts 在 CI 中构建时网络可达性

- **情况**: `next/font/google` 在 build 时下载 `Instrument Sans` / `JetBrains Mono` 并自托管;若 GitHub Actions runner 网络受限,build 步骤会失败。
- **解读**: 风险已在 spec.md Risks 中记录;CI 工作流默认 GitHub-hosted runner,通常可访问 fonts.gstatic.com。
- **实施约束**: 实施时在 `.github/workflows/web-ci.yml` 中,如 build 失败且与字体相关,在 `implementation/notes.md` 记录并降级为 system-ui 字体或本地 woff2;不伪造"成功"。

### NF-3 Tailwind 4 / Next.js 15 / ESLint 9 flat config 兼容性

- **情况**: 三个上游均处于活跃迭代,Tailwind 4 的 CSS-first 配置、`@tailwindcss/postcss` 接入、Next.js 15 的 Turbopack 默认、ESLint 9 flat config 与 `eslint-config-next` 兼容性有版本耦合风险。
- **解读**: 风险已在 spec.md Risks 中记录;实施时按官方当前推荐固定到具体补丁版,在 `apps/web/package.json` 用 `packageManager` 与精确版本。
- **实施约束**: 若任一组合失败,记录实际现象,降级路径在 spec.md 中已写明(回退到非 Turbopack / ESLint 8.x / Tailwind 3.x,作为 P1 blocker 升级人工决策)。

### NF-4 `pnpm install` 首次会生成新文件

- **情况**: 首次 `pnpm install` 在仓库根会创建 `node_modules/`(被 .gitignore 忽略)、`pnpm-lock.yaml`(需被提交)、可能创建 `apps/web/node_modules/`。
- **解读**: spec.md AC-1 明确要求提交 `pnpm-lock.yaml`;这不属于污染其他目录,属于本 change 预期产物。
- **实施约束**: `git add pnpm-lock.yaml` 必须显式,不依赖 `git add .`。

### NF-5 `Cargo.toml` 锁定声明

- **情况**: 根 `Cargo.toml` 已经声明 5 个 Rust crate 为 workspace 成员;S1 不修改 Rust 端,但 `pnpm-workspace.yaml` 创建后,TypeScript 与 Rust 工作区是并行的两个 monorepo,易混淆。
- **解读**: 实施约束为:`pnpm-workspace.yaml` 仅声明 `apps/*`,不混入 `crates/*`;两者通过目录隔离。
- **实施约束**: 不触碰 `Cargo.toml`,不创建 `package.json` 根清单(见 NF-1)。

### NF-6 已有 change 目录共存

- **情况**: 仓库已存在 `.harness/changes/20260606-add-mit-license/`,其内只有 `sprint_progress.md`。
- **解读**: 不影响本 change;本 change 仅写入 `.harness/changes/20260606-s1-scaffold/` 内的工件。
- **实施约束**: 不删除、不修改其他 change 目录。

## Missing Tests

### MT-1 渲染层最小断言

- **Gap**: 当前 smoke 测试断言"React 18 渲染所需最小环境就绪",但未对 `app/layout.tsx` 的 `lang="zh-CN"` / `data-theme="dark"` 渲染输出做断言;AC-2 的"data-theme='dark' 下 DESIGN.md 暗色令牌生效"目前缺少自动化校验。
- **Suggested test**: 在 `apps/web/__tests__/smoke.test.ts` 中,使用 `@testing-library/react` 的 `render` 验证 `<html data-theme="dark" lang="zh-CN">` 的根元素属性被渲染;或保留为"手测"并在 `implementation/notes.md` 记录原因。
- **影响**: 低;视觉与字体加载本就需要浏览器/手测,自动化覆盖率有限。
- **建议**: S1 接受此 gap,作为 S4 引入视觉回归时的提升项。

### MT-2 暗色 token 在 build 产物中存在

- **Gap**: AC-6 提到"产物中 CSS 包含 DESIGN.md 令牌",但未提供 grep/快照断言。
- **Suggested test**: 在测试目录加入一个 Node 脚本或 Vitest 用例,build 之后 `grep` `.next/static/css/*.css` 是否包含 `--color-bg: #0B0F19` 等;不通过则 fail。
- **影响**: 中;这是 DESIGN.md 桥接正确性的关键验收。
- **建议**: 在 T-6 实施时补 1 个 Vitest 用例,断言 tokens.css 内容包含 DESIGN.md 中的关键颜色 hex。

## Open Questions(实施前可解)

- **OQ-1**: CI 中 `act` 工具是否可用?
  - 默认:不可用,记录为 unavailable,CI 通过 PR 实际推送验证。
- **OQ-2**: Tailwind 4 主题桥接使用 `@theme` 还是 `theme.extend`?
  - 默认:`@theme`(Tailwind 4 CSS-first 方式)。
- **OQ-3**: 测试运行器是否使用 happy-dom 替代 jsdom?
  - 默认:jsdom(Next.js 官方推荐),happy-dom 留待 S2 性能优化时再评估。

## Sprint Progress Update

- Phase 状态表:Request Analysis → Completed;Review → In Progress(本文件写入后即 Completed)。
- 当前 Blockers:无(待本 review 完成后清空)。
- Completed 追加:Review findings.md 写入。
- In Progress:无(本 review 通过后,Implementation 启动)。
- Pending:Implementation F-001、Testing、Delivery(按顺序)。
- Change Log 追加:`2026-06-06`: review/findings.md written, recommendation: Proceed。

## Approval State

- Request Analysis: Approved by human on 2026-06-06(指令 "执行")。
- Review: Proceed(本文件结论,无需二次人类批准即可进入 Implementation,符合 Application Owner Runtime 流程)。
- Implementation: 等待启动。
- Testing: 等待启动。
- Delivery: 等待启动。
