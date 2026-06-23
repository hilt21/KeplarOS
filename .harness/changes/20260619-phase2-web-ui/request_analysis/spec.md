# F2-09 Web UI — Request Analysis

Change ID: `20260619-phase2-web-ui`
Status: request_analysis

## Request Summary

Implement the Web UI for the Web Collaboration Beta (F2-09). This is the seventh application feature in Phase 2, following F2-02 (Session Auth) through F2-08 (SSE Dashboard Endpoint).

Scope of this change is the **authenticated Web UI** that consumes the F2-02..F2-08 backend APIs and renders them in a codex-cli-inspired three-column layout. The UI is keyboard-first, dark by default, supports multiple themes, and uses a slash-command + output-feed interaction model (NOT free-form chat — there is no LLM in the backend).

The plan file at `/Users/taolu/.claude/plans/zippy-churning-music.md` is the source-of-truth design plan (approved by the human). This request-analysis artifact references that plan and captures the harness-level scope, acceptance criteria, and risks.

## Assumptions

- F2-02 through F2-08 are committed on `master`. Reuse the documented APIs and the F2-08 SSE module (`/Users/taolu/KEPLAR/apps/web/src/lib/realtime/{stream,events}.ts`).
- The `/Users/taolu/KEPLAR/apps/web/src/styles/tokens.css` file is read-only (generated bridge from `/DESIGN.md`). The implementation MUST NOT modify it. All new UI must reference existing `--color-*`, `--space-*`, `--radius-*`, `--motion-*`, `--font-*` variables.
- The `/Users/taolu/KEPLAR/apps/web/src/app/globals.css` file is modifiable but only by adding new `[data-theme="..."]` selector blocks. The existing `:root` block and `@theme` Tailwind 4 bridge must remain unchanged.
- The root `apps/web/src/app/layout.tsx` is modified to add a single inline `<script>` for FOUC-prevention theme initialization. Otherwise unchanged.
- The `keplar_session` HttpOnly cookie is the only auth mechanism. The UI MUST use `fetch(..., { credentials: 'include' })`. The UI MUST NOT read `document.cookie`. The UI MUST NOT set the `x-keplar-test-actor` header in production code.
- The SSE wire-format type names (`card_created`, `ai_role_started`, `confirmation_decided`, etc.) are translated from the storage-format names (`card.created`, `agent_execution.queued`, `human_confirmation.approved`, etc.) via `STORAGE_TO_WIRE_TYPE_MAP` in `apps/web/src/lib/realtime/events.ts`. The UI consumes the wire names only.
- The UI is implemented with React 19 + Tailwind 4 (no new framework, no new build tooling). Components use the `Instrument_Sans` (sans) and `JetBrains_Mono` (mono) fonts already loaded by the root layout.
- Component tests use MSW with recorded route-response fixtures. The API client (`lib/api/client.ts`) is exercised end-to-end in tests; no module-level mocking of the API client.
- The plan file's design commitments (7 numbered commitments) are non-negotiable.
- The bottom-of-main surface is a command line + output feed, NOT a chat input. Slash commands drive the existing REST APIs. Anything not starting with `/` is rejected with `// unrecognised input. type /help.`.

## Scope

### In Scope

The approved plan defines the file tree. The full scope is:

**NEW — Routes (`apps/web/src/app/(app)/`)**
- `layout.tsx` — authenticated three-column shell.
- `goal-spaces/page.tsx` — list page (server component).
- `goal-spaces/[id]/page.tsx` — detail page (server component).
- `goal-spaces/[id]/loading.tsx`, `goal-spaces/[id]/error.tsx` — `EmptyState` rendering.

**NEW — Components (`apps/web/src/components/`)** — 16 components per the plan.

**NEW — Library (`apps/web/src/lib/`)** — `api/{client,types,goal-spaces,node-boards,cards,confirmations,executions}.ts`, `realtime/{useSseStream,replay}.ts`, `theme/{tmTheme,themes}.ts`, `keyboard/{shortcuts,useShortcut,command-parser}.ts`, `state/{board-store,ui-store}.ts`.

**NEW — Tests (`apps/web/src/__tests__/ui/`)** — 8 component tests per the plan.

**MODIFY**
- `apps/web/src/app/layout.tsx` — add inline `<script>` for FOUC-prevention theme.
- `apps/web/src/app/page.tsx` — redirect authenticated sessions to `/goal-spaces`; fall back to existing landing for unauthenticated.
- `apps/web/src/app/globals.css` — add 4 `[data-theme="..."]` selector blocks.

### Out of Scope

- AI / LLM chat surface (no backend support in F2-02..F2-08).
- Drag-and-drop card transitions (the plan explicitly defers this; transitions are triggered from the drawer).
- Production deployment / multi-instance SSE broadcasting.
- Playwright E2E journeys (F2-10 deliverable).
- Mobile-first responsive design beyond "main works at narrow widths" (desktop is primary; medium/small screens collapse the sidebars).
- Real-time typing indicators (the plan rejects this in the 7 commitments).
- Custom theme authoring UI (the 4 themes are pre-defined).
- New design tokens (only existing tokens used; no new tokens introduced).

## Affected Modules

### Existing files (read-only references, not modified)
- `apps/web/db/schema.ts` (data shapes only — UI doesn't import this directly)
- `apps/web/src/lib/realtime/stream.ts` + `events.ts` (SSE server-side + wire-format map)
- `apps/web/src/lib/api/{actor,errors,response,request}.ts` (envelope + error codes)
- `apps/web/src/lib/auth/session.ts` (cookie format)
- `apps/web/src/styles/tokens.css` (CSS variable source)
- `apps/web/src/middleware.ts` (CSRF behavior)
- All F2-02..F2-08 route handlers (consumed via fetch)

### New files
Per the plan file's `§File tree` section — full list of 16 components, 11 library modules, 8 test files, and 4 routes.

### Modified files
- `apps/web/src/app/layout.tsx`
- `apps/web/src/app/page.tsx`
- `apps/web/src/app/globals.css`

## Acceptance Criteria

The implementation passes when ALL of the following are satisfied (cross-referenced with the plan file):

### Routing & shell
1. `GET /` redirects to `/goal-spaces` when authenticated; renders the existing landing when unauthenticated.
2. `GET /goal-spaces` renders the goal-space-list page inside the three-column shell.
3. `GET /goal-spaces/[id]` renders the goal-space detail page inside the three-column shell; opens SSE; replays events on mount.
4. `GET /goal-spaces/[id]` loading state renders `<EmptyState kind="loading">`.
5. `GET /goal-spaces/[id]` error state renders `<EmptyState kind="error">` with `[retry]`.
6. The shell CSS grid is `280px / 1fr / 360px` (left / center / right). `Cmd+B` collapses left, `Cmd+J` collapses right; both use `--motion-move`.

### Components
7. `GoalSpaceList` renders empty / loading / populated states.
8. `NodeBoardView` groups cards by state via `CardLane`s; each lane shows the state's count and a 4px status dot.
9. `CardLane` shows `// no cards in <state>` when empty.
10. `CardRow` shows `card_<id>` (mono), status dot, title (sans), assignee chip.
11. `CardDetailDrawer` has three tabs (`OVERVIEW` / `TRANSITIONS` / `AUDIT`); sticky footer with legal transitions as bordered buttons.
12. `ConfirmationQueue` shows approve/reject buttons that disable during in-flight POST.
13. `ExecutionStatus` shows in-flight AI roles; rows appear/disappear as SSE events arrive.
14. `AuditTimeline` shows chronological mono log; filterable by type.
15. `ThemeSwitcher` shows 4 themes with preview swatches; persists to `localStorage`.
16. `CommandPalette` opens on `Cmd+K`; arrow keys + Enter to activate.
17. `CommandInput` accepts slash commands only; non-`/` input rejected with `// unrecognised input. type /help.`
18. `OutputFeed` shows last 100 entries with success / error / echo variants.
19. `LeftSidebar` shows workspace meta + status bar.
20. `RightSidebar` shows `ExecutionStatus` + `AuditTimeline` + `ThemeSwitcher`.
21. `ConnectionStatusIndicator` shows colored 6px dot reflecting SSE state.
22. `EmptyState` is shared by all loading / empty / error states; never a card.

### SSE
23. `useSseStream` opens exactly one `EventSource` per `(goalSpaceId, page)` even when multiple components subscribe.
24. Events are deduped by `id` (replay + live emits the same id → only one stored).
25. `lastEventId` is persisted to `localStorage` per goal space.
26. Reconnection uses capped backoff (`min(2s * 2^attempts, 30s)`).
27. `EVENT_CURSOR_EXPIRED` (HTTP 410) on the explicit replay fetch triggers snapshot refetch + SSE restart.

### Theme
28. 4 themes are selectable: `dark-codex` (default), `dark-solarized`, `light-paper`, `dark-monokai`.
29. Theme persists in `localStorage` and survives reload (no FOUC).
30. `Cmd+/` cycles to next theme in order.

### Keyboard
31. `Cmd+K` opens palette; `Esc` closes.
32. `[` / `]` navigate goal spaces on list page.
33. `g g` (within 500ms) navigates to list.
34. `Enter` on selected card row opens detail drawer.
35. Tab order is DOM-based; no positive `tabIndex`.

### Verification
36. `pnpm --filter @keplar/web test -- src/__tests__/ui/board-render.test.tsx` passes (required plan test).
37. `pnpm --filter @keplar/web test` passes for all UI tests (8 component tests + 8 module tests).
38. `pnpm --filter @keplar/web typecheck` passes (0 errors).
39. `pnpm --filter @keplar/web lint` passes (0 errors).
40. `pnpm --filter @keplar/web format:check` passes (clean).
41. `git diff --check` passes.
42. No files outside the F2-09 file set or unrelated prior changes are modified (except the 3 documented modifications to layout.tsx / page.tsx / globals.css).

## Risks and Open Questions

| # | Risk / Question | Severity | Resolution |
|---|---|---|---|
| R1 | React Server Components may not serialize `Date` objects in the snapshot prop; this requires the server page to pre-format timestamps to ISO strings before passing to client components. | Low | Resolved: server pages convert all timestamps to ISO 8601 strings before serializing. |
| R2 | EventSource does not surface HTTP status codes for the initial connection, so `EVENT_CURSOR_EXPIRED` handling requires a separate `fetch` call before opening EventSource. | Low | Resolved: the `fetchReplay` helper uses `fetch` and handles 410; the SSE hook then opens with `initialLastEventId = next_after_id ?? null`. |
| R3 | MSW + jsdom + `EventSource` may have polyfill conflicts. | Low | Resolved: tests inject a small `EventSource` shim; MSW only handles HTTP `fetch` mocks. Documented in the test harness. |
| R4 | The `dark-codex` theme is the default — but if `localStorage` has an unknown value, the UI must not crash. | Low | Resolved: `applyTheme` defaults to `'dark-codex'` for missing/unknown values. |
| R5 | The four-theme switcher increases CSS bundle size. | Low | Resolved: each `[data-theme="..."]` block is ~30 lines; total impact < 1KB compressed. |
| R6 | Plan §8 explicitly forbids free-form chat. Future phases may want to add one. | Low | Resolved: deferred. F2-09 ships the command surface only. |
| R7 | The `Tab` order depends on DOM order; accidentally-added positive `tabIndex` would break the queue. | Low | Resolved: ESLint config should forbid `tabIndex > 0`; if not, code review must enforce. |
| Q1 | Should the goal-space-list page also subscribe to SSE? | — | Resolved: No. The list page is a server component that re-fetches on navigation. SSE is detail-page only. |
| Q2 | Should `output-feed` persist across navigation? | — | Resolved: No. The output feed is per-page state; navigating away clears it. This is intentional — commands are scoped to the current goal space. |

## Reuse Summary (no new primitives)

| Concern | Reused from | File |
|---|---|---|
| Design tokens | F2-00 / F2-01 | `apps/web/src/styles/tokens.css` |
| Tailwind 4 bridge | F2-00 / F2-01 | `apps/web/src/app/globals.css` (`:root` block) |
| Session cookie | F2-02 | `apps/web/src/lib/auth/session.ts` |
| Realtime wire format | F2-08 | `apps/web/src/lib/realtime/events.ts` |
| SSE server endpoint | F2-08 | `apps/web/src/app/api/v1/sse/route.ts` |
| Replay endpoint | F2-08 | `apps/web/src/app/api/v1/goal-spaces/[id]/events/route.ts` |
| `keplar_session` middleware | F2-02 | `apps/web/src/middleware.ts` |
| API envelope | F2-02..F2-07 | `apps/web/src/lib/api/response.ts` |
| API error codes | F2-02..F2-08 | `apps/web/src/lib/api/errors.ts` |

## Sequencing

1. Phase 1: Request Analysis (this document) — human approval.
2. Phase 2: Review — risk matrix re-checked.
3. Phase 3: Implementation via TDD (RED → GREEN → REFACTOR):
   - Library foundation: `lib/api/{client,types}.ts`, `lib/realtime/replay.ts`.
   - Hook: `lib/realtime/useSseStream.ts`.
   - Theme: `lib/theme/{tmTheme,themes}.ts`.
   - Keyboard: `lib/keyboard/{shortcuts,command-parser,useShortcut}.ts`.
   - Stores: `lib/state/{board-store,ui-store}.ts`.
   - Per-endpoint API wrappers: `lib/api/{goal-spaces,node-boards,cards,confirmations,executions}.ts`.
   - Components: per-file in dependency order (presentational before container).
   - Shell: `app/(app)/layout.tsx`.
   - Pages: `app/(app)/goal-spaces/page.tsx`, `app/(app)/goal-spaces/[id]/page.tsx`.
   - Modify: `app/layout.tsx`, `app/page.tsx`, `app/globals.css`.
   - Tests: 8 component tests, written first.
4. Phase 4: Testing — automated + manual smoke.
5. Phase 5: Delivery — `delivery/summary.md` + `handoff.md`.

## Next-Step Hint

F2-10 (E2E + delivery docs) is the immediate follow-up. It should:

- Add Playwright e2e happy path per `plan/2026-06-19-phase2-web-collaboration-beta.md` F2-10 spec.
- Update CI to run `pnpm check && pnpm smoke && pnpm e2e`.
- Add `apps/web/playwright.config.ts` and `apps/web/e2e/phase2-board.spec.ts`.
- Update `package.json` scripts (`e2e`, `e2e:ui`, `smoke`).
- Update `docs/architecture/test_matrix.md` and `docs/specs/phase1_scope.md` with Phase 2 completion notes.

F2-09's deliverable is the Web UI shell + 3-column layout + 4 themes + slash-command surface + SSE integration. F2-10 is the Playwright verification + production-grade docs.