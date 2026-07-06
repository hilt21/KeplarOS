# 📍 KEPLAR Codemaps

> Token-lean orientation maps for AI agents and humans.
> For full prose architecture & specs, see [../README.md](../README.md).

---

## What's here

Five maps, each optimized for fast context loading (~550–850 tokens).
Each top-of-file has a freshness header (`Generated: YYYY-MM-DD`).

| Codemap | Read when you need… |
|---|---|
| [architecture.md](architecture.md) | The 5 layers, key invariants, write/read paths, what's deferred |
| [backend.md](backend.md) | The REST + SSE API surface, middleware chain, error codes |
| [frontend.md](frontend.md) | The page tree, component hierarchy, stores, theme |
| [data.md](data.md) | The 11 tables, 13 migrations, ER diagram, SQLite↔PG shims |
| [dependencies.md](dependencies.md) | What's installed, what's declared but unwired, CI commands |

## By role

| I am a… | Start with… |
|---|---|
| 🤖 **AI agent / Claude Code** | [architecture.md](architecture.md) → [data.md](data.md) for the schema you'll touch |
| 🏛️ **Architect** | [architecture.md](architecture.md) → [dependencies.md](dependencies.md) |
| 💻 **Frontend engineer** | [frontend.md](frontend.md) → [backend.md](backend.md) (API contract) |
| 🔧 **Backend engineer** | [backend.md](backend.md) → [data.md](data.md) |
| 🗄️ **DB / migration author** | [data.md](data.md) → [architecture.md](architecture.md) (3-write invariant) |
| 🧪 **QA / test** | [backend.md](backend.md) (error codes + test gates) → [frontend.md](frontend.md) |
| 🛠️ **DevOps / SRE** | [dependencies.md](dependencies.md) → [architecture.md](architecture.md) |
| 🆕 **New to KEPLAR** | [architecture.md](architecture.md) end-to-end, then branch by task |

## By task

| Task | Read first | Then |
|---|---|---|
| Add a REST endpoint | [backend.md](backend.md) routes table | [architecture.md](architecture.md) middleware chain |
| Add a state transition | [architecture.md](architecture.md) invariants | [data.md](data.md) `stateTransitions` table |
| Add a UI component | [frontend.md](frontend.md) component tree | `apps/web/src/styles/tokens.css` (DESIGN.md) |
| Add a database column | [data.md](data.md) + `apps/web/db/schema.ts` | [architecture.md](architecture.md) 3-write invariant |
| Add an SSE event type | [backend.md](backend.md) SSE row | [architecture.md](architecture.md) `realtime_events` lifecycle |
| Add a dep / CI step | [dependencies.md](dependencies.md) | `package.json` + `.github/workflows/` |

## Re-scan triggers

Codemaps go stale when:
- New domain entity, AI role, or SSE event type is added
- A migration lands (file > `0012_migration_safety_retro.sql`)
- A new app enters the workspace (e.g. `apps/desktop/` becomes active)
- Major upgrade: Tailwind 5 / Next.js 16 / React 20 / Drizzle 0.40+
- Real LLM / MCP integration replaces the fixture executor

To regenerate: run the `update-codemaps` skill. The analysis report is
written to `.reports/codemap-diff.txt` with the diff% vs the previous
baseline.

---

<sub>📅 Codemaps maintained alongside code. If a map contradicts the
code, the code wins — open an issue or rerun the scan.</sub>