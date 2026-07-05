# KEPLAR

> Enterprise agentOS for human-in-the-loop collaboration.

KEPLAR is a collaborative agent operating system for enterprise teams. It is
designed for the reality that large organizations cannot, and should not, turn
everything over to fully autonomous agents.

In serious business workflows, expert humans still carry accountability:
engineers, managers, reviewers, operators, domain specialists, and decision
makers. KEPLAR gives those people an agent-powered workspace where goals,
roles, tasks, evidence, review, and confirmation stay connected.

The goal is simple: make the business move around people, not force people to
chase the business across scattered tools, meetings, documents, and chat
threads.

## Contents

- [Why KEPLAR](#why-keplar)
- [Vision](#vision)
- [Core Ideas](#core-ideas)
- [How It Works](#how-it-works)
- [Who It Is For](#who-it-is-for)
- [What Makes It Different](#what-makes-it-different)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Contributing](#contributing)
- [License](#license)
- [Acknowledgements](#acknowledgements)

## Why KEPLAR

The first wave of agent software often imagines a world where agents simply
replace people. That is attractive in small, isolated workflows, but enterprise
delivery is different.

Large organizations operate through responsibility, review, policy, specialized
knowledge, handoffs, escalation paths, and institutional memory. The work is
not just "do a task"; it is "do the right task, with the right context, under
the right constraints, with evidence that the organization can trust."

That creates a different product challenge:

- AI should reduce coordination drag, not erase accountability.
- Humans should intervene where judgment matters, not babysit every step.
- Business context should be shared, structured, and traceable.
- Collaboration should happen around the goal, not around fragmented tools.
- Automation should create more room for high-value human work.

KEPLAR is built around that premise.

## Vision

KEPLAR aims to become an enterprise-grade agentOS for multi-role work:

```text
Business goal
  -> shared goal space
  -> role-aware work views
  -> agent-assisted task flow
  -> human confirmation
  -> auditable delivery record
```

Instead of asking every person to constantly chase status, interpret scattered
messages, and manually coordinate the next handoff, KEPLAR gives the workflow a
living operating layer.

People stay in control. Agents prepare, route, summarize, check, and accelerate.
The system keeps the shared memory.

## Core Ideas

### Human-in-the-loop by design

KEPLAR treats human judgment as part of the system, not as an exception path.
Critical decisions, sensitive transitions, blocked work, and final acceptance
remain visible and confirmable by the responsible people.

### Role-aware collaboration

Different roles need different views of the same business goal. A sponsor,
domain expert, reviewer, operator, and agent do not need identical screens.
They need a shared context with role-specific responsibilities and actions.

### Goal spaces, not task fragments

The goal space is the center of gravity. Requirements, cards, execution state,
agent outputs, confirmation gates, risks, and audit evidence all attach to the
same business objective.

### Business around people

The system should bring the right context, next action, and evidence to the
person who can move work forward. People should spend less time reconstructing
the workflow and more time applying expertise.

### Transparent governance

Enterprise AI needs trust. KEPLAR emphasizes traceability, explicit handoffs,
structured outputs, review gates, and durable records so teams can understand
what happened and why.

## How It Works

KEPLAR organizes work as a governed collaboration loop:

1. A business goal is captured in natural language.
2. The goal is structured into a shared operating context.
3. Work is split into role-aware boards and task cards.
4. Agents help refine, route, execute, review, report, and unblock work.
5. Humans confirm important decisions and outcomes.
6. The system preserves a visible trail of state, evidence, and responsibility.

This creates an operating environment where agents do not float outside the
organization. They work inside the same goal, role, review, and governance
structure as the people they assist.

## Who It Is For

KEPLAR is designed for teams where delivery depends on both automation and
professional accountability:

- enterprise project teams
- engineering and product organizations
- operations and delivery groups
- regulated or high-review workflows
- cross-functional teams with repeated handoffs
- organizations adopting AI agents without giving up governance

## What Makes It Different

| Conventional task tools | Fully autonomous agents | KEPLAR |
| --- | --- | --- |
| Track work after humans define it | Try to complete work without enough organizational context | Creates a shared goal space for humans and agents |
| Depend on manual coordination | Hide decisions inside agent runs | Keeps human confirmation and audit trails visible |
| Fragment context across boards, docs, and chat | Optimize for isolated task completion | Optimizes for governed enterprise collaboration |
| Make people chase updates | May remove people from decisions that require accountability | Brings context and next actions to the responsible role |

## Project Structure

The repository separates public orientation, product documents, architecture,
and agent workflow rules:

```text
.
├── docs/          # Product, architecture, specification, and review docs
├── .harness/      # Agent workflow, rules, skills, templates, and handoff flow
├── DESIGN.md      # Visual and interaction design direction
├── LICENSE        # MIT License
└── README.md      # GitHub project overview
```

Detailed implementation plans and technical contracts live in
[`docs/`](docs/). The harness workflow for AI-assisted development lives in
[`.harness/`](.harness/).

## Getting Started

### Prerequisites

- **Node.js**: `20.10.0` (see `.nvmrc`; use `nvm use` to align)
- **Package manager**: `pnpm` `11.x` (enable via `corepack enable pnpm` or `npm i -g pnpm@11`)
- **SQLite**: bundled through `better-sqlite3`; no external database service is
  required for local development

The repository is a pnpm workspace. The active application today is
`apps/web` (Next.js 15 + React 19 + TypeScript + Tailwind 4); `apps/desktop`
and `crates/` are reserved for future client shells and Rust components.

### Initial setup

Clone the repository and install workspace dependencies:

```bash
git clone <repository-url>
cd KEPLAR
pnpm install
```

The root `package.json` exposes workspace-wide shortcuts (e.g. `pnpm dev`,
`pnpm test`, `pnpm db:migrate`) that delegate to `@keplar/web`. The same
scripts are also defined inside `apps/web/package.json` and can be run
directly from `apps/web/` if you prefer to scope work to one application.

### Frontend operations

Run the Next.js dev server with hot reload on <http://localhost:3000>:

```bash
pnpm dev            # next dev
```

Build and serve a production bundle:

```bash
pnpm build          # next build (TS check + production output)
pnpm start          # next start (serves the production bundle)
```

Run unit, component, and smoke tests:

```bash
pnpm test           # vitest run (one-shot)
pnpm test:watch     # vitest in watch mode
pnpm smoke          # fast smoke subset
```

Run end-to-end browser tests against the running app:

```bash
pnpm e2e            # playwright test (headless)
pnpm e2e:ui         # playwright test --ui (interactive runner)
```

UI styling follows the token system in [`DESIGN.md`](DESIGN.md); tokens are
exposed as CSS variables in `apps/web/src/styles/tokens.css` and bridged into
Tailwind 4 utilities from `apps/web/src/app/globals.css`. Do not hardcode
hex values or pixel sizes in components.

### Backend operations

The backend lives inside `apps/web/` as Next.js Route Handlers
(`apps/web/src/app/api/v1/...`) plus a Drizzle/SQLite data layer at
`apps/web/db/`. Schema and migrations are first-class sources of truth:

- **Schema source**: `apps/web/db/schema.ts`
- **Generated migrations**: `apps/web/db/migrations/`
- **Local database file**: `apps/web/db/dev.db` (gitignored)

#### Database (Drizzle + SQLite)

```bash
pnpm db:generate    # drizzle-kit generate: rebuild SQL from schema.ts
pnpm db:migrate     # drizzle-kit migrate: apply pending migrations to dev.db
pnpm db:check       # drizzle-kit check: validate schema vs. migration consistency
pnpm db:studio      # drizzle-kit studio: open the browser-based DB inspector
```

To reset the local database (destructive — wipes local data only):

```bash
rm -f apps/web/db/dev.db apps/web/db/dev.db-shm apps/web/db/dev.db-wal
pnpm db:migrate
```

Inspect tables directly with the SQLite CLI:

```bash
sqlite3 apps/web/db/dev.db ".tables"
```

#### API routes

REST endpoints are colocated under `apps/web/src/app/api/v1/` (auth, cards,
confirmations, execute, goal-spaces, node-boards). With `pnpm dev` running,
exercise them with curl or the Playwright harness:

```bash
curl http://localhost:3000/api/v1/goal-spaces
```

Real-time updates are pushed over Server-Sent Events at
`apps/web/src/app/api/v1/sse/`. To follow a live stream from the terminal:

```bash
curl -N http://localhost:3000/api/v1/sse
```

### Quality gates

Run the consolidated pre-PR check, or invoke individual gates:

```bash
pnpm check          # typecheck + lint + test + build + format:check
pnpm typecheck      # tsc --noEmit
pnpm lint           # eslint .
pnpm format         # prettier --write .
pnpm format:check   # prettier --check .
```

### Agent-assisted development

KEPLAR ships with a project harness for AI-assisted changes. Initialize it
once after cloning:

```bash
.harness/skills/init.sh
```

Then read:

- [`docs/README.md`](docs/README.md)
- [`docs/specs/prd.md`](docs/specs/prd.md)
- [`docs/architecture/system_architecture.md`](docs/architecture/system_architecture.md)
- [`.harness/agents/application-owner.md`](.harness/agents/application-owner.md)

## Contributing

KEPLAR is being built with a strong bias toward disciplined, reviewable
changes.

Before contributing:

1. Understand the product vision and architecture documents.
2. Keep each change focused on one approved feature or document boundary.
3. Preserve human-in-the-loop behavior where accountability matters.
4. Record verification evidence for completed work.
5. Avoid speculative abstractions and hidden scope expansion.

Implementation requests should follow the project harness so that request
analysis, review, implementation, testing, and handoff remain traceable.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file
for details. The MIT License grants permission for both commercial and private
use, modification, and distribution, subject to the conditions and limitations
outlined in the license file.

## Acknowledgements

KEPLAR draws from ideas in collaborative work systems, agentic software,
human-in-the-loop governance, enterprise architecture, and audit-first delivery.

The project documentation under [`docs/`](docs/) and development harness under
[`.harness/`](.harness/) are the canonical references for product and
engineering decisions.
