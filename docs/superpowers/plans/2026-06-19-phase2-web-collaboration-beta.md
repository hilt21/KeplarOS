# Phase 2 Web Collaboration Beta Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the completed Phase 1 Web-first Board demo into a Web collaboration beta that real project teams can exercise through authenticated REST APIs, SSE updates, confirmation gates, deterministic AI-lane execution, and an end-to-end board UI.

**Architecture:** Keep the TypeScript/Next.js/Drizzle/SQLite runtime as the only Phase 2 implementation path. Build thin route handlers over the existing domain core, keep all writes behind authorization, state-machine, confirmation, audit, and realtime-event services, and defer Tauri, Rust Axum, Kubernetes, enterprise SSO, and real external writes to later phases.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript 5, Drizzle ORM, SQLite via better-sqlite3, Vitest, Playwright, ESLint, Prettier, pnpm 11.5.1, Node 20.

---

## 1. Phase 2 Scope

Phase 2 is **Web Collaboration Beta**.

Phase 1 proved the local board demo and aligned the domain core. Phase 2 must make the product usable through the documented API and UI workflows without expanding into production infrastructure or desktop runtime.

### In Scope

| Capability | Phase 2 result |
|------------|----------------|
| Authenticated Web session | Login, current-user lookup, logout, and route-level auth checks using HttpOnly session cookies |
| REST API | Goal spaces, node boards, members, cards, transitions, confirmations, agent execution, audit trail, and health endpoints under `/api/v1` |
| Deterministic AI lanes | Role-specific fixture executor that writes `agent_executions`, card state, evidence, confirmations, audit, and SSE events |
| Human confirmation | Pending list, decide endpoint, confirmation gate enforcement, rejected-to-blocked routing |
| Realtime dashboard | SSE endpoint with `Last-Event-ID` replay and client-side event application |
| Web board beta UI | Authenticated goal-space list, goal detail, node-board view, card detail drawer, confirmation queue, execution status, audit trail |
| Verification | Unit, integration, migration, API contract, SSE contract, smoke, and Playwright happy-path E2E |
| Documentation refresh | Update API/test/deployment docs to match the implemented Phase 2 beta |

### Out of Scope

| Capability | Reason |
|------------|--------|
| Tauri desktop runtime | Keep Phase 2 focused on Web beta; desktop must later reuse the same API contract |
| Rust Axum server | Avoid dual-runtime semantic drift before Web API stabilizes |
| Real MCP/ACP/A2A external writes | Phase 2 may model the boundary, but external write execution remains behind fixtures and human confirmation |
| Enterprise SSO / multi-tenant identity | Session auth is enough for beta; SSO belongs in a later enterprise hardening phase |
| Kubernetes / HPA / production HA | Phase 2 should be deployable as a Web app, not production-platform complete |
| Full performance/load test program | Add smoke and simple SSE/API timing checks only; load testing follows once the API is stable |

---

## 2. Source Artifacts

- Phase 1 scope: `docs/specs/phase1_scope.md`
- PRD: `docs/specs/prd.md`
- Interface contract: `docs/specs/interface_spec.md`
- Authorization matrix: `docs/specs/authorization_matrix.md`
- AI contracts: `docs/specs/ai_agent_contracts.md`
- Realtime events: `docs/specs/realtime_events.md`
- Database design: `docs/specs/database_design.md`
- System architecture: `docs/architecture/system_architecture.md`
- Test matrix: `docs/architecture/test_matrix.md`
- Full repo review: `docs/review/2026-06-08-full-repo-review/REVIEW.md`
- S2 to S3 migration ADR: `docs/migrations/S2_to_S3_alignment.md`

---

## 3. Execution Rules

Use the project harness for each implementation feature.

For every feature below:

1. Create a change id: `YYYYMMDD-phase2-<feature-slug>`.
2. Complete `.harness/changes/{change-id}/request_analysis/spec.md`.
3. Complete `.harness/changes/{change-id}/request_analysis/tasks.md`.
4. Complete `.harness/changes/{change-id}/request_analysis/feature_list.json`.
5. Complete `.harness/changes/{change-id}/sprint_progress.md`.
6. Stop for human approval before implementation.
7. Implement exactly one approved feature at a time.
8. Update `feature_list.json`, `sprint_progress.md`, `testing/results.md`, and `handoff.md` before ending each session.

The standard verification command for Phase 2 is:

```bash
pnpm check
```

When a feature adds API or UI behavior, also run the targeted command listed in that task.

---

## 4. File Structure Map

### Existing Files To Extend

| Path | Responsibility |
|------|----------------|
| `apps/web/db/schema.ts` | Canonical Drizzle schema and enum exports |
| `apps/web/db/migrations/` | Immutable ordered SQL migrations |
| `apps/web/src/lib/authorization/` | Resource-level permission checks |
| `apps/web/src/lib/state-machine/` | Goal and card lifecycle guards |
| `apps/web/src/lib/audit/` | Audited transactional writes and redaction |
| `apps/web/src/lib/auth/` | Password/session primitives |
| `apps/web/src/app/page.tsx` | Current Web entry screen |
| `apps/web/src/app/globals.css` | Global styling and design tokens import |
| `apps/web/__tests__/` | Unit, integration, migration, and API contract tests |
| `docs/architecture/test_matrix.md` | Testing baseline and verification gates |
| `docs/specs/interface_spec.md` | REST/SSE API contract |

### New Files To Create

| Path | Responsibility |
|------|----------------|
| `apps/web/src/lib/api/response.ts` | Standard `ApiResponse<T>` and `ApiError` helpers |
| `apps/web/src/lib/api/errors.ts` | Typed API error codes and HTTP status mapping |
| `apps/web/src/lib/api/request.ts` | JSON parsing, validation helpers, current actor extraction |
| `apps/web/src/lib/api/pagination.ts` | Shared `page` / `limit` parsing |
| `apps/web/src/lib/db/repositories/*.ts` | Focused query/write helpers for each aggregate |
| `apps/web/src/lib/services/*.ts` | Transactional application services for REST writes |
| `apps/web/src/lib/execution/*.ts` | Deterministic AI lane executor and role contracts |
| `apps/web/src/lib/realtime/*.ts` | SSE serialization, replay, and permission filtering |
| `apps/web/src/app/api/v1/**/route.ts` | Next.js route handlers for documented REST/SSE endpoints |
| `apps/web/src/app/(app)/**` | Authenticated Web beta screens |
| `apps/web/src/components/**` | Reusable board, card, confirmation, and audit UI components |
| `apps/web/e2e/phase2-board.spec.ts` | Playwright happy-path beta flow |
| `apps/web/playwright.config.ts` | Playwright configuration |

---

## 5. Feature Sequence

Implement features in order. Do not start a later feature until the previous feature is green and reviewed.

| Feature | Name | Depends on | Exit gate |
|---------|------|------------|-----------|
| F2-00 | Phase 2 baseline and docs refresh | Phase 1 complete | Docs reflect current executable test baseline |
| F2-01 | API foundation and test harness | F2-00 | Route tests can assert response envelopes and auth errors |
| F2-02 | Session auth API | F2-01 | Login/current/logout work with HttpOnly cookie |
| F2-03 | Goal space API | F2-02 | Goal space CRUD and lifecycle routes pass API contract tests |
| F2-04 | Node board and member API | F2-03 | Board/member access boundaries pass tests |
| F2-05 | Card and transition API | F2-04 | Card CRUD, assign, block, unblock, transitions work |
| F2-06 | Human confirmation API | F2-05 | Pending queue and decide endpoint enforce gates |
| F2-07 | Deterministic AI lane executor API | F2-06 | Execute/status/retry flows write audit and realtime events |
| F2-08 | SSE dashboard endpoint | F2-07 | Event stream supports replay and permission filtering |
| F2-09 | Web beta UI | F2-08 | User can run the board workflow from browser |
| F2-10 | E2E, smoke, and delivery docs | F2-09 | `pnpm check` and Playwright beta path pass |

---

## Task F2-00: Phase 2 Baseline And Docs Refresh

**Files:**
- Modify: `docs/specs/phase1_scope.md`
- Modify: `docs/architecture/test_matrix.md`
- Modify: `docs/specs/interface_spec.md`
- Modify: `docs/README.md`
- Create: `.harness/changes/{change-id}/request_analysis/spec.md`
- Create: `.harness/changes/{change-id}/request_analysis/tasks.md`
- Create: `.harness/changes/{change-id}/request_analysis/feature_list.json`
- Create: `.harness/changes/{change-id}/sprint_progress.md`

- [ ] **Step 1: Record Phase 1 completion state**

Run:
```bash
git status --short --branch
pnpm --version
node --version
pnpm check
```

Expected:
```text
git status shows a clean or intentionally documented worktree
pnpm reports 11.5.1
node reports a 20.x version
pnpm check exits 0
```

- [ ] **Step 2: Update Phase 1 scope**

Add a short section to `docs/specs/phase1_scope.md`:

```markdown
## 6. Phase 1 Completion

Phase 1 is complete. The completed baseline is a local Web-first Board demo with Next.js, TypeScript, Drizzle, SQLite, domain schema, state machines, authorization helpers, audit transaction helpers, realtime event persistence, and executable verification scripts.

Phase 2 starts from this baseline and focuses on turning the demo into a Web collaboration beta through authenticated APIs, deterministic AI-lane execution, SSE, UI workflows, and E2E verification.
```

- [ ] **Step 3: Refresh test matrix**

Replace outdated language in `docs/architecture/test_matrix.md` that says the repository has no executable test entry. The Phase 2 baseline must name:

```text
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm format:check
pnpm check
```

- [ ] **Step 4: Add Phase 2 API implementation note**

In `docs/specs/interface_spec.md`, add a note near the REST overview:

```markdown
Phase 2 implements the `/api/v1` Web beta API in Next.js route handlers. Route handlers must use the shared response envelope, session actor extraction, authorization matrix, state machines, audit transaction boundary, and realtime event contract.
```

- [ ] **Step 5: Commit**

```bash
git add docs/specs/phase1_scope.md docs/architecture/test_matrix.md docs/specs/interface_spec.md docs/README.md .harness/changes
git commit -m "docs(phase2): define web collaboration beta baseline"
```

---

## Task F2-01: API Foundation And Route Test Harness

**Files:**
- Create: `apps/web/src/lib/api/response.ts`
- Create: `apps/web/src/lib/api/errors.ts`
- Create: `apps/web/src/lib/api/request.ts`
- Create: `apps/web/src/lib/api/pagination.ts`
- Create: `apps/web/__tests__/api/response.test.ts`
- Create: `apps/web/__tests__/api/request.test.ts`
- Create: `apps/web/__tests__/api/route-test-harness.ts`

- [ ] **Step 1: Write response envelope tests**

Create tests proving successful responses match:

```typescript
{
  success: true,
  data: value,
  timestamp: expect.any(String)
}
```

and errors match:

```typescript
{
  success: false,
  error: {
    code: 'UNAUTHORIZED',
    message: 'Authentication required'
  },
  timestamp: expect.any(String)
}
```

- [ ] **Step 2: Implement response helpers**

Create helpers:

```typescript
export function apiOk<T>(data: T, init?: ResponseInit): Response
export function apiCreated<T>(data: T): Response
export function apiNoContent(): Response
export function apiError(error: ApiErrorCode, message: string, init?: ResponseInit): Response
```

- [ ] **Step 3: Implement request helpers**

Create helpers:

```typescript
export async function readJsonBody<T>(request: Request): Promise<T>
export function requireString(value: unknown, field: string): string
export function optionalString(value: unknown, field: string): string | undefined
export function parseCurrentActor(request: Request): Promise<Actor>
```

For Phase 2, `parseCurrentActor` must read the authenticated session created by F2-02. Before F2-02 lands, tests may use the route test harness to inject a session cookie.

- [ ] **Step 4: Implement route test harness**

Create a test helper that can:

```typescript
createJsonRequest(path, method, body, options)
expectApiOk(response)
expectApiError(response, code, status)
withTestSession(actor)
```

- [ ] **Step 5: Verify**

Run:
```bash
pnpm --filter @keplar/web test -- __tests__/api/response.test.ts __tests__/api/request.test.ts
pnpm check
```

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/api apps/web/__tests__/api .harness/changes
git commit -m "feat(api): add shared response and request foundation"
```

---

## Task F2-02: Session Auth API

**Files:**
- Create: `apps/web/src/lib/auth/session.ts`
- Create: `apps/web/src/app/api/v1/auth/login/route.ts`
- Create: `apps/web/src/app/api/v1/auth/logout/route.ts`
- Create: `apps/web/src/app/api/v1/auth/me/route.ts`
- Create: `apps/web/__tests__/api/auth.test.ts`
- Modify: `apps/web/src/middleware.ts`

- [ ] **Step 1: Write auth API tests**

Cover:

```text
POST /api/v1/auth/login returns 200 and sets HttpOnly session cookie for valid credentials
POST /api/v1/auth/login returns 401 for invalid credentials
GET /api/v1/auth/me returns current user when session cookie is present
POST /api/v1/auth/logout clears the session cookie
Protected /api/v1 routes return 401 without a session
```

- [ ] **Step 2: Implement session primitives**

`session.ts` must provide:

```typescript
export async function createSession(userId: string): Promise<SessionCookie>
export async function getSessionActor(request: Request): Promise<Actor | null>
export function clearSessionCookie(): string
```

Store session records using the existing session/auth schema. Session cookies must be HttpOnly, SameSite=Lax, path `/`, and expire according to `docs/specs/interface_spec.md`.

- [ ] **Step 3: Implement route handlers**

Routes must use `apiOk`, `apiError`, password verification from `apps/web/src/lib/auth/password.ts`, and the shared actor shape from `apps/web/src/lib/authorization/types.ts`.

- [ ] **Step 4: Verify**

Run:
```bash
pnpm --filter @keplar/web test -- __tests__/api/auth.test.ts __tests__/middleware.test.ts __tests__/auth/password.test.ts
pnpm check
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/auth apps/web/src/app/api/v1/auth apps/web/src/middleware.ts apps/web/__tests__/api/auth.test.ts .harness/changes
git commit -m "feat(auth): add session login logout and current user API"
```

---

## Task F2-03: Goal Space API

**Files:**
- Create: `apps/web/src/lib/db/repositories/goal-spaces.ts`
- Create: `apps/web/src/lib/services/goal-spaces.ts`
- Create: `apps/web/src/app/api/v1/goal-spaces/route.ts`
- Create: `apps/web/src/app/api/v1/goal-spaces/[id]/route.ts`
- Create: `apps/web/src/app/api/v1/goal-spaces/[id]/start/route.ts`
- Create: `apps/web/src/app/api/v1/goal-spaces/[id]/complete/route.ts`
- Create: `apps/web/src/app/api/v1/goal-spaces/[id]/cancel/route.ts`
- Create: `apps/web/__tests__/api/goal-spaces.test.ts`

- [ ] **Step 1: Write API contract tests**

Cover the documented endpoints:

```text
POST /api/v1/goal-spaces
GET /api/v1/goal-spaces
GET /api/v1/goal-spaces/:id
PATCH /api/v1/goal-spaces/:id
POST /api/v1/goal-spaces/:id/start
POST /api/v1/goal-spaces/:id/complete
POST /api/v1/goal-spaces/:id/cancel
```

Tests must assert authorization, response envelope, status transitions, audit entry creation, and realtime event creation.

- [ ] **Step 2: Implement repository**

Repository functions:

```typescript
createGoalSpace(input, actor)
listGoalSpaces(query, actor)
getGoalSpaceDetail(id, actor)
updateGoalSpace(id, input, actor)
```

- [ ] **Step 3: Implement service**

Service functions must enforce:

```text
draft -> active
active -> completed
draft/active -> cancelled
completed/cancelled are terminal
```

Every lifecycle write must use `runWithAudit`.

- [ ] **Step 4: Implement route handlers**

Route handlers must perform:

```text
session actor extraction
body/query parsing
authorization check
service call
standard response envelope
```

- [ ] **Step 5: Verify**

Run:
```bash
pnpm --filter @keplar/web test -- __tests__/api/goal-spaces.test.ts __tests__/state-machine/goal-space.test.ts __tests__/audit/run-with-audit.test.ts
pnpm check
```

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/db/repositories/goal-spaces.ts apps/web/src/lib/services/goal-spaces.ts apps/web/src/app/api/v1/goal-spaces apps/web/__tests__/api/goal-spaces.test.ts .harness/changes
git commit -m "feat(api): add goal space lifecycle endpoints"
```

---

## Task F2-04: Node Board And Member API

**Files:**
- Create: `apps/web/src/lib/db/repositories/node-boards.ts`
- Create: `apps/web/src/lib/services/node-boards.ts`
- Create: `apps/web/src/app/api/v1/goal-spaces/[goalSpaceId]/node-boards/route.ts`
- Create: `apps/web/src/app/api/v1/node-boards/[id]/route.ts`
- Create: `apps/web/src/app/api/v1/node-boards/[id]/members/route.ts`
- Create: `apps/web/src/app/api/v1/node-boards/[id]/members/[userId]/route.ts`
- Create: `apps/web/__tests__/api/node-boards.test.ts`

- [ ] **Step 1: Write member-boundary tests**

Cover:

```text
initiator can create board in own goal space
board owner can update board
board owner can add and remove members
viewer cannot mutate members
non-member cannot read board detail
member changes write audit and realtime events
```

- [ ] **Step 2: Implement repository and service**

Service must use `canReadNodeBoard`, `canMutateNodeBoard`, and the existing `node_board_members` table.

- [ ] **Step 3: Implement route handlers**

Handlers must return the documented `NodeBoardResponse` and `NodeBoardMemberResponse` shapes from `docs/specs/interface_spec.md`.

- [ ] **Step 4: Verify**

Run:
```bash
pnpm --filter @keplar/web test -- __tests__/api/node-boards.test.ts __tests__/authorization/node-board.test.ts
pnpm check
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/db/repositories/node-boards.ts apps/web/src/lib/services/node-boards.ts apps/web/src/app/api/v1/goal-spaces apps/web/src/app/api/v1/node-boards apps/web/__tests__/api/node-boards.test.ts .harness/changes
git commit -m "feat(api): add node board and member endpoints"
```

---

## Task F2-05: Card And Transition API

**Files:**
- Create: `apps/web/src/lib/db/repositories/cards.ts`
- Create: `apps/web/src/lib/services/cards.ts`
- Create: `apps/web/src/app/api/v1/goal-spaces/[goalSpaceId]/cards/route.ts`
- Create: `apps/web/src/app/api/v1/cards/[id]/route.ts`
- Create: `apps/web/src/app/api/v1/cards/[id]/assign/route.ts`
- Create: `apps/web/src/app/api/v1/cards/[id]/block/route.ts`
- Create: `apps/web/src/app/api/v1/cards/[id]/unblock/route.ts`
- Create: `apps/web/src/app/api/v1/cards/[id]/transitions/route.ts`
- Create: `apps/web/__tests__/api/cards.test.ts`

- [ ] **Step 1: Write card API tests**

Cover:

```text
create card under authorized goal space
list cards by state and assignee
read card detail with transitions, confirmations, and audit trail
patch card metadata
assign card
manual block
unblock into an allowed target state
reject invalid state transitions with 422
reject pending-confirmation-gated mutation with 409 or 422
```

- [ ] **Step 2: Implement repository**

Repository must load card context from the database instead of trusting caller-supplied context.

- [ ] **Step 3: Implement service**

Service must use:

```text
canReadCard
canMutateCard
card state machine
pending confirmation gate
runWithAudit
realtime event insertion
```

- [ ] **Step 4: Implement transition history endpoint**

`GET /api/v1/cards/:id/transitions` must inherit card read permission and return the documented transition shape.

- [ ] **Step 5: Verify**

Run:
```bash
pnpm --filter @keplar/web test -- __tests__/api/cards.test.ts __tests__/state-machine/card.test.ts __tests__/authorization/card.test.ts
pnpm check
```

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/db/repositories/cards.ts apps/web/src/lib/services/cards.ts apps/web/src/app/api/v1/cards apps/web/src/app/api/v1/goal-spaces apps/web/__tests__/api/cards.test.ts .harness/changes
git commit -m "feat(api): add card and transition endpoints"
```

---

## Task F2-06: Human Confirmation API

**Files:**
- Create: `apps/web/src/lib/db/repositories/confirmations.ts`
- Create: `apps/web/src/lib/services/confirmations.ts`
- Create: `apps/web/src/app/api/v1/confirmations/route.ts`
- Create: `apps/web/src/app/api/v1/confirmations/[id]/decide/route.ts`
- Create: `apps/web/__tests__/api/confirmations.test.ts`

- [ ] **Step 1: Write confirmation API tests**

Cover:

```text
GET /api/v1/confirmations?status=pending only returns accessible confirmations
initiator can approve pending confirmation
initiator can reject pending confirmation
non-initiator cannot decide confirmation
already-decided confirmation cannot be decided again
approval moves card to target_state when target_state is present
rejection moves card to blocked and records reason
decision writes audit and realtime events
```

- [ ] **Step 2: Implement repository and service**

Service must enforce `canDecideConfirmation`, current confirmation status, card access, and target-state validity.

- [ ] **Step 3: Implement route handlers**

Responses must match `HumanConfirmationResponse` and `DecideConfirmationResponse` from `docs/specs/interface_spec.md`.

- [ ] **Step 4: Verify**

Run:
```bash
pnpm --filter @keplar/web test -- __tests__/api/confirmations.test.ts __tests__/authorization/confirmation.test.ts
pnpm check
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/db/repositories/confirmations.ts apps/web/src/lib/services/confirmations.ts apps/web/src/app/api/v1/confirmations apps/web/__tests__/api/confirmations.test.ts .harness/changes
git commit -m "feat(api): add human confirmation endpoints"
```

---

## Task F2-07: Deterministic AI Lane Executor API

**Files:**
- Create: `apps/web/src/lib/execution/roles.ts`
- Create: `apps/web/src/lib/execution/fixture-executor.ts`
- Create: `apps/web/src/lib/services/executions.ts`
- Create: `apps/web/src/app/api/v1/cards/[id]/execute/route.ts`
- Create: `apps/web/src/app/api/v1/execute/[taskId]/route.ts`
- Create: `apps/web/__tests__/api/executions.test.ts`

- [ ] **Step 1: Write execution API tests**

Cover:

```text
POST /api/v1/cards/:id/execute creates queued agent_executions row
GET /api/v1/execute/:taskId returns status for authorized user
unauthorized user cannot read task status
Backlog Refiner fixture can move backlog card toward todo
Review Guard fixture can create needs_confirmation for high-risk output
failed execution records error and audit entry
execution result writes realtime event
```

- [ ] **Step 2: Implement role registry**

`roles.ts` must export the six documented roles:

```text
Backlog Refiner
Todo Orchestrator
Dev Crafter
Review Guard
Done Reporter
Blocked Resolver
```

- [ ] **Step 3: Implement fixture executor**

The executor must be deterministic. Given the same card and role, it must return the same structured result. It must not call external LLM, MCP, ACP, A2A, GitHub, shell, network, or filesystem write tools.

- [ ] **Step 4: Implement execution service**

Service must:

```text
create agent_executions row
enforce card permissions
respect pending confirmation gate
write audit entry
write realtime event
apply allowed state transition when result is completed
create confirmation when result requires human approval
```

- [ ] **Step 5: Verify**

Run:
```bash
pnpm --filter @keplar/web test -- __tests__/api/executions.test.ts __tests__/authorization/execute.test.ts __tests__/authorization/execute-db.test.ts
pnpm check
```

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/execution apps/web/src/lib/services/executions.ts apps/web/src/app/api/v1/cards apps/web/src/app/api/v1/execute apps/web/__tests__/api/executions.test.ts .harness/changes
git commit -m "feat(api): add deterministic AI lane execution"
```

---

## Task F2-08: SSE Dashboard Endpoint

**Files:**
- Create: `apps/web/src/lib/realtime/events.ts`
- Create: `apps/web/src/lib/realtime/stream.ts`
- Create: `apps/web/src/app/api/v1/events/route.ts`
- Create: `apps/web/__tests__/api/realtime.test.ts`

- [ ] **Step 1: Write realtime API tests**

Cover:

```text
GET /api/v1/events requires authentication
event stream returns text/event-stream
Last-Event-ID replays later events
unauthorized actor does not receive inaccessible goal-space events
duplicate events keep stable event id
heartbeat comment is emitted during idle periods
```

- [ ] **Step 2: Implement event serialization**

Serialize events according to `docs/specs/realtime_events.md`:

```text
id: <monotonic id>
event: <event type>
data: <JSON envelope>
```

- [ ] **Step 3: Implement route handler**

The route must:

```text
authenticate session
parse Last-Event-ID
load replayable events
filter by authorization
open readable stream
send heartbeat comments
close cleanly on client abort
```

- [ ] **Step 4: Verify**

Run:
```bash
pnpm --filter @keplar/web test -- __tests__/api/realtime.test.ts
pnpm check
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/realtime apps/web/src/app/api/v1/events apps/web/__tests__/api/realtime.test.ts .harness/changes
git commit -m "feat(api): add realtime SSE endpoint"
```

---

## Task F2-09: Web Beta UI

**Files:**
- Modify: `apps/web/src/app/page.tsx`
- Create: `apps/web/src/app/(app)/layout.tsx`
- Create: `apps/web/src/app/(app)/goal-spaces/page.tsx`
- Create: `apps/web/src/app/(app)/goal-spaces/[id]/page.tsx`
- Create: `apps/web/src/components/goal-space-list.tsx`
- Create: `apps/web/src/components/node-board-view.tsx`
- Create: `apps/web/src/components/card-lane.tsx`
- Create: `apps/web/src/components/card-detail-drawer.tsx`
- Create: `apps/web/src/components/confirmation-queue.tsx`
- Create: `apps/web/src/components/execution-status.tsx`
- Create: `apps/web/src/components/audit-timeline.tsx`
- Create: `apps/web/__tests__/ui/board-render.test.tsx`

- [ ] **Step 1: Read design system**

Run:
```bash
sed -n '1,220p' DESIGN.md
```

Record the typography, colors, spacing, and component constraints in the active harness request analysis artifact.

- [ ] **Step 2: Write UI render tests**

Cover:

```text
goal space list renders empty, loading, and populated states
board view groups cards by state
card detail drawer renders transitions, confirmations, and audit entries
confirmation queue renders approve and reject actions
execution status updates when a realtime event is applied
```

- [ ] **Step 3: Implement authenticated shell**

The shell must show the product workspace directly. Do not add a marketing landing page.

- [ ] **Step 4: Implement board workflow UI**

The UI must support:

```text
create goal space
open goal space detail
view node board lanes
open card detail
execute a documented AI role
decide a pending confirmation
observe realtime update
view audit trail
```

- [ ] **Step 5: Verify UI**

Run:
```bash
pnpm --filter @keplar/web test -- __tests__/ui/board-render.test.tsx
pnpm --filter @keplar/web build
pnpm check
```

Then inspect in browser at:

```text
http://localhost:3000
```

Check desktop and mobile widths:

```text
1440x900
390x844
```

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app apps/web/src/components apps/web/__tests__/ui/board-render.test.tsx .harness/changes
git commit -m "feat(web): add phase 2 collaboration beta UI"
```

---

## Task F2-10: E2E, Smoke, And Delivery Docs

**Files:**
- Create: `apps/web/playwright.config.ts`
- Create: `apps/web/e2e/phase2-board.spec.ts`
- Modify: `apps/web/package.json`
- Modify: `package.json`
- Modify: `.github/workflows/web-ci.yml`
- Modify: `docs/architecture/test_matrix.md`
- Modify: `docs/specs/phase1_scope.md`
- Create: `.harness/changes/{change-id}/delivery/summary.md`
- Create: `.harness/changes/{change-id}/handoff.md`

- [ ] **Step 1: Add Playwright scripts**

Add scripts:

```json
{
  "e2e": "playwright test",
  "e2e:ui": "playwright test --ui",
  "smoke": "vitest run __tests__/smoke.test.ts"
}
```

Root `package.json` must forward:

```json
{
  "e2e": "pnpm --filter @keplar/web e2e",
  "smoke": "pnpm --filter @keplar/web smoke"
}
```

- [ ] **Step 2: Write E2E beta path**

The Playwright test must cover:

```text
login
create goal space
create node board
create card
execute Backlog Refiner
handle pending confirmation when created
verify card state or blocked reason
verify audit trail visible
verify SSE-driven UI update without manual refresh
```

- [ ] **Step 3: Update CI**

CI must run:

```bash
pnpm install --frozen-lockfile
pnpm check
pnpm smoke
pnpm e2e
```

If Playwright browser installation is required in CI, add:

```bash
pnpm exec playwright install --with-deps chromium
```

- [ ] **Step 4: Update docs**

Document Phase 2 verification gates in `docs/architecture/test_matrix.md`:

```text
unit
integration
migration
api_contract
sse_contract
smoke
e2e
```

Add a Phase 2 completion section to `docs/specs/phase1_scope.md` or create a dedicated `docs/specs/phase2_scope.md` if the team wants phase scopes separated.

- [ ] **Step 5: Final verification**

Run:
```bash
pnpm check
pnpm smoke
pnpm e2e
git status --short
```

Expected:
```text
all checks pass
git status only shows intentional delivery artifact updates before final commit
```

- [ ] **Step 6: Commit**

```bash
git add package.json apps/web/package.json apps/web/playwright.config.ts apps/web/e2e .github/workflows/web-ci.yml docs .harness/changes
git commit -m "test(e2e): add phase 2 beta verification path"
```

---

## 6. Phase 2 Definition Of Done

Phase 2 is complete only when all statements are true:

- [ ] `/api/v1/auth/login`, `/logout`, and `/me` work with HttpOnly sessions.
- [ ] Goal space lifecycle API matches `docs/specs/interface_spec.md`.
- [ ] Node board and member API enforce membership boundaries.
- [ ] Card API enforces state-machine rules, confirmation gates, and authorization.
- [ ] Confirmation API supports pending list, approve, reject, and already-decided rejection.
- [ ] Execution API creates `agent_executions`, exposes status, and never bypasses card permissions.
- [ ] Deterministic AI lane executor writes audit and realtime events for every stateful result.
- [ ] SSE endpoint supports replay through `Last-Event-ID`.
- [ ] Web UI supports the beta workflow without requiring direct database edits.
- [ ] `pnpm check` passes.
- [ ] `pnpm smoke` passes.
- [ ] `pnpm e2e` passes.
- [ ] Phase 2 docs and harness artifacts are updated.
- [ ] `handoff.md` records the final state, unresolved risks, and next recommended phase.

---

## 7. Risk Register

| Risk | Impact | Mitigation |
|------|--------|------------|
| API work bypasses domain services | Authorization and audit drift | Route handlers must stay thin and call services only |
| UI grows before API is stable | Rework and mock leakage | Finish F2-01 through F2-08 before F2-09 |
| Fixture executor becomes real external write path | Unsafe automation | Executor must be deterministic and side-effect-limited in Phase 2 |
| SSE test flakiness | CI instability | Unit-test serialization/replay and keep Playwright SSE test to one happy path |
| Docs drift again | Future phases inherit ambiguity | F2-00 and F2-10 update docs before and after implementation |
| Feature scope creep | Multiple half-finished features | Harness rule: one feature at a time, return to request analysis for scope amendment |

---

## 8. Recommended Execution Mode

Use **Subagent-Driven Development** for F2-01 through F2-10.

Recommended grouping:

| Subagent pass | Feature |
|---------------|---------|
| Pass 1 | F2-00 docs baseline |
| Pass 2 | F2-01 API foundation |
| Pass 3 | F2-02 auth |
| Pass 4 | F2-03 goal spaces |
| Pass 5 | F2-04 node boards |
| Pass 6 | F2-05 cards |
| Pass 7 | F2-06 confirmations |
| Pass 8 | F2-07 executions |
| Pass 9 | F2-08 SSE |
| Pass 10 | F2-09 UI |
| Pass 11 | F2-10 E2E and delivery |

After each pass, run review before starting the next feature.

