# KEPLAR Frontend Polish Spec

**Version:** 0.1 (draft)
**Date:** 2026-06-29
**Author:** Application Owner
**Status:** Draft, awaiting user review
**Reference:** [DESIGN.md](../../DESIGN.md) is the design system source of truth (color / typography / spacing tokens). This spec is a **polish** document — it describes only what changes on top of DESIGN.md.

---

## 1. Product Overview

KEPLAR is a multi-agent task collaboration platform for enterprise board presentations (railway / mechanical industry). The current web UI renders, but is "差强人意" (mediocre) along three axes that the user identified in the kickoff:

1. **Motion lacks soul** — the existing minimal-functional motion language doesn't differentiate system activity, AI activity, and user activity.
2. **Visual hierarchy is unclear** — primary workspace, secondary panels, and tertiary detail all carry equal visual weight.
3. **Typography roles are ambiguous** — Instrument Sans and JetBrains Mono both appear throughout, but without a clear rule for when to use which.

This spec defines the polish work that addresses those three gaps, plus a related architectural change: a **persistent multi-pane shell with master-detail navigation**, adapted from the public Codex CLI architecture to fit KEPLAR's Goal Space → Node Board → Card domain model.

### 1.1 Out of Scope (explicit non-goals)

- Re-defining the design system color / typography / spacing tokens (those stay in DESIGN.md).
- Building new pages or routes unrelated to the polish work.
- Replacing the existing Card detail drawer with a different modal system (the drawer is still used in the Goal Space view for quick card inspection).
- Performance rewrites, accessibility overhaul, or any of the Future/Production NFR items in [docs/specs/non_functional_requirements.md](../../specs/non_functional_requirements.md).

---

## 2. Design Principles

The polish work obeys four principles, in priority order.

### 2.1 Show what's running, not just what exists

A static "card list" is not enough. The user must always be able to tell which AI role is working, on which task, and for how long. Every active state gets a **persistent visual indicator** (status dot, color, or pulse) that survives scroll and route changes.

### 2.2 Master-detail, not modal

Drill-down into a task should **swap the central pane**, not open a modal. The shell stays mounted; the user's context is preserved (master list, detail panel) so they can move between tasks without losing their place.

### 2.3 Typography follows role, not taste

A new **Typographic Role** table is added to DESIGN.md (see §6.3). The rule is: **Inter for prose and human-readable content, JetBrains Mono for machine-readable data**. Any new component must declare its typographic role.

### 2.4 Polish in place, not a redesign

All existing KEPLAR design tokens (color, spacing, radius, border) are preserved. Polish is delivered through **motion + hierarchy + role assignment**, not by introducing new colors or fonts.

---

## 3. Information Architecture

### 3.1 Two views, one shell

KEPLAR's primary work surface operates in two contexts that share a single persistent shell:

| View | Triggered by | Primary content | Detail content |
|------|--------------|------------------|----------------|
| **Goal Space view** | URL `/goal-spaces/[id]` | Kanban board + AI live feed + CommandInput | Workspace + AI roles + Card runtime accordion |
| **Task view** | URL `/goal-spaces/[id]/tasks/[taskId]` | Timeline (conversational UI of agent execution) | Workspace + AI roles + Card runtime accordion |

Both views use the **same 3-pane shell**:

```
+-------------------------------------------------------+
| TopBar: KEPLAR / <goal space> / <board> / <task>     |
+--------------+----------------------------+----------+
|              |                            |          |
| Master Pane  | Primary Pane              | Detail   |
| (workspaces) | (kanban OR timeline)      | Pane     |
|              |                            | (4-zone) |
|              |                            |          |
+--------------+----------------------------+----------+
| Settings (left bottom)                                |
+-------------------------------------------------------+
```

**Shell persistence**: the 3-pane DOM structure never unmounts. Switching between Goal Space view and Task view swaps the content of the **Primary Pane only**; the Master Pane and Detail Pane are kept mounted, retaining their state.

### 3.2 URL contract

| Route | View | Primary Pane content |
|-------|------|----------------------|
| `/goal-spaces/[id]` | Goal Space | Kanban + AI feed + CommandInput |
| `/goal-spaces/[id]/tasks/[taskId]` | Task | Timeline of agent execution + Reply input |

The TopBar breadcrumbs mirror this URL contract and are **clickable** to navigate between segments.

---

## 4. Layout Specification

### 4.1 Desktop layout (≥ 1280px)

| Region | Width | Notes |
|--------|-------|-------|
| Master Pane | `280px` | Fixed; goal-space-grouped task list + Settings at bottom |
| Primary Pane | `1fr` | Fluid; minimum `480px` |
| Detail Pane | `320px` | Fixed; 4-zone (Workspace / AI Roles / Card Runtime) |
| TopBar | `48px` | Reduced from current 64px to give more vertical space to the Primary Pane |
| Input area (within Primary) | `auto (96–160px)` | Multi-line textarea with Send button |

```
+--------------------------------------------------+
| TopBar (48px)                                    |
+------+---------------------------------+---------+
|      |                                 |         |
| Mast | Primary Pane                    | Detail  |
| 280  | (fluid, min 480)                | 320     |
|      |                                 |         |
|      +---------------------------------+         |
|      | Input (96–160)                  |         |
+------+---------------------------------+---------+
| Settings (40px) at Master Pane bottom            |
+--------------------------------------------------+
```

### 4.2 Component grid (within Master Pane)

The Master Pane has two vertically-stacked regions:

| Region | Height | Content |
|--------|--------|---------|
| Top scroll area | `flex: 1; overflow-y: auto` | New button + Search + goal-space sections |
| Bottom fixed | `auto` (~40px) | User chip + Settings ⚙ |

### 4.3 Component grid (within Detail Pane, 320px wide)

The Detail Pane has 4 vertically-stacked zones, each with its own border-bottom:

| Zone | Default state | Content |
|------|---------------|---------|
| Workspace | Always visible | `goal / board / user / runtime / api / tokens` (mono key-value) + token bar |
| AI Roles | Always visible | 6 roles with status dot + name + state text |
| Card Runtime | Always visible | CARD id + state badge + assignee + accordion header |
| Card Runtime (children) | First (Modified files) expanded by default; others collapsed | Per-accordion content |

Detail Pane scrolls vertically when the combined height exceeds the viewport.

---

## 5. Responsive Rules

### 5.1 Desktop (≥ 1280px)

Three columns as in §4.1. All zones fully visible.

### 5.2 Tablet (768–1279px)

- Master Pane collapses to a 240px rail; Detail Pane can be toggled via a Right-sidebar button in the TopBar.
- Primary Pane fills the remaining width.
- If both rails are visible, Primary Pane minimum shrinks to 360px.

### 5.3 Mobile (< 768px)

Single-column stack:

1. TopBar (compact, 40px).
2. Primary Pane (full width).
3. Bottom sheet for Master and Detail panes, toggled via tab buttons.

The Task view's Timeline is the primary surface on mobile; the kanban in Goal Space view stacks vertically with horizontal swipe between lanes.

---

## 6. Design Tokens

This spec **does not introduce new tokens**. All colors, spacing, radii, and shadows are inherited from [DESIGN.md](../../DESIGN.md). The polish work uses only the existing `--color-*` and `--space-*` variables.

### 6.1 New motion tokens (additive to DESIGN.md)

Motion is the only category where new tokens are introduced, because the existing motion language is too generic.

| Token | Value | Usage |
|-------|-------|-------|
| `--motion-message-enter` | `cubic-bezier(0.16, 1, 0.3, 1); 280ms` | New timeline message / tool result fade-in with translateY(8px) → 0 |
| `--motion-pulse` | `cubic-bezier(0.4, 0, 0.6, 1); 1600ms infinite` | AI role "running" state dot, in-flight tool call border |
| `--motion-highlight` | `ease-out; 800ms` | Card state change temporary highlight (backlog → todo etc.) |
| `--motion-route` | `cubic-bezier(0.16, 1, 0.3, 1); 240ms` | Pane content swap (Goal Space → Task) |
| `--motion-collapse` | `ease-in-out; 200ms` | Accordion expand / collapse |

These are declared as CSS custom properties on `:root` in `apps/web/src/app/globals.css` (or the equivalent token file in the existing project). They are the only new tokens added by this spec.

### 6.2 No new colors, fonts, or spacing

- Colors: only existing `--color-*` tokens. New status colors that the polish needs (e.g. an in-flight status) reuse `--color-info` (`#6366F1`).
- Fonts: Inter (display / body / UI) and JetBrains Mono (data) — already loaded.
- Spacing: only existing `--space-*` tokens.
- Radii / shadows: only existing tokens.

If a polish surface cannot be expressed with the existing tokens, raise it during implementation; do not silently add a new token.

### 6.3 Typographic Role table (additive to DESIGN.md)

The existing DESIGN.md defines a Type scale. This spec adds a **Role table** that maps surface to font choice:

| Surface | Font | Size (px) | Weight | Letter-spacing | Notes |
|---------|------|-----------|--------|----------------|-------|
| Goal space display name | Inter | 18 | 600 | normal | TopBar breadcrumb segment |
| Card display title | Inter | 18 | 600 | normal | Primary Pane header in Task view |
| Goal name in Master list | Inter | 12 | 400 | normal | Single-line, ellipsis on overflow |
| Task title in Master list | Inter | 12 | 400 (selected: 500) | normal | Single-line, ellipsis on overflow |
| Section caption (WORKSPACE, AI ROLES, …) | Inter | 10 | 500 | 0.05em | Uppercase, `--color-text-muted` |
| Body prose (agent messages, plan) | Inter | 12 | 400 | normal | line-height 1.6 |
| Body prose (selected / focused) | Inter | 12 | 500 | normal | Slight weight bump for selection state |
| Data mono (display_id, token count, time) | JetBrains Mono | 10 | 400 | normal | `--color-text-secondary` or `--color-text-muted` |
| Data mono (state badge, role name) | JetBrains Mono | 10 | 500 | normal | Aligned with state color token |
| Code in tool / patch messages | JetBrains Mono | 11 | 400 | normal | Background `--color-surface-elevated` |

The rule: **Inter for content a human reads as prose; JetBrains Mono for content a human reads as data**. State badges and counters are data, not prose.

---

## 7. Component Architecture

The polish work introduces or modifies the following components. Existing components are noted with their existing path.

| Component | Path | Status | Notes |
|-----------|------|--------|-------|
| `AppShell` | `apps/web/src/components/app-shell.tsx` (new) | New | Persistent 3-pane wrapper; renders TopBar + Master + Primary + Detail slots |
| `MasterPane` | `apps/web/src/components/master-pane.tsx` (new) | New | Workspaces list + Settings; replaces `goal-space-shell.tsx`'s left rail |
| `PrimaryPane` | `apps/web/src/components/primary-pane.tsx` (new) | New | Wraps either `<GoalSpaceKanbanView>` or `<TaskTimelineView>` based on route |
| `DetailPane` | `apps/web/src/components/detail-pane.tsx` (new) | New | 4-zone persistent; rendered in both Goal Space and Task views |
| `TopBar` | `apps/web/src/components/top-bar.tsx` (new) | New | Breadcrumb; persistent across views |
| `WorkspacePanel` | `apps/web/src/components/detail-pane/workspace-panel.tsx` (new) | New | Zone 1: goal / board / user / runtime / api / tokens |
| `AIPanel` | `apps/web/src/components/detail-pane/ai-panel.tsx` (new) | New | Zone 2: 6 AI role rows with status |
| `CardRuntime` | `apps/web/src/components/detail-pane/card-runtime.tsx` (new) | New | Zone 3 + 4: card meta + accordion sections |
| `TaskTimelineView` | `apps/web/src/components/timeline/task-timeline-view.tsx` (new) | New | Primary Pane content for `/tasks/[id]` |
| `TimelineMessage` | `apps/web/src/components/timeline/timeline-message.tsx` (new) | New | 5 message variants (user / agent / tool / confirmation / system) |
| `MessageInput` | `apps/web/src/components/timeline/message-input.tsx` (new) | New | Multi-line reply input at bottom of Timeline |
| `GoalSpaceList` | `apps/web/src/components/master-pane/goal-space-list.tsx` (new) | New | Goal-space-grouped task list (replaces flat task list in current `goal-space-list.tsx`) |
| `SettingsBar` | `apps/web/src/components/master-pane/settings-bar.tsx` (new) | New | Bottom-of-master user chip + ⚙ |
| `GoalSpaceKanbanView` | (existing — `goal-space-shell.tsx` content) | Modified | Becomes one of the two Primary Pane variants |
| `CardDrawer` | `apps/web/src/components/card-detail-drawer.tsx` (existing) | Unchanged | Still used in Goal Space view for quick card inspection |
| `CommandInput` | `apps/web/src/components/command-input.tsx` (existing) | Unchanged | Used only in Goal Space view |

New components are listed with their target path. The implementation plan will refine these paths.

### 7.1 Component dependencies

```
AppShell
├── TopBar
├── MasterPane
│   ├── GoalSpaceList (renders <WorkspaceSection> for each goal space)
│   └── SettingsBar
├── PrimaryPane
│   ├── (route=goal-space) → GoalSpaceKanbanView
│   │                          └── CommandInput
│   └── (route=task) → TaskTimelineView
│                       └── TimelineMessage × N
│                       └── MessageInput
└── DetailPane
    ├── WorkspacePanel
    ├── AIPanel
    └── CardRuntime (Accordion root)
        ├── ModifiedFilesSection (default expanded)
        ├── PlanSection
        └── AuditSection
```

`AppShell` owns the layout grid. `PrimaryPane` decides which view to render based on the current route (read via `usePathname` or a context prop).

---

## 8. Core Components

### 8.1 AppShell

**File:** `apps/web/src/components/app-shell.tsx` (new)

**Responsibilities:**
- Render the persistent 3-pane grid layout (per §4.1).
- Hold the TopBar.
- Provide a React context (`AppShellContext`) for descendant panes to access shared state (current route, current goal space id, current task id).

**Props:**

```ts
interface AppShellProps {
  readonly goalSpaceId: string;
  readonly taskId?: string;
  readonly children: React.ReactNode;
}
```

`taskId` is optional: when omitted, the shell renders the Goal Space view in the Primary Pane. When present, it renders the Task view.

**Persistence guarantee:** `AppShell` must be a client component that does NOT remount when navigating between `/goal-spaces/[id]` and `/goal-spaces/[id]/tasks/[taskId]`. This is achieved by hoisting it to the `(app)` route group layout (`apps/web/src/app/(app)/layout.tsx`) so both child routes share it.

**Routing pattern:**

```
app/
├── (app)/
│   ├── layout.tsx              ← renders <AppShell>
│   ├── page.tsx                ← redirect to /goal-spaces
│   └── goal-spaces/
│       ├── page.tsx            ← goal space list
│       └── [id]/
│           ├── page.tsx        ← goal space view (kanban)
│           └── tasks/
│               └── [taskId]/
│                   └── page.tsx  ← task view (timeline)
```

The `(app)/layout.tsx` is a server component that fetches the current user / goal space header and passes to the client `AppShell`. Each leaf `page.tsx` is a server component that fetches the relevant data and passes to a client view component (`GoalSpaceKanbanView` or `TaskTimelineView`).

### 8.2 TopBar

**File:** `apps/web/src/components/top-bar.tsx` (new)

**Responsibilities:**
- Render the breadcrumb: `KEPLAR / <goal space> / <board> / <task>`.
- Each segment is a clickable link (except the current segment, which is bold and non-clickable).
- Right side: token usage display (mono) + CMD-K palette trigger.

**Visual:**
- 48px height, `--color-bg` background, 1px bottom border `--color-border`.
- Breadcrumb segments separated by `/` in `--color-text-muted`.
- Current segment: `--color-text-primary`, weight 600.
- Clickable segments: `--color-text-secondary`, hover `--color-text-primary`, hover background `rgba(255,255,255,0.04)`.

### 8.3 MasterPane

**File:** `apps/web/src/components/master-pane.tsx` (new)

**Sub-regions:**

1. **Top (scrollable):**
   - "WORKSPACES" caption + "+ NEW" button.
   - Search input (placeholder "filter tasks…").
   - `GoalSpaceList` rendering one or more `<WorkspaceSection>` items.

2. **Bottom (fixed, 40px):**
   - `SettingsBar`: avatar chip (first letter of user name) + user name + role/workspace caption + ⚙ icon.

**WorkspaceSection:**

For each goal space the current user has access to, render a section header:

```
[▾] [R] Railway Metro 2026 Q1        5
    [●] CARD-001  Track geometry        3d
    [●] CARD-002  Risk register         1w
    ...
```

- Header: chevron + colored icon chip (first letter, color hashed from goal space name) + name (single-line, ellipsis) + task count.
- Children: tasks under this goal space, each: status dot + display_id + title + relative time.
- Selected task: highlighted background + left border, in current state color.

**Expand/collapse:**

- Default: all sections expanded.
- Click chevron to collapse; chevron toggles ▾/▸.
- Collapsed section still shows the header and count; tasks hidden.
- Collapsed state persisted per goal space in `localStorage` (key: `keplar.master.expanded.${goalSpaceId}`).

**Sort order:**

- Goal spaces sorted by most recent activity (descending `updated_at`).
- Tasks within each section sorted by status priority: `dev` (in-flight) → `review` → `todo` → `backlog` → `done` → `blocked` → `cancelled`; then by `updated_at` desc.

**Click behavior:**

- Click on a task → navigate to `/goal-spaces/[goalSpaceId]/tasks/[taskId]` (in-place shell, primary pane swaps).
- Click on a goal space section header → navigate to `/goal-spaces/[goalSpaceId]` (primary pane shows kanban).

### 8.4 PrimaryPane

**File:** `apps/web/src/components/primary-pane.tsx` (new)

**Responsibilities:**
- Read the current route.
- Render `GoalSpaceKanbanView` (kanban + AI feed + CommandInput) or `TaskTimelineView` (timeline + message input) accordingly.
- Animate the swap with `--motion-route` (240ms opacity + 8px translateY).

**Internal state:** none of its own; it composes the existing views.

### 8.5 DetailPane

**File:** `apps/web/src/components/detail-pane.tsx` (new)

**Sub-regions (4 zones, each 1px border-bottom, scroll together):**

1. **WorkspacePanel** (always visible):
   - "WORKSPACE" caption + dev badge.
   - Mono key-value list: `goal`, `board`, `user` (name + role), `runtime` (Next.js + React versions), `api` (base path, ellipsis on overflow), `tokens` ("used / cap" + progress bar).
   - Token bar: 4px height, `--color-surface-elevated` background, `--color-info` fill at usage %.

2. **AIPanel** (always visible):
   - "AI ROLES" caption.
   - 6 rows, one per role: 6px state dot + role name + state text.
   - State colors: idle = `--color-success`, queued = `--color-warning`, running = `--color-info` with `--motion-pulse`, error = `--color-error`.
   - Running state shows elapsed seconds ("5.2s") in `--color-info` mono.

3. **CardRuntime** header (always visible):
   - "CARD RUNTIME" caption.
   - One-line summary: display_id + state badge + assignee.

4. **CardRuntime accordions** (collapsible):
   - "MODIFIED FILES · N" — **default expanded**; list of file path + change indicator (M/+/-) + line counts.
   - "PLAN · N STEPS" — default collapsed.
   - "AUDIT · N EVENTS" — default collapsed.

Accordion header: 8px padding, cursor pointer, chevron rotates. Body animates with `--motion-collapse`.

### 8.6 TaskTimelineView

**File:** `apps/web/src/components/timeline/task-timeline-view.tsx` (new)

**Structure:**

```
+--------------------------------------+
| Header: CARD-NNN  <Task title>        |
| State machine breadcrumb              |
+--------------------------------------+
| Scroll area:                          |
|  - TimelineMessage × N (scrollable)  |
|  - Auto-scroll to bottom on new       |
|    message unless user scrolled up     |
+--------------------------------------+
| MessageInput (multi-line)             |
+--------------------------------------+
```

**State machine breadcrumb:** mono, 10px. The current state is highlighted with `--color-info` background and weight 600. Other states are `--color-text-muted`. Connected by `→` arrows.

**TimelineMessage variants (5):**

| Variant | Left icon | Container | Triggered by |
|---------|-----------|-----------|--------------|
| `user` | none (right-aligned) | `--color-surface-elevated` background, border, max-width 80% | User message or `/command` invocation |
| `agent-thinking` | 20px circle, `--color-info` background, "AI" | prose | Agent initial response, plan announcement |
| `agent-streaming` | 20px circle, `--color-info` background, "AI" + pulse | prose with cursor | Agent response actively streaming |
| `tool` | 20px circle, neutral background, "⚙" | bordered, mono log | Tool call: read_file, apply_patch, run_bash |
| `confirmation` | 20px circle, `--color-warning` background, "!" | border-left 3px `--color-warning`; Approve / Reject / Comment buttons | Human confirmation required |
| `system` | dimmed | prose | "Waiting for approval…", "Session paused" |

Animation: each new message uses `--motion-message-enter` (280ms opacity 0→1 + translateY 8px→0).

**Auto-scroll rule:**

- If `distanceFromBottom < 100px`, auto-scroll to bottom on new message.
- Otherwise, show a small "↓ new messages" indicator in the bottom-right of the scroll area.
- Click indicator or scroll to bottom → indicator disappears.

### 8.7 MessageInput

**File:** `apps/web/src/components/timeline/message-input.tsx` (new)

- Multi-line textarea, auto-resize up to 8 lines.
- Right side: "Send" button.
- Submit on `Enter` (without Shift); new line on `Shift+Enter`.
- Disabled while submission is in flight.

### 8.8 CardDrawer (existing, unchanged)

Continues to be used in the Goal Space view for quick card inspection (clicking a card in the kanban). The Task view's timeline replaces the drawer for deep task interaction.

---

## 9. State Management

The polish work uses **Zustand** stores, consistent with the existing `uiStore` and `boardStore` pattern. No new global state architecture; just new stores.

### 9.1 Existing stores (unchanged)

- `apps/web/src/lib/state/ui-store.ts` — sidebar collapse, theme, selected card id, palette open.
- `apps/web/src/lib/state/board-store.ts` — SSE event log per goal space.

### 9.2 New stores

#### `contextStore`

`apps/web/src/lib/state/context-store.ts` (new)

```ts
interface AppContext {
  goalSpaceId: string;
  taskId: string | null;
}

interface ContextStore {
  current: AppContext;
  setContext: (ctx: Partial<AppContext>) => void;
}
```

Reads from URL on mount; updates on route change. Used by `AppShell` to know whether to render Goal Space view or Task view in the Primary Pane.

#### `agentsStore`

`apps/web/src/lib/state/agents-store.ts` (new)

```ts
type AgentRoleId = "backlog_refiner" | "todo_orchestrator" | "dev_crafter" | "review_guard" | "done_reporter" | "blocked_resolver";

type AgentStatus = "idle" | "queued" | "running" | "error";

interface AgentState {
  status: AgentStatus;
  elapsedMs: number | null;
  currentTaskId: string | null;
}

interface AgentsStore {
  byRole: Record<AgentRoleId, AgentState>;
  setStatus: (role: AgentRoleId, status: AgentStatus, taskId?: string) => void;
}
```

The SSE feed updates this store (e.g. `ai_role_started`, `ai_role_completed` events). `AIPanel` subscribes to this store; no per-component SSE subscription.

---

## 10. UI Flow

### 10.1 Boot

1. User opens `/goal-spaces`.
2. Server component fetches user's goal spaces; renders Goal Space list page.
3. User clicks a goal space → `/goal-spaces/[id]`.
4. `(app)/layout.tsx` renders `<AppShell goalSpaceId={id}>`; `PrimaryPane` shows `GoalSpaceKanbanView`.

### 10.2 Drill into a task

1. User clicks a card in the kanban (Goal Space view) → `CardDrawer` opens (existing behavior, unchanged).
2. User clicks "Open in timeline" (new button on the drawer header) → navigates to `/goal-spaces/[id]/tasks/[taskId]`.
3. `(app)/layout.tsx` re-renders `AppShell` with `taskId` set; `PrimaryPane` swaps to `TaskTimelineView` with 240ms `--motion-route` animation.
4. The Task view's initial timeline shows replayed events from the SSE feed (last 50 events for this task).

### 10.3 Switch tasks

1. In Task view, user clicks a different task in Master Pane.
2. URL changes; `(app)/layout.tsx` re-renders; `AppShell` does NOT unmount.
3. `PrimaryPane` swaps content to the new task's timeline.
4. `DetailPane` updates to the new task's runtime (workspace stays the same).

### 10.4 Approval

1. Agent sends a `confirmation_required` event.
2. SSE handler appends to `boardStore` and updates `agentsStore`.
3. `TaskTimelineView` re-renders; new `TimelineMessage variant=confirmation` appears.
4. User clicks "Approve" / "Reject" → POST to existing F2-05 confirmation endpoint.
5. New SSE events (`confirmation_decided`, `card_state_changed`, `ai_role_resumed`) flow in; timeline auto-scrolls to bottom.

### 10.5 Goal space switch (back out)

1. In Task view, user clicks a different goal space in the TopBar breadcrumb.
2. `taskId` is cleared; `PrimaryPane` swaps back to `GoalSpaceKanbanView`.
3. Master Pane updates to the new goal space's task list.

---

## 11. Interaction Behavior

### 11.1 Streaming

Agent text streams in token-by-token. Implementation:

- SSE event `agent.partial` carries `{ taskId, agentRole, delta, seq }`.
- `TaskTimelineView` maintains a buffer per active message; appends `delta` on each event.
- Render uses `<MessageBody text={buffer} />`; React re-renders on every event (debounced 50ms via `requestAnimationFrame` for smoothness).

### 11.2 Auto-scroll

See §8.6.

### 11.3 Retry behavior

- Network error: show inline retry button in the affected message; on click, replay the last 5 events.
- Tool timeout: same inline retry.
- Approval timeout: highlight the confirmation message in `--color-warning`; show "Approval timed out — agent paused" with a "Resume" button.

---

## 12. Animation

Motion tokens are listed in §6.1. The following patterns use them:

| Pattern | Motion | Trigger |
|---------|--------|---------|
| New timeline message | `--motion-message-enter` | New SSE event |
| AI role running | `--motion-pulse` | `agent_status` = running |
| Card state change highlight | `--motion-highlight` | SSE `card_state_changed` |
| Pane content swap | `--motion-route` | Route change between Goal Space ↔ Task |
| Accordion expand / collapse | `--motion-collapse` | Click on accordion header |
| New goal space / task in master list | `--motion-message-enter` | First appearance |

What is **not** animated:

- No scroll animations on the master list.
- No entrance choreography on page load.
- No decorative hover effects (only functional — `cursor: pointer` and `--color-text-primary` swap).
- No loading spinners (skeleton states preferred, same as DESIGN.md).

---

## 13. Error States

| Error | Visual treatment |
|-------|-------------------|
| Network failure (SSE disconnect > 5s) | TopBar shows `--color-warning` indicator: "Reconnecting…" with subtle pulse; retry every 3s. Master list cards stay clickable but show "--" instead of "now / 3d" timestamps. |
| Tool timeout | Timeline `tool` message turns `--color-error` border; expand shows "Tool timed out (60s elapsed)" + "Retry" button. |
| Approval timeout | `confirmation` message border pulses `--color-warning`; "Approval timed out — agent paused" caption. |
| Auth expired (401) | TopBar shows `--color-error` indicator: "Session expired"; click → redirect to `/login`. |
| Goal space not found | Redirect to `/goal-spaces` with toast: "Goal space not found." |
| Server error (5xx) | Full-pane error state in Primary Pane: "Something went wrong" + "Retry" button. Detail + Master panes remain interactive. |

---

## 14. Empty States

| Empty context | Visual |
|---------------|--------|
| Master list: no goal spaces | Centered mono caption: `// no goal spaces yet` + "+ NEW" CTA button |
| Master list: no tasks in expanded goal space | Indented mono caption: `// no tasks in this goal space` |
| Primary Pane (Goal Space): no boards | Current behavior (P3-03 `EmptyState` + `CreateNodeBoardForm`) — unchanged |
| Primary Pane (Task): no timeline events | Centered mono caption: `// no events yet — agent will start shortly` |
| Detail Pane (Task): no modified files | Empty state inside accordion: `// no files modified` |
| Detail Pane (Task): no audit events | Empty state inside accordion: `// no audit events` |
| AIPanel: all idle | Section caption shows `all idle` instead of agent list |
| Search input: no results | Below search: dimmed mono caption: `// no tasks match` |

All empty states use the same typographic role (caption, mono, `--color-text-muted`).

---

## 15. Backend Event Contract

The polish work does not introduce new server events. It uses the existing [docs/specs/realtime_events.md](../../specs/realtime_events.md) contract.

### 15.1 Events consumed

| Event | Used by | Effect |
|-------|---------|--------|
| `message.delta` | `TaskTimelineView` | Append to streaming message buffer |
| `message.complete` | `TaskTimelineView` | Mark streaming message as final |
| `tool.start` | `TaskTimelineView` | Insert tool-call `TimelineMessage` |
| `tool.output` | `TaskTimelineView` | Append to current tool message |
| `tool.end` | `TaskTimelineView` | Mark tool message as completed |
| `ai_role_started` | `agentsStore` + `TaskTimelineView` | Set role = running, insert "thinking" message |
| `ai_role_completed` | `agentsStore` + `TaskTimelineView` | Set role = idle, mark thinking complete |
| `ai_role_failed` | `agentsStore` + `TaskTimelineView` | Set role = error, show error state |
| `confirmation_requested` | `TaskTimelineView` | Insert confirmation message |
| `confirmation_decided` | `TaskTimelineView` | Mark confirmation as decided |
| `card_state_changed` | `CardRuntime` (Detail) | Highlight card state badge |
| `node_board_updated` | (already handled) | — |
| `goal_space_updated` | (already handled) | — |

### 15.2 Events NOT consumed (yet)

- `card_created`, `card_assigned`, `card_blocked`, `card_unblocked`, `card_updated` — handled in Goal Space view, not in Task view (Task view reads current state via initial server-render snapshot).
- `node_board_created`, `node_board_member_added`, `node_board_member_removed` — out of scope for polish.

---

## 16. Accessibility

This spec preserves all existing accessibility behaviors. Additions:

- **Focus order** in the persistent shell: TopBar → Master Pane (top → bottom) → Primary Pane content → Input (if present) → Detail Pane (top → bottom).
- **Tab order in the Master list** follows the visual order: goal space header → tasks under it → next goal space.
- **Selected task** receives `aria-current="true"`; goal space section header is `role="button" aria-expanded={isCollapsed}`.
- **Timeline messages** are `role="log" aria-live="polite"` so screen readers announce new agent activity without interrupting.
- **Pulse animation** (`--motion-pulse`) is wrapped in `@media (prefers-reduced-motion: reduce) { animation: none; }` (handled globally in `globals.css`).

Color contrast for all new surface combinations: ≥ 4.5:1 (WCAG AA) verified against `--color-bg`, `--color-surface`, `--color-text-muted`.

---

## 17. Performance Requirements

Targets (from [docs/specs/non_functional_requirements.md](../../specs/non_functional_requirements.md) §1.1, plus polish-specific):

| Metric | Target | Notes |
|--------|--------|-------|
| FCP | < 1.5s | App shell renders within 1.5s on dev server |
| TTI | < 3s | After SSE connection |
| Message append (timeline) | < 16ms | Single React render per SSE event |
| Scroll jank (timeline) | 0 | Avoid layout shift on new message; use `position: relative` on container |
| Pane swap (Goal Space ↔ Task) | < 240ms | Matches `--motion-route` |
| Memory growth (per session) | < 50MB | Cap timeline to last 200 events per task |

Optimizations:

- Timeline events: virtualize if > 200 (use `react-window` or `react-virtuoso`).
- Master list: cap to 50 visible tasks per goal space; "Show all" link below to expand.
- SSE buffer: limit to 100KB per goal space; truncate older events on overflow with a "show older" affordance.

---

## 18. Testing Strategy

This polish work follows the existing KEPLAR testing pyramid (Vitest unit + Playwright e2e). New tests:

### 18.1 Unit tests (Vitest)

| File | Coverage |
|------|----------|
| `apps/web/src/components/timeline/timeline-message.test.tsx` (new) | 5 variants render correctly; user / agent / tool / confirmation / system |
| `apps/web/src/components/timeline/timeline-message.test.tsx` (new) | Auto-scroll behavior (mocked scroll container) |
| `apps/web/src/lib/state/context-store.test.ts` (new) | URL → context store sync; `setContext` partial updates |
| `apps/web/src/lib/state/agents-store.test.ts` (new) | Status transitions; idempotent setStatus |
| `apps/web/src/components/detail-pane/card-runtime.test.tsx` (new) | Accordion default state (Modified files expanded) |
| `apps/web/src/components/master-pane/workspace-section.test.tsx` (new) | Expand/collapse; localStorage persistence |
| `apps/web/src/components/top-bar.test.tsx` (new) | Breadcrumb clickable segments; current segment non-clickable |

Coverage target: 80%+ for the new components. The existing 581 unit tests must continue to pass.

### 18.2 Component tests (Vitest + Testing Library)

Per component:
- renders without crashing
- each variant / state renders the right DOM
- click handlers fire correctly
- accessibility roles and labels are present (axe-core)

### 18.3 E2E tests (Playwright)

Update existing `phase2-board.spec.ts` happy path; add 2 new specs:

- `apps/web/e2e/master-pane.spec.ts` (new): verify goal-space grouping, expand/collapse, click navigation.
- `apps/web/e2e/task-timeline.spec.ts` (new): navigate to a task, verify timeline renders, fire a fake `ai_role_started` via SSE, verify the role's status dot becomes running.

---

## 19. Tech Stack

The polish work uses the existing KEPLAR stack. No new dependencies.

| Layer | Tech |
|-------|------|
| Framework | Next.js 15 App Router (existing) |
| State | Zustand (existing) |
| Styling | Tailwind (existing) + CSS custom properties for the new motion tokens |
| Realtime | Existing SSE / `useSseStream` (no changes) |
| Testing | Vitest + Testing Library (existing) + Playwright (existing) |

If the implementation requires a virtualized list library (e.g. for the timeline at > 200 events), prefer `react-virtuoso` — confirm with the user before adding.

---

## 20. Future Extensions

Polish-related items that are **out of scope** for this spec but worth considering later:

- **Time-travel debug**: scrub through the timeline at any point to see state at that moment.
- **Multi-agent collaboration view**: when two agents are working on the same task, show their timelines side-by-side.
- **Voice input** in the MessageInput (Codex spec 20.1).
- **PR generation**: convert a timeline session into a PR description.
- **Agent memory graph** (Codex spec 20.1) — visualize what each agent learned across sessions.
- **Task branching**: when an agent's plan is too aggressive, the user can branch the timeline and try a different approach.
- **Mobile native shell** (Tauri) — same shell rendered in a desktop runtime, per [docs/README.md § Phase 1](../../README.md#phase-1) future scope.

---

## 21. Final Principle

KEPLAR's polish work is governed by one rule:

> **The interface must make agent activity and user authority equally visible.**

When an AI is working, the user must see:
- which role is working
- on which task
- for how long
- what tools it's invoking
- whether it's waiting for human input

When the user is in control, the UI must make their authority equally visible:
- Approve / Reject / Comment buttons always accessible
- The current state of every card and goal space is one glance away
- The breadcrumb always shows where they are and how to step back

The polish work, the persistent shell, the timeline UI, the 4-zone detail pane — all of these exist to make this principle visible. The spec does not need new colors, new fonts, or new tokens. It needs the existing palette to be used with **intentionality**: a state color means "something is running", a mono label means "this is data, not prose", a pulse means "wait, this is live".

When the polish is done, the user should look at the screen and immediately know:
- What the agents are doing
- What they need from the user
- What they can do next

No decorative motion. No random accent colors. No defaulting to a card grid. Every element has a job.

---

## Appendix A: File index

| Path | Status |
|------|--------|
| `apps/web/src/components/app-shell.tsx` | New |
| `apps/web/src/components/top-bar.tsx` | New |
| `apps/web/src/components/master-pane.tsx` | New |
| `apps/web/src/components/master-pane/goal-space-list.tsx` | New |
| `apps/web/src/components/master-pane/workspace-section.tsx` | New |
| `apps/web/src/components/master-pane/settings-bar.tsx` | New |
| `apps/web/src/components/primary-pane.tsx` | New |
| `apps/web/src/components/timeline/task-timeline-view.tsx` | New |
| `apps/web/src/components/timeline/timeline-message.tsx` | New |
| `apps/web/src/components/timeline/message-input.tsx` | New |
| `apps/web/src/components/detail-pane.tsx` | New |
| `apps/web/src/components/detail-pane/workspace-panel.tsx` | New |
| `apps/web/src/components/detail-pane/ai-panel.tsx` | New |
| `apps/web/src/components/detail-pane/card-runtime.tsx` | New |
| `apps/web/src/lib/state/context-store.ts` | New |
| `apps/web/src/lib/state/agents-store.ts` | New |
| `apps/web/src/app/(app)/layout.tsx` | Modified (wraps in AppShell) |
| `apps/web/src/app/(app)/goal-spaces/[id]/page.tsx` | Modified (renders PrimaryPane variant) |
| `apps/web/src/app/(app)/goal-spaces/[id]/tasks/[taskId]/page.tsx` | New |
| `apps/web/src/app/globals.css` | Modified (add 5 motion tokens) |
| `apps/web/src/lib/realtime/useSseStream.ts` | Unchanged (still consumed by Detail Pane / timeline) |
| `apps/web/src/components/goal-space-shell.tsx` | Refactored: kanban content moves to `GoalSpaceKanbanView` (a child of PrimaryPane); `goal-space-shell.tsx` no longer a top-level component |
| `apps/web/src/lib/state/board-store.ts` | Unchanged (still consumed) |
| `apps/web/src/lib/state/ui-store.ts` | Unchanged (still consumed for sidebar collapse, theme) |

## Appendix B: Acceptance Criteria

The polish work is "done" when all of the following are true:

### B.1 Architecture

- [ ] `AppShell` is a client component hoisted to `(app)/layout.tsx` and persists across `/goal-spaces/[id]` ↔ `/goal-spaces/[id]/tasks/[taskId]` navigation (no unmount).
- [ ] `MasterPane` and `DetailPane` are mounted once; only `PrimaryPane` content swaps on route change.
- [ ] `contextStore` is the single source of truth for `goalSpaceId` and `taskId`; URL is the canonical input.

### B.2 Visual hierarchy

- [ ] Master Pane Top: New button + Search + goal-space sections; Bottom: Settings with user chip.
- [ ] Detail Pane 4 zones: Workspace / AI Roles / Card Runtime (with accordions).
- [ ] All existing `--color-*` and `--space-*` tokens used; no new colors / fonts / spacing introduced.
- [ ] All 5 new motion tokens defined in `globals.css`; no other ad-hoc transition / animation values.

### B.3 Typographic roles

- [ ] Every new surface declares its font + size + weight per §6.3 table.
- [ ] No `text-*` Tailwind classes that bypass the typographic role table (audited via grep in PR review).
- [ ] Inter is used for prose, JetBrains Mono for data; no mixed role on the same surface.

### B.4 Motion

- [ ] `--motion-message-enter` (280ms) used for new timeline messages and new master list items.
- [ ] `--motion-pulse` (1600ms infinite) used for AI role running state dot and in-flight tool border.
- [ ] `--motion-highlight` (800ms) used for card state change temporary highlight.
- [ ] `--motion-route` (240ms) used for primary pane content swap.
- [ ] `--motion-collapse` (200ms) used for accordions.
- [ ] All five tokens respect `prefers-reduced-motion: reduce`.

### B.5 Functional

- [ ] Master Pane groups tasks under goal space sections; sections expand / collapse; click navigates.
- [ ] TopBar breadcrumb segments are clickable except the current one.
- [ ] Detail Pane renders 4 zones; workspace always visible; AI Roles always visible; accordions work.
- [ ] Token bar in Workspace shows current usage vs cap.
- [ ] AI Roles panel reflects `agentsStore` state in real time.
- [ ] Card Runtime accordions: Modified files default expanded; Plan / Audit default collapsed.
- [ ] Timeline view shows replayed events on first render; new events append with `--motion-message-enter`.
- [ ] 5 message variants render correctly per §8.6 table.
- [ ] Auto-scroll to bottom unless user scrolled up; "↓ new messages" indicator otherwise.
- [ ] MessageInput submits on Enter; new line on Shift+Enter; disabled while submitting.
- [ ] In-place shell: clicking a different task in Master Pane swaps Primary Pane content without unmounting the shell.

### B.6 Performance

- [ ] Pane swap < 240ms.
- [ ] Timeline message append < 16ms.
- [ ] Master Pane scrolls smoothly up to 50 tasks per goal space.
- [ ] Memory growth < 50MB per session (cap timeline to 200 events per task).

### B.7 Tests

- [ ] 80%+ coverage for the new components.
- [ ] All 581 existing unit tests continue to pass.
- [ ] 2 new Playwright E2E specs (master-pane, task-timeline) pass.
- [ ] Existing `phase2-board.spec.ts` happy path still passes.

### B.8 Verification

- [ ] All 5 polish points (motion / typography / hierarchy / persistent shell / AI roles alignment with Codex) demonstrable in mockup.
- [ ] User can navigate from `/goal-spaces/[id]` → `/goal-spaces/[id]/tasks/[taskId]` and back without any flash of unstyled content.
- [ ] Dev server console is clean (no hydration warnings, no React key warnings, no CSP violations).
- [ ] Production build passes (`pnpm --filter @keplar/web build`).
- [ ] Lint passes (`pnpm --filter @keplar/web lint`).
- [ ] Format passes (`pnpm --filter @keplar/web format:check`).
