<!-- Generated: 2026-07-06 | Files scanned: 30+ components | Token estimate: ~650 -->

# KEPLAR — Frontend Codemap (Next.js App Router)

## Stack

Next.js 15 (App Router) + React 19 + TypeScript strict + Tailwind 4 (CSS-first tokens).
Design system: `DESIGN.md` (dark slate `#0B0F19` + cool blue `#0EA5E9`, Instrument Sans
+ JetBrains Mono). Tokens bridged via `apps/web/src/styles/tokens.css` +
`apps/web/src/app/globals.css`. **Hardcoding hex/px in components is forbidden.**

## Page tree (`apps/web/src/app/`)

```
/
├─ page.tsx                        # root (redirect/landing)
├─ layout.tsx                      # root layout, providers, theme
├─ login/
│  └─ page.tsx                     # login form
└─ (app)/                          # authenticated route group
   ├─ layout.tsx                   # app-shell wrapper
   └─ goal-spaces/
      ├─ page.tsx                  # list view
      └─ [id]/
         ├─ page.tsx               # detail (master + primary + detail panes)
         └─ tasks/
            └─ [taskId]/page.tsx   # task-level timeline view
```

## Component hierarchy

```
AppShell (app-shell.tsx)
├─ TopBar (top-bar.tsx)
├─ ThemeSwitcher (theme-switcher.tsx)
├─ ConnectionStatusIndicator (connection-status-indicator.tsx)
├─ MasterPane (master-pane.tsx) — left
│  ├─ SettingsBar (master-pane/settings-bar.tsx)
│  └─ WorkspaceSection (master-pane/workspace-section.tsx)
├─ PrimaryPane (primary-pane.tsx) — center
│  └─ GoalSpaceKanbanView (primary-pane/goal-space-kanban-view.tsx)
│     ├─ CardLane (card-lane.tsx)
│     │  └─ CardRow (card-row.tsx)
│     └─ CardDetailDrawer (card-detail-drawer.tsx)
├─ DetailPane (detail-pane.tsx) — right
│  ├─ AiPanel (detail-pane/ai-panel.tsx)
│  ├─ CardRuntime (detail-pane/card-runtime.tsx)
│  └─ WorkspacePanel (detail-pane/workspace-panel.tsx)
├─ RightSidebar (right-sidebar.tsx)
│  └─ ConfirmationQueue (confirmation-queue.tsx)
└─ GoalSpaceShell (goal-space-shell.tsx) — outer container
   ├─ GoalSpaceList (goal-space-list.tsx)
   ├─ CreateGoalSpaceForm (create-goal-space-form.tsx)
   ├─ CreateNodeBoardForm (create-node-board-form.tsx)
   ├─ NodeBoardView (node-board-view.tsx)
   ├─ OutputFeed (output-feed.tsx)
   ├─ AuditTimeline (audit-timeline.tsx)
   └─ ExecutionStatus (execution-status.tsx)

TaskTimelineView (timeline/task-timeline-view.tsx)
├─ TimelineMessage (timeline/timeline-message.tsx)
└─ MessageInput (timeline/message-input.tsx)

CommandPalette (command-palette.tsx)
└─ CommandInput (command-input.tsx)
```

## State management (client-side)

`apps/web/src/lib/state/`:

| Store | Purpose |
|---|---|
| `agents-store.ts` | AI execution state, current role, polling |
| `board-store.ts` | Board/kanban selection, drag state |
| `context-store.ts` | Per-card context (YAML drafts, attached files) |
| `tokens-store.ts` | Auth token + user session cache (HttpOnly cookie dominant) |
| `ui-store.ts` | Theme, sidebar collapsed, modals, toasts |

> **Server state** (goal-spaces, cards, executions) lives in REST responses +
> SSE stream; **client state** is UI-only. URL state for filters/active GS.

## Realtime client (`lib/realtime/`)

| Module | Purpose |
|---|---|
| `stream.ts` | SSE connection (one per profile+GS via BroadcastChannel leader/follower) |
| `replay.ts` | One-shot replay via `GET /api/v1/goal-spaces/:id/events?after_id=...` |
| `events.ts` | Type definitions for 13 event types |
| `useSseStream.ts` | React hook binding stream → store |

**Event types** (13): `card_created`, `card_state_changed`, `card_blocked`,
`ai_role_started`, `ai_role_completed`, `ai_role_failed`, `confirmation_requested`,
`confirmation_decided`, `goal_space_updated`, `goal_space_cancelled`,
`session_started`, `session_completed`, `session_failed`.

## Keyboard & commands (`lib/keyboard/`)

- `shortcuts.ts`, `useShortcut.ts` — global key bindings
- `shortcut-provider.tsx` — context provider
- `command-parser.ts` — slash-command parser
- `command-palette.tsx` — UI surface

## Styling & theme (`lib/theme/` + `src/styles/`)

- `styles/tokens.css` — Tailwind 4 CSS variables (DESIGN.md tokens)
- `app/globals.css` — base styles + Tailwind import
- `lib/theme/themes.ts` — theme registry
- `lib/theme/tmTheme.ts` — terminal/editor theme tokens

## API client (`lib/api/`)

| Module | Purpose |
|---|---|
| `client.ts` | Typed fetch wrapper |
| `request.ts` | Request builder (cookies, headers) |
| `response.ts` | `ApiResponse<T>` / `ApiError` envelope parsing |
| `errors.ts` | Error code → typed exception mapping |
| `pagination.ts` | `page`/`limit`/`has_more` helpers |
| `types.ts` | Shared DTOs |
| `actor.ts` | Current user actor extraction |
| Resource clients | `cards.ts`, `goal-spaces.ts`, `node-boards.ts`, `confirmations.ts`, `executions.ts` |

## Test gates

- `apps/web/src/components/__tests__/**` — component unit tests (Vitest + Testing Library)
- `apps/web/__tests__/ui/**` — page-level smoke tests
- `apps/web/e2e/**` — Playwright (`phase2-board.spec.ts`, `master-pane.spec.ts`,
  `task-timeline.spec.ts`, `frontend-polish.spec.ts`)

## Cross-references

- See `backend.md` for the API contract these clients call.
- See `data.md` for the entity shapes mirrored in DTOs.
- See `architecture.md` for the read/write path (incl. SSE lifecycle).