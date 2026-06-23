# Review Findings

Change ID: `20260619-phase2-web-ui`
Status: review

## Recommendation

**Proceed with two corrections.**

The F2-09 request analysis maps the Phase 2 Web UI to the F2-02..F2-08 backend APIs and the F2-08 SSE module. The design follows the approved plan at `/Users/taolu/.claude/plans/zippy-churning-music.md`: three-column codex-cli-inspired shell, dark by default with 4 themes, monospace + sans mixed typography, slash-command + output-feed surface, no free-form chat. The implementation reuses the F2-08 SSE server endpoint, the F2-02..F2-07 REST APIs, the existing design tokens (`tokens.css` is read-only), and the existing font loading. No new auth, no new design tokens, no AI chat surface.

Two spec corrections are required before implementation begins. Both are minor and do not affect the test plan.

## Blocking Findings

- **F1. The `<html data-theme="dark">` server-rendered attribute will mismatch the client-resolved theme on first paint.**
  Evidence: `/Users/taolu/KEPLAR/apps/web/src/app/layout.tsx:30` hardcodes `data-theme="dark"` on `<html>`. The plan's inline `<script>` reads `localStorage` and may set `data-theme="dark-solarized"`, causing a React hydration warning and a visible flash from `dark-codex` to the stored theme.
  Required action: Add `suppressHydrationWarning` to the `<html>` element (Next.js convention for client-only attributes). This is a one-line change to `app/layout.tsx` alongside the inline `<script>` addition. The plan should call this out.

- **F2. `app/page.tsx` currently uses inline styles with `React.ReactElement` return type; converting it to a server-side `redirect()` requires changing it from a synchronous component to an async server component using `next/navigation`'s `redirect()`.**
  Evidence: The existing `app/page.tsx` is a synchronous client-style component. The plan's "redirect when authenticated" requires an async server component that calls `redirect("/goal-spaces")` BEFORE rendering, else falls back to the existing landing.
  Required action: The plan's "MODIFY app/page.tsx — redirect when authenticated" must specify:
  - Convert to `async function Page()` server component.
  - Use `getSessionActor(request)` from F2-02's session module to detect authentication.
  - If authenticated, call `redirect("/goal-spaces")` (which throws a `NEXT_REDIRECT` error to abort rendering).
  - Otherwise render the existing landing markup unchanged.
  - This requires reading cookies via `next/headers`' `cookies()` in Next.js 15.

## Non-Blocking Risks

- **R1. `useSseStream` needs an `EventSource` shim in jsdom for tests.** The browser `EventSource` global does not exist in jsdom. Implementation must inject a small shim (or use `vi.stubGlobal`) so component tests can exercise the hook.
  Mitigation: Documented in the plan as "R3 MSW + jsdom + EventSource shim". Acceptable.

- **R2. Server Component date serialization** — `Date` objects cannot cross the RSC boundary. Server pages must convert timestamps to ISO 8601 strings before passing to client components.
  Mitigation: Plan addresses this in R1 of the spec. Acceptable.

- **R3. The 4 theme blocks extend `globals.css`.** Adding ~120 lines of CSS increases the bundle size. Negligible (< 1KB gzipped) but worth noting.
  Mitigation: Plan addresses this in R5. Acceptable.

- **R4. `Cmd+K` and other global shortcuts may conflict with browser defaults** (e.g., Cmd+K opens the URL bar in Firefox, Cmd+B toggles bookmarks). The implementation must `preventDefault()` on the keydown event for registered shortcuts.
  Mitigation: Add `e.preventDefault()` in the ShortcutProvider's keydown handler when a registered chord matches. Documented in the plan as a standard pattern.

- **R5. `localStorage` is not available during SSR.** The `getStoredTheme()` helper must be SSR-safe (return `'dark-codex'` on the server). The inline FOUC script runs only in the browser.
  Mitigation: Plan addresses this. The helper checks `typeof window === 'undefined'` and returns the default on the server.

- **R6. MSW with `EventSource` shim** — the test harness must set up MSW BEFORE the component import AND set the EventSource shim. Order matters.
  Mitigation: Test files use `vi.stubGlobal("EventSource", ...)` in a `beforeAll` hook, set up MSW with `setupServer`, and clean up in `afterAll`. Documented in T1 of the plan.

- **R7. The plan's `lib/state/board-store.ts` and `ui-store.ts` use `useSyncExternalStore`.** This React 18+ hook requires careful snapshot equality handling. Implementation must use the proper `getServerSnapshot` to avoid hydration mismatches.
  Mitigation: Use the `useSyncExternalStoreWithSelector` shim (or the React 18 builtin) with explicit `isEqual` per store. Documented in the plan as a store-internal detail.

- **R8. The `card-detail-drawer`'s "legal transitions for the current state" computation must NOT use `canTransition` for `human_confirm` / `human_reject` triggers** (per F2-05 review F3 — human decisions bypass the tuple restriction). The drawer's footer should use a simpler `LEGAL_TRANSITIONS` constant map per `CardState`.
  Mitigation: Implement a static map `LEGAL_TRANSITIONS: Record<CardState, CardState[]>` rather than calling into the state machine. Documented.

## Missing Tests

- **MT1.** `app/page.tsx` redirect: authenticated → `/goal-spaces`; unauthenticated → existing landing.
- **MT2.** Plan §9: `UNAUTHORIZED` redirects to `/login` — but the plan doesn't define a `/login` page yet. The redirect target must be specified. (The plan should also note that `/login` is F2-02's responsibility and may not exist yet — the redirect must degrade gracefully.)
- **MT3.** The bottom-of-main sticky position uses `position: sticky; bottom: 0`. Test that the command input remains visible when the main content scrolls.
- **MT4.** The 4 themes are loaded into `localStorage`. Test that an invalid stored value falls back to `dark-codex`.
- **MT5.** `Cmd+/` cycles theme. Test that all 4 themes can be cycled.
- **MT6.** Multiple components subscribed to the same `goalSpaceId` share one EventSource. Test that opening 2 components results in 1 underlying EventSource.
- **MT7.** `EVENT_CURSOR_EXPIRED` handling: replay fetch returns 410 → snapshot is refetched → SSE restarts from `after_id=null`.
- **MT8.** `output-feed` caps at 100 entries; older entries fall off.
- **MT9.** `EmptyState` renders the same component for loading / empty / error states with different `kind` props.
- **MT10.** `ConnectionStatusIndicator` color and animation per status (idle/connecting/live/reconnecting/stale/error).

## Open Questions

- **Q1. What should happen when the user navigates to `/login`?** The plan mentions redirecting to `/login` for `UNAUTHORIZED` errors. F2-02 may already define this page.
  Resolution: F2-02 ships `/api/v1/auth/login` as an API endpoint. There is no F2-02 login page. F2-09 should ship a minimal `/login` page that POSTs to the auth API and sets the cookie via the response's `Set-Cookie`. If this is too much for F2-09, defer to a future change; the redirect to `/login` would then 404 until F2-09 ships the page.

- **Q2. Should the bottom-of-main surface appear on the list page?**
  Resolution: Already resolved in spec Q2: no, list page is full-height scrollable. Command surface is detail-page only.

- **Q3. Should the implementation include Playwright tests in F2-09 or defer to F2-10?**
  Resolution: F2-10 owns the Playwright tests per the plan. F2-09 ships component tests + manual smoke.

## Reviewed Artifacts

- `request_analysis/spec.md`
- `request_analysis/tasks.md`
- `request_analysis/feature_list.json`
- `sprint_progress.md`
- `/Users/taolu/.claude/plans/zippy-churning-music.md` (approved plan)

## Sprint Progress Update

After human approves the corrections above:

- Phase 2 (Review) → Complete.
- Phase 3 (Implementation) → In Progress.
- Add a "Change Log" entry recording: R-fix F1 (add `suppressHydrationWarning` to `<html>`); R-fix F2 (convert `app/page.tsx` to async server component using `getSessionActor` + `redirect()`).
- Document F2-09's `/login` decision in the spec: either ship the page in F2-09 or document the redirect as a known broken-link until the next phase.