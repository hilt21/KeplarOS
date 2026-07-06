<!-- Generated: 2026-07-06 | Files scanned: 95 | Token estimate: ~850 -->

# KEPLAR — Architecture Codemap

## What it is

Goal-driven multi-agent task platform. Natural-language goal → YAML Story → GoalSpace →
NodeBoard → Cards → 6-role AI pipeline → Human Confirmation gates → Audit trail + SSE.

Philosophy: **AI自主推进 + 人工治理兜底**. Phase 1 = Web-first local demo.

## Layers (5)

```
┌─ Interaction ─── Next.js 15 / React 19 ─── (app), login, dashboard, board views
│   3 role views: initiator / chain_user / viewer
├─ App Runtime ─── Next.js API routes (REST + SSE) ─── src/app/api/v1/**
│   Future: Rust Axum (shared api-contract)
├─ Domain Core ─── src/lib/{services,state-machine,authorization,audit}
│   Pure: state-machine guards + runWithAudit + authz asserts
├─ Infra ───────── SQLite + Drizzle (better-sqlite3) ─── apps/web/db/**
│   agent_executions contract; stub/fixture executor OK in Phase 1
└─ External ────── SSE realtime + LLM execution boundary
    Future: MCP / ACP / A2A / CI-CD / sandbox
```

## Service boundaries

| Boundary | Files |
|---|---|
| **HTTP entry** | `apps/web/src/app/api/v1/**/route.ts` (27 routes) |
| **Middleware** | `apps/web/src/middleware.ts` (auth cookie → session) |
| **Domain services** | `apps/web/src/lib/services/{cards,goal-spaces,node-boards,confirmations,executions}.ts` |
| **Repositories** | `apps/web/src/lib/db/repositories/{cards,goal-spaces,...}.ts` |
| **State machines** | `apps/web/src/lib/state-machine/{card,goal-space}.ts` |
| **Authorization** | `apps/web/src/lib/authorization/{cards,goal-spaces,...}.ts` |
| **Audit** | `apps/web/src/lib/audit/run-with-audit.ts` (F-004 transactional helper) |
| **AI executor** | `apps/web/src/lib/execution/{roles,fixture-executor}.ts` |
| **SSE client** | `apps/web/src/lib/realtime/{stream,replay,events,useSseStream}.ts` |

## Request lifecycle (write path)

```
HTTP POST /api/v1/cards/:id/execute
  └─ route.ts (parse + auth cookie → actor)
       └─ lib/authorization/execute.ts (assert card access)
            └─ lib/state-machine/card.ts (validate transition)
                 └─ lib/services/cards.ts (orchestrate)
                      └─ lib/db/repositories/cards.ts (Drizzle)
                      └─ lib/audit/run-with-audit.ts
                           ├─ BEGIN TX
                           ├─ cards UPDATE
                           ├─ state_transitions INSERT
                           ├─ audit_entries INSERT
                           ├─ realtime_events INSERT (sequence++)
                           └─ COMMIT
                       └─ lib/execution/roles.ts → fixture-executor
                            └─ agent_executions INSERT (task_id, attempt=1)
```

## Request lifecycle (SSE read path)

```
GET /api/v1/sse?goal_space_id=...
  └─ stream.ts
       ├─ authz check (readable GS)
       ├─ getLastEventId (Last-Event-ID header)
       ├─ stream events where sequence > lastSeen, ASC
       │    (falls back to replay API on cursor expired)
       └─ heartbeat comment frame every 15s
```

## Key invariants (DO NOT BREAK)

1. **Three-write atomicity** — business + `audit_entries` + `realtime_events`
   in one transaction (enforced via `runWithAudit`).
2. **`task_id` = `agent_executions.id`** — retries reuse row, increment `attempt`.
3. **Confirmation gate** — `execute/unblock/complete/external_write` blocked
   while a pending `human_confirmations` row exists.
4. **`display_id` ≠ UUID** — pre-persistence AI output uses `display_id` only.
5. **`risk_level` and `priority` are first-class enum/int columns**, not tags.

## Phase state

| Phase | Status |
|---|---|
| Phase 1 — Web-first Board Demo | ✅ complete |
| Phase 2 — Web Collaboration Beta | 🚧 in progress (active dev) |
| Phase 3 — Desktop / mobile / SaaS | 🔮 TBD |

Deferred across all phases: Tauri desktop shell, Rust Axum server, real MCP/ACP/A2A
external writes, production K8s, enterprise SSO.

## Where to look

| I want to… | Look at |
|---|---|
| Add a REST endpoint | `apps/web/src/app/api/v1/**/route.ts` + a service in `lib/services/` |
| Add a state transition | `lib/state-machine/card.ts` + tests in `__tests__/state-machine/` |
| Add a Card permission rule | `lib/authorization/card.ts` + tests in `__tests__/authorization/` |
| Add an audit-emitting op | wrap in `lib/audit/run-with-audit.ts` |
| Add an SSE event type | `lib/realtime/events.ts` + emit in same TX |
| Add an AI role | `lib/execution/roles.ts` + schema in `docs/specs/ai_agent_contracts.md` |