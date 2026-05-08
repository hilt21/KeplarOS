# MODULE_OWNERSHIP

## Current Ownership Map

| Module / Path | Intended Ownership | Current Evidence | Implementation State |
|---|---|---|---|
| `src/app` | Next.js pages and API routes | `src/README.md` | Directory intent only; no implementation found |
| `src/client` | Client components, hooks, interaction logic | `src/README.md` | Directory intent only; no implementation found |
| `src/core` | Core business logic: Kanban, ACP/MCP, Trace, Review | `src/README.md` | Directory intent only; no implementation found |
| `apps/desktop` | Tauri desktop application | `apps/desktop/README.md` | README only |
| `crates/keplar-core` | Rust domain models and infrastructure | `crates/keplar-core/src/lib.rs` | Placeholder comment only |
| `crates/keplar-server` | Axum HTTP server | `crates/keplar-server/src/main.rs` | Placeholder comment only |
| `crates/keplar-cli` | CLI entry point | `crates/keplar-cli/src/main.rs`, `crates/keplar-cli/Cargo.toml` | Placeholder comment only |
| `crates/keplar-rpc` | Public RPC protocol definitions | `crates/keplar-rpc/src/lib.rs` | Placeholder comment only |
| `crates/keplar-scanner` | Codebase scanning tool | `crates/keplar-scanner/src/lib.rs` | Placeholder comment only |
| `docs/specs` | Product, API, database, non-functional specs | `docs/specs/*.md` | Main source of truth today |
| `docs/architecture` | System, state, data-flow, swimlane, use-case, test architecture | `docs/architecture/*.md` | Main source of truth today, with some empty files |
| `.github/workflows/card-verify.yml` | Card YAML validation CI | Workflow file | Implemented, but references missing schema path |
| `drizzle*.config.ts` | Database schema/migration configuration | Drizzle config files | Config exists, schema target does not |
| `docker-compose.yml` | Local Postgres dependency | Compose file | Database only |

## Suggested Future Ownership Boundaries

These are not implemented yet; they are proposed boundaries for follow-up review.

| Ownership Area | Recommended Source of Truth | Rationale |
|---|---|---|
| API contract | `docs/specs/interface_spec.md` plus generated/shared types | Prevent drift across Web and Rust runtimes |
| Domain model | TypeScript/Drizzle schema for phase 1, mirrored into Rust later | Current dual runtime plan risks divergent business rules |
| Database schema | `src/core/**/*.schema.ts` or a renamed explicit schema directory | Drizzle configs already point to `src/core` |
| State machine | Domain core, covered by tests | Card and Goal Space state transitions are central governance logic |
| Governance | Dedicated module for RBAC, human confirmation, audit | Security rules cut across cards, goals, AI execution, and external tools |
| External tool execution | Dedicated ACP/MCP execution boundary | Tool writes, CI/CD, filesystem, and sandbox operations need central policy |
| Observability | Runtime middleware plus audit persistence | OpenTelemetry and audit trail serve different purposes and should not be conflated |

## Ownership Questions

1. How will TypeScript/Drizzle canonical types be generated or mirrored into Rust?
2. Should the API be implemented first in Next.js, Axum, or both?
3. Should Drizzle schema live under `src/core`, or should database code be separated from domain logic?
4. Should `audit_entries` be append-only and owned by a governance module?
5. Should AI lane logic own state transitions, or should lane outputs be commands validated by a separate state machine?
6. Who owns resource-level authorization: API layer, domain services, or both?
