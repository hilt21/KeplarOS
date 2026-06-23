# F2-09 Web UI — Implementation Tasks

Change ID: `20260619-phase2-web-ui`
Status: request_analysis

## Conventions

- Strict TDD: every task begins with a failing test, then minimal GREEN implementation, then REFACTOR.
- Tests live at `apps/web/src/__tests__/ui/*.test.tsx` with MSW handlers for API + small EventSource shim for SSE.
- All routes use the (app) route group.
- All components use `--color-*`, `--space-*`, `--radius-*`, `--motion-*`, `--font-*` tokens. No hex codes or pixel values in new files.
- The bottom-of-main interaction is a slash-command surface + output log. No free-form chat.

---

## T1. API client foundation

**RED** — write `src/__tests__/api/client.test.ts` covering: 200 success path, 4xx error envelope, 410 cursor-expired callback, query param serialization.

**GREEN** — implement `apps/web/src/lib/api/client.ts`:
- `apiRequest<T>(path, opts)` and `apiGet<T>(path, opts)` typed wrappers.
- `credentials: 'include'` for cookie auth.
- Envelope parsing; throws `ApiClientError` on `success === false`.
- `onCursorExpired` callback for `EVENT_CURSOR_EXPIRED`.

**REFACTOR** — extract URL builder helper.

## T2. Wire types

**RED** — none (types only).

**GREEN** — implement `apps/web/src/lib/api/types.ts` with response shapes matching F2-03..F2-07 service returns: `GoalSpaceResponse`, `CardResponse`, `CardDetailResponse`, `StateTransitionResponse`, `HumanConfirmationResponse`, `ExecuteStatusResponse`, etc.

**REFACTOR** — none.

## T3. Replay fetch helper

**RED** — write `src/__tests__/lib/realtime/replay.test.ts` covering: 200 success path, 410 cursor-expired throws `EVENT_CURSOR_EXPIRED`.

**GREEN** — implement `apps/web/src/lib/realtime/replay.ts`:
- `fetchReplay(goalSpaceId, afterId): Promise<{ events, hasMore, nextAfterId? }>`.

**REFACTOR** — none.

## T4. SSE client hook

**RED** — write `src/__tests__/lib/realtime/useSseStream.test.tsx` (and `__tests__/ui/sse-dedup.test.ts`) covering: hook subscribes to EventSource, dedup by id, status transitions, reconnect with backoff, EVENT_CURSOR_EXPIRED via replay.

**GREEN** — implement `apps/web/src/lib/realtime/useSseStream.ts`:
- Module-scoped `Map<goalSpaceId, EventSource>` for shared connections.
- Subscribe to wire-format event types.
- Dedup via `Set<event.id>` keyed by goalSpaceId.
- Persist `lastEventId` to `localStorage`.
- Reconnect with capped exponential backoff.
- Heartbeat staleness detection (45s).
- Status field: `idle | connecting | live | reconnecting | stale | error`.

**REFACTOR** — extract EventSource management into a separate module.

## T5. Theme system

**RED** — write `src/__tests__/lib/theme/tmTheme.test.ts` covering: default theme, switching themes, invalid stored value, FOUC script.

**GREEN** — implement:
- `apps/web/src/lib/theme/themes.ts` — 4 theme objects (color overrides only).
- `apps/web/src/lib/theme/tmTheme.ts` — `TmThemeId` type, `applyTheme`, `getStoredTheme`.
- `apps/web/src/app/globals.css` — add 4 `[data-theme="..."]` selector blocks.
- `apps/web/src/app/layout.tsx` — inline `<script>` in `<head>` for FOUC prevention.

**REFACTOR** — none.

## T6. Keyboard system

**RED** — write `src/__tests__/lib/keyboard/shortcuts.test.ts` and `keyboard.test.tsx` covering: shortcut registration, Cmd+K / Cmd+B / Cmd+J / Cmd+/ chords, `[` / `]` / `g g`, parseChord normalization.

**GREEN** — implement:
- `apps/web/src/lib/keyboard/shortcuts.ts` — `Shortcut` registry + `parseChord`.
- `apps/web/src/lib/keyboard/useShortcut.ts` — React hook.
- `apps/web/src/lib/keyboard/command-parser.ts` — slash command parser.

**REFACTOR** — none.

## T7. State stores

**RED** — none (small pure state).

**GREEN** — implement:
- `apps/web/src/lib/state/board-store.ts` — module-scoped `Map<goalSpaceId, BoardState>`.
- `apps/web/src/lib/state/ui-store.ts` — sidebar collapsed states, theme id, selected card id.

**REFACTOR** — none.

## T8. Per-endpoint API wrappers

**RED** — none (thin wrappers).

**GREEN** — implement:
- `apps/web/src/lib/api/goal-spaces.ts`
- `apps/web/src/lib/api/node-boards.ts`
- `apps/web/src/lib/api/cards.ts`
- `apps/web/src/lib/api/confirmations.ts`
- `apps/web/src/lib/api/executions.ts`

Each exports typed functions that wrap `apiRequest`/`apiGet`.

**REFACTOR** — share common patterns.

## T9. Primitive components

**RED** — none (visuals).

**GREEN** — implement:
- `apps/web/src/components/empty-state.tsx` — shared loading/empty/error renderer.
- `apps/web/src/components/connection-status-indicator.tsx` — 6px dot.
- `apps/web/src/components/theme-switcher.tsx` — dropdown.

**REFACTOR** — none.

## T10. List components

**RED** — write `src/__tests__/ui/goal-space-list.test.tsx` covering: empty, loading, populated.

**GREEN** — implement:
- `apps/web/src/components/goal-space-list.tsx` — table-style list.
- `apps/web/src/components/left-sidebar.tsx` — workspace overview.

**REFACTOR** — none.

## T11. Board + lane + row components

**RED** — write `src/__tests__/ui/board-render.test.tsx` (required plan test) covering: 3 boards × 10 cards grouped by state, click fires `onSelectCard`.

**GREEN** — implement:
- `apps/web/src/components/node-board-view.tsx`
- `apps/web/src/components/card-lane.tsx`
- `apps/web/src/components/card-row.tsx`
- `apps/web/src/components/goal-space-shell.tsx`

**REFACTOR** — none.

## T12. Card detail drawer

**RED** — write `src/__tests__/ui/card-detail-drawer.test.tsx` covering: 3 tabs, fixture card with 4 transitions + 2 audit.

**GREEN** — implement `apps/web/src/components/card-detail-drawer.tsx` — slides in from right, 3 tabs (OVERVIEW/TRANSITIONS/AUDIT), sticky footer with legal transitions.

**REFACTOR** — none.

## T13. Confirmation + execution + audit panels

**RED** — write tests for each panel.

**GREEN** — implement:
- `apps/web/src/components/confirmation-queue.tsx` — approve/reject buttons.
- `apps/web/src/components/execution-status.tsx` — in-flight AI roles.
- `apps/web/src/components/audit-timeline.tsx` — chronological log.

**REFACTOR** — none.

## T14. Command surface

**RED** — none (interactive, manually verified).

**GREEN** — implement:
- `apps/web/src/components/command-input.tsx` — single-line input.
- `apps/web/src/components/output-feed.tsx` — last 100 entries.
- `apps/web/src/components/command-palette.tsx` — `Cmd+K` modal.

**REFACTOR** — none.

## T15. Shell layout

**RED** — none (visuals).

**GREEN** — implement `apps/web/src/app/(app)/layout.tsx` — header + 3-column CSS grid + ShortcutProvider + useSseStream mount.

**REFACTOR** — none.

## T16. Pages

**RED** — none (server components).

**GREEN** — implement:
- `apps/web/src/app/(app)/goal-spaces/page.tsx` — list (server component).
- `apps/web/src/app/(app)/goal-spaces/[id]/page.tsx` — detail (server component).
- `apps/web/src/app/(app)/goal-spaces/[id]/loading.tsx` — `EmptyState kind="loading"`.
- `apps/web/src/app/(app)/goal-spaces/[id]/error.tsx` — `EmptyState kind="error"`.
- `apps/web/src/app/page.tsx` — MODIFY: redirect to `/goal-spaces` if authenticated.

**REFACTOR** — none.

## T17. Theme CSS extension

**RED** — none (CSS only).

**GREEN** — add 4 `[data-theme="..."]` selector blocks to `apps/web/src/app/globals.css`. Do NOT modify the existing `:root` block.

**REFACTOR** — none.

## T18. Verification

- `pnpm --filter @keplar/web test -- src/__tests__/ui/board-render.test.tsx` — required plan test.
- `pnpm --filter @keplar/web test` — full UI test suite.
- `pnpm --filter @keplar/web typecheck` — 0 errors.
- `pnpm --filter @keplar/web lint && pnpm --filter @keplar/web format:check` — clean.
- `git diff --check` — clean.

## T19. Delivery artifacts

- `.harness/changes/20260619-phase2-web-ui/implementation/notes.md`
- `.harness/changes/20260619-phase2-web-ui/testing/results.md`
- `.harness/changes/20260619-phase2-web-ui/delivery/summary.md`
- `.harness/changes/20260619-phase2-web-ui/handoff.md`

## T20. Update `feature_list.json` + `sprint_progress.md`

- Mark `F2-09` `implementation_status: completed`, `test_status: passed`, `done_status: completed`.

## Sequencing Rules

- One task at a time. Do not start T(N+1) until T(N) is GREEN + REFACTOR + tests stay green.
- Tests are RED-first — write the failing test, watch it fail, then implement.
- If a deviation from `spec.md` is needed, document it in `implementation/notes.md` immediately and stop if it requires returning to Phase 1 / Phase 2.
- Components are built in dependency order: primitives → list → board → drawer → panels → shell → pages.
- Library modules are built bottom-up: types → client → per-endpoint wrappers → hook → stores.
- The `app/page.tsx` redirect and `app/layout.tsx` FOUC script are the LAST modifications; they depend on the auth and theme foundations being complete.