# SYSTEM_MAP

## Scope

This document records the read-only exploration of the KEPLAR repository on 2026-05-30. No source files were modified during the exploration.

## Current State

KEPLAR is currently best understood as a documentation-first project with a thin implementation skeleton. The product, architecture, API, database, state, workflow, and test expectations are mostly captured under `docs/`. The source tree contains Rust workspace placeholders, Drizzle configuration, Docker Compose for Postgres, and README-level module intent.

## Planned Architecture

The architecture is described as "unified domain model + dual runtime":

| Layer | Planned Responsibilities | Evidence |
|---|---|---|
| Interaction | Next.js / React Web UI and Tauri Desktop UI for goal spaces, node boards, cards, sessions, and trace views | `docs/architecture/system_architecture.md`, `src/README.md`, `apps/desktop/README.md` |
| Application runtime | Web runtime through Next.js API routes and TypeScript `KeplarSystem`; desktop runtime through Tauri and Rust Axum server | `docs/architecture/system_architecture.md` |
| Domain core | Goal Space, Node Board, Card, Lane, Session, Review, Blocked, Audit Trail | `docs/architecture/system_architecture.md` |
| Infrastructure | SQLite/PostgreSQL, Drizzle ORM, REST, SSE, ACP/MCP/A2A, OpenTelemetry | `docs/architecture/system_architecture.md`, `docs/specs/non_functional_requirements.md` |
| External capability | Code repositories, CI/CD, knowledge bases, notification systems, governance systems | `docs/architecture/data_flow.md`, `docs/architecture/use_case.md` |

## Existing Repository Entry Points

| Area | Current Files | Current State |
|---|---|---|
| Node package | `package.json` | No scripts, dependencies, or devDependencies |
| Rust workspace | `Cargo.toml` | Workspace with five crates |
| Rust core | `crates/keplar-core/src/lib.rs` | Single-line placeholder comment |
| Rust server | `crates/keplar-server/src/main.rs` | Single-line placeholder comment, no Axum implementation |
| Rust CLI | `crates/keplar-cli/src/main.rs` | Single-line placeholder comment |
| Rust RPC | `crates/keplar-rpc/src/lib.rs` | Single-line placeholder comment |
| Rust scanner | `crates/keplar-scanner/src/lib.rs` | Single-line placeholder comment |
| Web source plan | `src/README.md` | Declares `src/app`, `src/client`, `src/core` responsibilities |
| Desktop plan | `apps/desktop/README.md` | Declares Tauri desktop application |
| Database config | `drizzle.config.ts`, `drizzle-sqlite.config.ts` | Points to `./src/core/**/*.schema.ts`, but no schema files were found |
| Local database service | `docker-compose.yml` | Defines only Postgres 16 |
| CI | `.github/workflows/card-verify.yml` | Validates changed YAML files only |

## Decisions Added After Review

- TypeScript/Drizzle schema is the first-phase canonical source for domain/API/database types.
- Rust runtime must align with the shared contract instead of defining separate business semantics.
- Node Board and Session are now documented as persisted entities.
- Card state vocabulary is normalized to `backlog/todo/dev/review/done/blocked/cancelled`.
- Human confirmation is a strict gate for high-risk, low-confidence, external write, deployment, and irreversible operations.
- Audit entries are append-only and must be written transactionally with state changes.

## API Surface From Specification

Base REST path: `/api/v1`

Authentication: HttpOnly Cookie Session Token

Main endpoint groups:

| Group | Planned Endpoints |
|---|---|
| Auth | `POST /api/v1/auth/login` |
| Goal spaces | `POST /api/v1/goal-spaces`, `GET /api/v1/goal-spaces`, `GET/PATCH /api/v1/goal-spaces/:id`, `POST /start`, `POST /complete` |
| Cards | `POST /api/v1/goal-spaces/:goalSpaceId/cards`, `GET /cards`, `GET/PATCH /api/v1/cards/:id`, `POST /assign`, `POST /block`, `POST /unblock` |
| State transitions | `GET /api/v1/cards/:id/transitions` |
| Human confirmations | `GET /api/v1/confirmations?status=pending`, `POST /api/v1/confirmations/:id/decide` |
| AI execution | `POST /api/v1/cards/:id/execute`, `GET /api/v1/execute/:taskId` |
| SSE | `GET /api/v1/sse?goal_space_id=xxx` |
| Health | `GET /api/health`, planned readiness/liveness in NFR |

## Deployment Surface

Actual deployment files are minimal:

- `docker-compose.yml` starts only a Postgres database.
- `docs/architecture/deployment_topology.md` now contains a first-pass topology; no deployable services are implemented yet.
- No Dockerfile was found.
- No Web/API/server/worker service is defined in Docker Compose.
- CI/CD guidance exists in `docs/specs/global_unified_spec.md`, but package scripts and application build workflows are not implemented.

## Key System Gaps

- The planned Web/Tauri/Axum/Drizzle/OpenTelemetry/ACP/MCP/A2A architecture is not implemented yet.
- The API contract is documented but has no route implementation.
- The database schema is documented but has no Drizzle schema or migration files.
- The test matrix is documented but has no test files or runnable Node scripts.
- `deployment_topology.md` and `er_diagram.md` were initially empty and have now been filled with first-pass target topology and ER diagrams.
- CI now has a card schema file and is scoped to `docs/cards/`, but there are no sample card YAML files yet.
