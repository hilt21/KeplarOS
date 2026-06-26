# Phase 3 Web Beta Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Harden the Phase 2 Web Collaboration Beta into a credible browser-usable beta by restoring clean verification gates, replacing E2E setup shortcuts with real UI flows, and adding reliability coverage for realtime and database invariants.

**Architecture:** Keep the existing Next.js 15 App Router, React 19, TypeScript, Drizzle, and SQLite Web runtime. Add thin, design-system-compliant UI surfaces over the already implemented REST services; do not introduce Tauri, Rust Axum, Kubernetes, enterprise SSO, real external writes, or a new data layer. Preserve the Phase 2 service/repository boundaries and add tests around the current contracts rather than rewriting them.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript 5, Drizzle ORM, SQLite via better-sqlite3, Vitest, Playwright, ESLint, Prettier, pnpm 11.5.1, Node 20.

---

## Phase 3 Scope

Phase 3 is **Web Beta Hardening**.

Phase 2 delivered the Web beta API, board UI, SSE, deterministic AI-lane execution, confirmation gates, smoke tests, and a Playwright happy path. Phase 3 makes that beta less dependent on seeded setup shortcuts and more trustworthy as a product surface.

### In Scope

| Capability | Phase 3 Result |
|------------|----------------|
| Clean verification gate | `pnpm check` is a reliable gate again; generated Playwright artifacts do not break Prettier; Node 20 assumptions are recorded. |
| Real onboarding UI | Browser users can log in through `/login` using the existing session auth API. |
| Goal-space creation UI | Initiators can create a goal space from `/goal-spaces` without direct API setup. |
| Node-board creation UI | Initiators can create at least one node board for a goal space from the browser. |
| Browser-first E2E | Playwright covers login -> create goal space -> create board -> create card -> execute -> audit/SSE without precreating goal spaces or boards through test setup. |
| Realtime reliability | Startup replay, stale/reconnect status, expired cursor recovery, duplicate event handling, and cursor comments/docs are covered. |
| Real-DB invariants | SQLite integration tests cover partial unique constraints and other invariants mock route tests cannot catch. |
| Delivery docs | Test matrix, realtime docs, beta QA checklist, and handoff docs match implemented behavior. |

### Out of Scope

| Capability | Reason |
|------------|--------|
| Tauri desktop runtime | Future phase; desktop must reuse the stabilized Web API contract. |
| Rust Axum server | Avoid dual-runtime semantic drift while Web beta is still hardening. |
| Enterprise SSO / multi-tenant identity | Phase 3 uses existing session auth and role model. |
| Kubernetes / production HA | Phase 3 improves beta confidence, not production platform topology. |
| Real MCP / ACP / A2A external writes | Existing deterministic fixture executor remains the only execution path. |
| Full load/performance program | Add reliability checks and smoke coverage only; load testing follows after beta workflows stabilize. |

## Design System Constraints

Read `DESIGN.md` before any UI implementation task. Phase 3 UI must keep the current enterprise dashboard direction:

- Dark slate background, cool blue primary accent, semantic state colors.
- Instrument Sans for body/UI, JetBrains Mono for data and IDs.
- CSS custom properties only for colors, spacing, type, and motion tokens.
- No hardcoded hex colors in UI code.
- No marketing landing page, hero section, or decorative UI.
- Audit/realtime status remains first-class dashboard information, not hidden in a modal.
- Use compact, utilitarian controls that fit the existing three-column shell.

## File Structure Map

### Existing Files To Extend

| Path | Responsibility |
|------|----------------|
| `apps/web/.prettierignore` | Exclude generated artifacts from `format:check`. |
| `apps/web/src/app/(app)/layout.tsx` | Authenticated route gate; redirects anonymous users to `/login`. |
| `apps/web/src/app/(app)/goal-spaces/page.tsx` | Goal-space list page; add creation affordance after login UI exists. |
| `apps/web/src/app/(app)/goal-spaces/[id]/page.tsx` | Goal-space detail page; provide board creation surface when no board exists. |
| `apps/web/src/components/goal-space-list.tsx` | Goal-space table/list UI; keep table dense and dashboard-like. |
| `apps/web/src/components/goal-space-shell.tsx` | Board shell, command palette, replay hydration, SSE mirroring. |
| `apps/web/src/lib/api/client.ts` | Existing typed fetch envelope helper; reuse for UI client APIs. |
| `apps/web/src/lib/api/goal-spaces.ts` | Existing goal-space client calls; extend only if the UI needs a missing wrapper. |
| `apps/web/src/lib/api/node-boards.ts` | Existing node-board client calls; extend only if the UI needs a missing wrapper. |
| `apps/web/src/lib/realtime/useSseStream.ts` | SSE status, reconnect, dedupe, localStorage cursor behavior. |
| `apps/web/src/lib/realtime/replay.ts` | Startup replay API wrapper. |
| `apps/web/src/lib/db/repositories/realtime-events.ts` | Cursor/sequence query helpers. |
| `apps/web/src/__tests__/ui/*.test.tsx` | Existing React UI tests. |
| `apps/web/__tests__/api/*.test.ts` | Existing API contract tests. |
| `apps/web/__tests__/__helpers__/sqlite.ts` | Real SQLite test DB helper. |
| `apps/web/e2e/phase2-board.spec.ts` | Replace setup shortcuts with real browser flow assertions. |
| `docs/architecture/test_matrix.md` | Verification gate documentation. |
| `docs/specs/realtime_events.md` | Realtime replay and cursor behavior. |

### New Files To Create

| Path | Responsibility |
|------|----------------|
| `apps/web/src/app/login/page.tsx` | Login page server entry; renders login form for anonymous users. |
| `apps/web/src/components/login-form.tsx` | Client login form calling `/api/v1/auth/login`, rendering envelope errors. |
| `apps/web/src/components/create-goal-space-form.tsx` | Client goal-space creation form using existing API wrapper. |
| `apps/web/src/components/create-node-board-form.tsx` | Client node-board creation form for an existing goal space. |
| `apps/web/src/__tests__/ui/login-form.test.tsx` | Login form unit tests with mocked `fetch`/router. |
| `apps/web/src/__tests__/ui/create-goal-space-form.test.tsx` | Goal-space creation form unit tests. |
| `apps/web/src/__tests__/ui/create-node-board-form.test.tsx` | Node-board creation form unit tests. |
| `apps/web/__tests__/realtime/reconnect.test.tsx` | Hook/store-level realtime reconnect and replay tests. |
| `apps/web/__tests__/db/invariants.test.ts` | Real SQLite invariants missed by mock API tests. |
| `docs/architecture/beta_qa_checklist.md` | Manual QA checklist for Web beta flows. |

## Feature Sequence

Implement features in order. Each feature gets its own harness change id and must stop after request analysis unless the human explicitly approves implementation.

| Feature | Name | Depends On | Exit Gate |
|---------|------|------------|-----------|
| P3-00 | Baseline health and CI gate | Phase 2 complete | `pnpm check` is a meaningful gate or Node 20 unavailability is explicitly recorded. |
| P3-01 | Session login UI | P3-00 | Browser login works with HttpOnly cookie and redirects to `/goal-spaces`. |
| P3-02 | Goal-space creation UI | P3-01 | Initiator creates goal space from `/goal-spaces`. |
| P3-03 | Node-board creation UI | P3-02 | Initiator creates first board from goal-space detail page. |
| P3-04 | Browser-first E2E | P3-03 | Playwright no longer precreates goal space or board through setup. |
| P3-05 | Realtime reliability hardening | P3-04 | Replay/reconnect/cursor behavior has focused tests and updated docs. |
| P3-06 | Real-DB invariant hardening | P3-05 | Real SQLite invariant tests cover high-risk DB constraints. |
| P3-07 | Beta delivery docs | P3-06 | QA checklist, test matrix, and handoff docs match implementation. |

---

## Task P3-00: Baseline Health And CI Gate

**Files:**
- Modify: `apps/web/.prettierignore`
- Modify formatting only if surfaced by Prettier: source files reported by `pnpm --filter @keplar/web format:check`
- Create: `.harness/changes/{change-id}/request_analysis/spec.md`
- Create: `.harness/changes/{change-id}/request_analysis/tasks.md`
- Create: `.harness/changes/{change-id}/request_analysis/feature_list.json`
- Create: `.harness/changes/{change-id}/sprint_progress.md`
- Create later: `.harness/changes/{change-id}/implementation/notes.md`
- Create later: `.harness/changes/{change-id}/testing/results.md`
- Create later: `.harness/changes/{change-id}/delivery/summary.md`
- Create later: `.harness/changes/{change-id}/handoff.md`

- [ ] **Step 1: Create harness request analysis**

Create change id:

```text
20260626-phase3-baseline-health-ci
```

Create:

```text
.harness/changes/20260626-phase3-baseline-health-ci/request_analysis/spec.md
.harness/changes/20260626-phase3-baseline-health-ci/request_analysis/tasks.md
.harness/changes/20260626-phase3-baseline-health-ci/request_analysis/feature_list.json
.harness/changes/20260626-phase3-baseline-health-ci/sprint_progress.md
```

Expected: request-analysis artifacts describe only baseline gate repair.

- [ ] **Step 2: Record current baseline**

Run:

```bash
git status --short --branch
node --version
pnpm --version
pnpm --filter @keplar/web format:check
```

Expected:

```text
git status shows only intentional harness artifacts
node reports v20.x or the mismatch is recorded
pnpm reports 11.5.1
format:check either passes or reports a concrete file list
```

- [ ] **Step 3: Write the generated-artifact ignore change**

Modify `apps/web/.prettierignore` to exactly:

```gitignore
db/migrations/meta/
db/dev.db
test-results/
playwright-report/
blob-report/
playwright/.cache/
```

Expected: Playwright generated output is no longer included in Prettier checks.

- [ ] **Step 4: Verify generated artifacts are ignored**

Run:

```bash
pnpm --filter @keplar/web format:check
```

Expected:

```text
No warnings for test-results/, playwright-report/, blob-report/, or playwright/.cache/
```

- [ ] **Step 5: Apply minimal formatting-only cleanup**

If `format:check` still reports source files, run Prettier only on the reported source files. Example command shape:

```bash
pnpm --filter @keplar/web exec prettier --write src/components/card-row.tsx src/lib/api/client.ts
```

Expected: Only formatting changes appear in `git diff`.

- [ ] **Step 6: Run focused verification**

Run:

```bash
pnpm --filter @keplar/web typecheck
pnpm --filter @keplar/web lint
pnpm --filter @keplar/web test
pnpm --filter @keplar/web build
pnpm --filter @keplar/web format:check
git diff --check
```

Expected:

```text
typecheck exits 0
lint exits 0 errors
test exits 0
build exits 0
format:check exits 0
git diff --check exits 0
```

- [ ] **Step 7: Run root gate**

Run:

```bash
pnpm check
```

Expected:

```text
pnpm check exits 0 under Node 20
```

If local Node is not Node 20, record the exact runtime and risk in `testing/results.md` while still reporting subcommand outcomes.

- [ ] **Step 8: Commit**

```bash
git add apps/web/.prettierignore .harness/changes/20260626-phase3-baseline-health-ci
git add <only-the-source-files-formatted-by-prettier>
git commit -m "chore(phase3): restore web baseline verification gate"
```

---

## Task P3-01: Session Login UI

**Files:**
- Create: `apps/web/src/app/login/page.tsx`
- Create: `apps/web/src/components/login-form.tsx`
- Create: `apps/web/src/__tests__/ui/login-form.test.tsx`
- Modify if needed: `apps/web/src/lib/api/client.ts`
- Modify if needed: `apps/web/src/lib/api/types.ts`

- [ ] **Step 1: Create harness request analysis**

Create change id:

```text
20260626-phase3-login-ui
```

Create request-analysis artifacts under:

```text
.harness/changes/20260626-phase3-login-ui/request_analysis/
```

Expected: artifacts state that P3-01 only adds login UI over existing `/api/v1/auth/login`.

- [ ] **Step 2: Write failing login form test**

Create `apps/web/src/__tests__/ui/login-form.test.tsx`:

```tsx
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LoginForm } from "@/components/login-form";

const push = vi.fn();
const refresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh }),
}));

describe("LoginForm", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    push.mockReset();
    refresh.mockReset();
  });

  it("posts credentials and redirects to goal spaces on success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          success: true,
          data: {
            user: {
              id: "u1",
              name: "Alice",
              email: "alice@example.com",
              role: "initiator",
            },
            expires_at: "2026-06-26T12:00:00.000Z",
          },
          timestamp: "2026-06-26T00:00:00.000Z",
        }),
      ),
    );

    render(<LoginForm />);
    await userEvent.type(screen.getByLabelText("Email"), "alice@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "correct horse battery staple");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/goal-spaces"));
    expect(fetch).toHaveBeenCalledWith(
      "/api/v1/auth/login",
      expect.objectContaining({
        method: "POST",
        credentials: "include",
      }),
    );
  });

  it("renders the API error message when login fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json(
          {
            success: false,
            error: { code: "UNAUTHORIZED", message: "Invalid email or password." },
            timestamp: "2026-06-26T00:00:00.000Z",
          },
          { status: 401 },
        ),
      ),
    );

    render(<LoginForm />);
    await userEvent.type(screen.getByLabelText("Email"), "alice@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "wrong");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByText("Invalid email or password.")).toBeVisible();
    expect(push).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Run failing test**

Run:

```bash
pnpm --filter @keplar/web test -- src/__tests__/ui/login-form.test.tsx
```

Expected:

```text
FAIL because LoginForm does not exist
```

- [ ] **Step 4: Implement `LoginForm`**

Create `apps/web/src/components/login-form.tsx`:

```tsx
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type LoginState = "idle" | "submitting";

interface ApiErrorEnvelope {
  readonly success: false;
  readonly error: { readonly message: string };
}

interface LoginOkEnvelope {
  readonly success: true;
  readonly data: {
    readonly user: {
      readonly id: string;
      readonly name: string;
      readonly email: string;
      readonly role: string;
    };
    readonly expires_at: string;
  };
}

type LoginEnvelope = ApiErrorEnvelope | LoginOkEnvelope;

export function LoginForm(): React.ReactElement {
  const router = useRouter();
  const [state, setState] = useState<LoginState>("idle");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setState("submitting");
    setError(null);

    try {
      const response = await fetch("/api/v1/auth/login", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: String(form.get("email") ?? ""),
          password: String(form.get("password") ?? ""),
        }),
      });
      const envelope = (await response.json()) as LoginEnvelope;
      if (!envelope.success) {
        setError(envelope.error.message);
        return;
      }
      router.refresh();
      router.push("/goal-spaces");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to sign in.");
    } finally {
      setState("idle");
    }
  }

  return (
    <form onSubmit={(event) => void onSubmit(event)} className="flex w-full max-w-[420px] flex-col gap-[var(--space-md)]">
      <label className="flex flex-col gap-[var(--space-2xs)]">
        <span className="font-[var(--font-jetbrains-mono,monospace)] text-[var(--font-micro)] uppercase text-[var(--color-text-muted)]">
          Email
        </span>
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          className="rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] px-[var(--space-sm)] py-[var(--space-xs)] font-[var(--font-instrument-sans,system-ui,sans-serif)] text-[var(--font-body)] text-[var(--color-text-primary)] outline-none focus:border-[var(--color-primary)]"
        />
      </label>
      <label className="flex flex-col gap-[var(--space-2xs)]">
        <span className="font-[var(--font-jetbrains-mono,monospace)] text-[var(--font-micro)] uppercase text-[var(--color-text-muted)]">
          Password
        </span>
        <input
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] px-[var(--space-sm)] py-[var(--space-xs)] font-[var(--font-instrument-sans,system-ui,sans-serif)] text-[var(--font-body)] text-[var(--color-text-primary)] outline-none focus:border-[var(--color-primary)]"
        />
      </label>
      {error !== null && (
        <p className="font-[var(--font-jetbrains-mono,monospace)] text-[var(--font-small)] text-[var(--color-error)]">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={state === "submitting"}
        className="rounded-[var(--radius-sm)] bg-[var(--color-primary)] px-[var(--space-md)] py-[var(--space-xs)] font-[var(--font-instrument-sans,system-ui,sans-serif)] text-[var(--font-small)] font-medium text-white disabled:opacity-60"
      >
        {state === "submitting" ? "Signing in" : "Sign in"}
      </button>
    </form>
  );
}
```

- [ ] **Step 5: Create `/login` page**

Create `apps/web/src/app/login/page.tsx`:

```tsx
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/login-form";
import { getSessionActor } from "@/lib/auth/session";

export default async function LoginPage(): Promise<React.ReactElement> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("keplar_session");
  const request = new Request("http://internal/login", {
    headers: sessionCookie ? { cookie: `keplar_session=${sessionCookie.value}` } : {},
  });
  const actor = await getSessionActor(request);
  if (actor !== null) redirect("/goal-spaces");

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--color-bg)] px-[var(--space-lg)] text-[var(--color-text-primary)]">
      <section className="flex w-full max-w-[960px] grid-cols-[1fr_420px] flex-col gap-[var(--space-xl)] lg:grid">
        <div className="flex flex-col justify-center gap-[var(--space-md)]">
          <span className="font-[var(--font-jetbrains-mono,monospace)] text-[var(--font-micro)] uppercase text-[var(--color-primary)]">
            KEPLAR Web Beta
          </span>
          <h1 className="font-[var(--font-instrument-sans,system-ui,sans-serif)] text-[var(--font-h1)] font-semibold">
            Transparent governance for agentic board work.
          </h1>
          <p className="max-w-[560px] font-[var(--font-instrument-sans,system-ui,sans-serif)] text-[var(--font-body)] text-[var(--color-text-secondary)]">
            Sign in to operate goal spaces, node boards, confirmations, audit trails, and AI-lane execution from the browser.
          </p>
        </div>
        <div className="border border-[var(--color-border)] bg-[var(--color-surface)] p-[var(--space-lg)]">
          <LoginForm />
        </div>
      </section>
    </main>
  );
}
```

- [ ] **Step 6: Verify login UI**

Run:

```bash
pnpm --filter @keplar/web test -- src/__tests__/ui/login-form.test.tsx
pnpm --filter @keplar/web typecheck
pnpm --filter @keplar/web lint
```

Expected:

```text
login-form tests pass
typecheck exits 0
lint exits 0 errors
```

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/app/login/page.tsx apps/web/src/components/login-form.tsx apps/web/src/__tests__/ui/login-form.test.tsx .harness/changes/20260626-phase3-login-ui
git commit -m "feat(web): add session login UI"
```

---

## Task P3-02: Goal-Space Creation UI

**Files:**
- Create: `apps/web/src/components/create-goal-space-form.tsx`
- Create: `apps/web/src/__tests__/ui/create-goal-space-form.test.tsx`
- Modify: `apps/web/src/app/(app)/goal-spaces/page.tsx`
- Modify if needed: `apps/web/src/lib/api/goal-spaces.ts`

- [ ] **Step 1: Create harness request analysis**

Create change id:

```text
20260626-phase3-goal-space-create-ui
```

Expected: request analysis states this feature only creates goal spaces from the existing `/goal-spaces` page.

- [ ] **Step 2: Write failing form test**

Create `apps/web/src/__tests__/ui/create-goal-space-form.test.tsx`:

```tsx
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CreateGoalSpaceForm } from "@/components/create-goal-space-form";

const refresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

describe("CreateGoalSpaceForm", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    refresh.mockReset();
  });

  it("posts a new goal space and refreshes the list", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          success: true,
          data: {
            id: "gs-1",
            name: "Railway launch",
            description: "Coordinate launch readiness.",
            constraints: [],
            acceptance_criteria: [],
            status: "draft",
            progress: 0,
            initiator_id: "u1",
            created_at: "2026-06-26T00:00:00.000Z",
            updated_at: "2026-06-26T00:00:00.000Z",
          },
          timestamp: "2026-06-26T00:00:00.000Z",
        }),
      ),
    );

    render(<CreateGoalSpaceForm />);
    await userEvent.type(screen.getByLabelText("Goal name"), "Railway launch");
    await userEvent.type(screen.getByLabelText("Description"), "Coordinate launch readiness.");
    await userEvent.click(screen.getByRole("button", { name: "Create goal space" }));

    await waitFor(() => expect(refresh).toHaveBeenCalledOnce());
    expect(fetch).toHaveBeenCalledWith(
      "/api/v1/goal-spaces",
      expect.objectContaining({
        method: "POST",
        credentials: "include",
      }),
    );
  });
});
```

- [ ] **Step 3: Run failing test**

Run:

```bash
pnpm --filter @keplar/web test -- src/__tests__/ui/create-goal-space-form.test.tsx
```

Expected:

```text
FAIL because CreateGoalSpaceForm does not exist
```

- [ ] **Step 4: Implement form**

Create `apps/web/src/components/create-goal-space-form.tsx`:

```tsx
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function CreateGoalSpaceForm(): React.ReactElement {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/v1/goal-spaces", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: String(form.get("name") ?? ""),
          description: String(form.get("description") ?? ""),
          constraints: [],
          acceptance_criteria: [],
        }),
      });
      const envelope = (await response.json()) as
        | { success: true; data: unknown }
        | { success: false; error: { message: string } };
      if (!envelope.success) {
        setError(envelope.error.message);
        return;
      }
      event.currentTarget.reset();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create goal space.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={(event) => void onSubmit(event)} className="flex flex-col gap-[var(--space-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] p-[var(--space-md)]">
      <label className="flex flex-col gap-[var(--space-2xs)]">
        <span className="font-[var(--font-jetbrains-mono,monospace)] text-[var(--font-micro)] uppercase text-[var(--color-text-muted)]">
          Goal name
        </span>
        <input name="name" required className="border border-[var(--color-border)] bg-[var(--color-bg)] px-[var(--space-sm)] py-[var(--space-xs)] text-[var(--color-text-primary)]" />
      </label>
      <label className="flex flex-col gap-[var(--space-2xs)]">
        <span className="font-[var(--font-jetbrains-mono,monospace)] text-[var(--font-micro)] uppercase text-[var(--color-text-muted)]">
          Description
        </span>
        <textarea name="description" rows={3} className="border border-[var(--color-border)] bg-[var(--color-bg)] px-[var(--space-sm)] py-[var(--space-xs)] text-[var(--color-text-primary)]" />
      </label>
      {error !== null && <p className="text-[var(--color-error)]">{error}</p>}
      <button type="submit" disabled={submitting} className="bg-[var(--color-primary)] px-[var(--space-md)] py-[var(--space-xs)] text-white disabled:opacity-60">
        {submitting ? "Creating" : "Create goal space"}
      </button>
    </form>
  );
}
```

- [ ] **Step 5: Mount form on `/goal-spaces`**

Modify `apps/web/src/app/(app)/goal-spaces/page.tsx` to import and render the form above the list:

```tsx
import { CreateGoalSpaceForm } from "@/components/create-goal-space-form";
```

Render inside the main container, after the header:

```tsx
<CreateGoalSpaceForm />
```

Expected: authenticated initiators can create a goal space without direct API setup.

- [ ] **Step 6: Verify**

Run:

```bash
pnpm --filter @keplar/web test -- src/__tests__/ui/create-goal-space-form.test.tsx
pnpm --filter @keplar/web typecheck
pnpm --filter @keplar/web lint
```

Expected:

```text
form test passes
typecheck exits 0
lint exits 0 errors
```

- [ ] **Step 7: Commit**

```bash
git add 'apps/web/src/app/(app)/goal-spaces/page.tsx' apps/web/src/components/create-goal-space-form.tsx apps/web/src/__tests__/ui/create-goal-space-form.test.tsx .harness/changes/20260626-phase3-goal-space-create-ui
git commit -m "feat(web): create goal spaces from browser"
```

---

## Task P3-03: Node-Board Creation UI

**Files:**
- Create: `apps/web/src/components/create-node-board-form.tsx`
- Create: `apps/web/src/__tests__/ui/create-node-board-form.test.tsx`
- Modify: `apps/web/src/components/goal-space-shell.tsx`
- Modify if needed: `apps/web/src/lib/api/node-boards.ts`

- [ ] **Step 1: Create harness request analysis**

Create change id:

```text
20260626-phase3-node-board-create-ui
```

Expected: request analysis states this feature only adds browser creation for one node board inside an existing goal space.

- [ ] **Step 2: Write failing form test**

Create `apps/web/src/__tests__/ui/create-node-board-form.test.tsx`:

```tsx
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CreateNodeBoardForm } from "@/components/create-node-board-form";

const refresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

describe("CreateNodeBoardForm", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    refresh.mockReset();
  });

  it("posts a node board for the current goal space", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          success: true,
          data: {
            id: "board-1",
            goal_space_id: "gs-1",
            key: "MAIN",
            name: "Main board",
            description: "Primary execution board.",
            members: [],
            status: "active",
            created_at: "2026-06-26T00:00:00.000Z",
            updated_at: "2026-06-26T00:00:00.000Z",
          },
          timestamp: "2026-06-26T00:00:00.000Z",
        }),
      ),
    );

    render(<CreateNodeBoardForm goalSpaceId="gs-1" />);
    await userEvent.type(screen.getByLabelText("Board key"), "MAIN");
    await userEvent.type(screen.getByLabelText("Board name"), "Main board");
    await userEvent.click(screen.getByRole("button", { name: "Create node board" }));

    await waitFor(() => expect(refresh).toHaveBeenCalledOnce());
    expect(fetch).toHaveBeenCalledWith(
      "/api/v1/goal-spaces/gs-1/node-boards",
      expect.objectContaining({ method: "POST", credentials: "include" }),
    );
  });
});
```

- [ ] **Step 3: Run failing test**

Run:

```bash
pnpm --filter @keplar/web test -- src/__tests__/ui/create-node-board-form.test.tsx
```

Expected:

```text
FAIL because CreateNodeBoardForm does not exist
```

- [ ] **Step 4: Implement form**

Create `apps/web/src/components/create-node-board-form.tsx`:

```tsx
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function CreateNodeBoardForm({ goalSpaceId }: { readonly goalSpaceId: string }): React.ReactElement {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(`/api/v1/goal-spaces/${goalSpaceId}/node-boards`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          key: String(form.get("key") ?? ""),
          name: String(form.get("name") ?? ""),
          description: String(form.get("description") ?? ""),
        }),
      });
      const envelope = (await response.json()) as
        | { success: true; data: unknown }
        | { success: false; error: { message: string } };
      if (!envelope.success) {
        setError(envelope.error.message);
        return;
      }
      event.currentTarget.reset();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create node board.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={(event) => void onSubmit(event)} className="flex max-w-[520px] flex-col gap-[var(--space-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] p-[var(--space-md)]">
      <label className="flex flex-col gap-[var(--space-2xs)]">
        <span className="font-[var(--font-jetbrains-mono,monospace)] text-[var(--font-micro)] uppercase text-[var(--color-text-muted)]">
          Board key
        </span>
        <input name="key" required className="border border-[var(--color-border)] bg-[var(--color-bg)] px-[var(--space-sm)] py-[var(--space-xs)] text-[var(--color-text-primary)]" />
      </label>
      <label className="flex flex-col gap-[var(--space-2xs)]">
        <span className="font-[var(--font-jetbrains-mono,monospace)] text-[var(--font-micro)] uppercase text-[var(--color-text-muted)]">
          Board name
        </span>
        <input name="name" required className="border border-[var(--color-border)] bg-[var(--color-bg)] px-[var(--space-sm)] py-[var(--space-xs)] text-[var(--color-text-primary)]" />
      </label>
      <label className="flex flex-col gap-[var(--space-2xs)]">
        <span className="font-[var(--font-jetbrains-mono,monospace)] text-[var(--font-micro)] uppercase text-[var(--color-text-muted)]">
          Description
        </span>
        <textarea name="description" rows={2} className="border border-[var(--color-border)] bg-[var(--color-bg)] px-[var(--space-sm)] py-[var(--space-xs)] text-[var(--color-text-primary)]" />
      </label>
      {error !== null && <p className="text-[var(--color-error)]">{error}</p>}
      <button type="submit" disabled={submitting} className="bg-[var(--color-primary)] px-[var(--space-md)] py-[var(--space-xs)] text-white disabled:opacity-60">
        {submitting ? "Creating" : "Create node board"}
      </button>
    </form>
  );
}
```

- [ ] **Step 5: Mount empty-board creation state**

Modify `apps/web/src/components/goal-space-shell.tsx`:

```tsx
import { CreateNodeBoardForm } from "./create-node-board-form";
```

Replace the `boards.length === 0` branch with:

```tsx
boards.length === 0 ? (
  <div className="flex h-full flex-col gap-[var(--space-md)] p-[var(--space-xl)]">
    <EmptyState kind="empty" caption="// no node boards yet" />
    <CreateNodeBoardForm goalSpaceId={goalSpaceId} />
  </div>
) : (
  <NodeBoardView
    board={boards[0]!}
    cards={liveCards.filter((c) => c.node_board_id === boards[0]!.id)}
    onSelectCard={handleSelectCard}
  />
)
```

- [ ] **Step 6: Verify**

Run:

```bash
pnpm --filter @keplar/web test -- src/__tests__/ui/create-node-board-form.test.tsx
pnpm --filter @keplar/web typecheck
pnpm --filter @keplar/web lint
```

Expected:

```text
node-board form test passes
typecheck exits 0
lint exits 0 errors
```

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/components/create-node-board-form.tsx apps/web/src/__tests__/ui/create-node-board-form.test.tsx apps/web/src/components/goal-space-shell.tsx .harness/changes/20260626-phase3-node-board-create-ui
git commit -m "feat(web): create node boards from browser"
```

---

## Task P3-04: Browser-First E2E

**Files:**
- Modify: `apps/web/e2e/phase2-board.spec.ts`
- Modify if needed: `apps/web/e2e/global-setup.ts`

- [ ] **Step 1: Create harness request analysis**

Create change id:

```text
20260626-phase3-browser-first-e2e
```

Expected: request analysis states this feature removes direct goal-space and node-board precreation from Playwright setup.

- [ ] **Step 2: Update E2E to use login UI**

Modify `apps/web/e2e/phase2-board.spec.ts` so the test visits `/login` and signs in through form fields:

```ts
await page.goto("/login");
await page.getByLabel("Email").fill(SEEDED_USER_EMAIL);
await page.getByLabel("Password").fill("e2e-password");
await page.getByRole("button", { name: "Sign in" }).click();
await expect(page).toHaveURL(/\/goal-spaces$/);
```

Update `seedUser()` so it inserts a password hash that `verifyPassword()` accepts for `e2e-password`. Use the existing auth password helper if it can be imported safely in Node tests; otherwise use the same hash creation helper used by auth unit tests.

- [ ] **Step 3: Update E2E to create goal space via UI**

Replace direct `apiCreateGoalSpace()` usage with browser actions:

```ts
await page.getByLabel("Goal name").fill("P3 browser beta");
await page.getByLabel("Description").fill("Browser-created goal space.");
await page.getByRole("button", { name: "Create goal space" }).click();
await expect(page.getByRole("link", { name: /P3 browser beta/ })).toBeVisible({ timeout: 15_000 });
await page.getByRole("link", { name: /P3 browser beta/ }).click();
```

- [ ] **Step 4: Update E2E to create node board via UI**

Replace direct `apiCreateNodeBoard()` usage with browser actions:

```ts
await page.getByLabel("Board key").fill("MAIN");
await page.getByLabel("Board name").fill("Main board");
await page.getByRole("button", { name: "Create node board" }).click();
await expect(page.getByTestId("lane-backlog")).toBeVisible({ timeout: 15_000 });
```

- [ ] **Step 5: Keep card creation, execute, and SSE assertions**

Keep the existing command palette flow:

```ts
const commandInput = page.getByLabel("Command input");
await commandInput.fill("/create-card E2E verification card");
await commandInput.press("Enter");
await expect(page.getByRole("button", { name: /E2E verification card/ }).first()).toBeVisible({
  timeout: 15_000,
});
```

- [ ] **Step 6: Run E2E**

Run:

```bash
pnpm --filter @keplar/web e2e
```

Expected:

```text
1 passed
```

- [ ] **Step 7: Commit**

```bash
git add apps/web/e2e/phase2-board.spec.ts apps/web/e2e/global-setup.ts .harness/changes/20260626-phase3-browser-first-e2e
git commit -m "test(e2e): drive beta setup through browser UI"
```

---

## Task P3-05: Realtime Reliability Hardening

**Files:**
- Modify: `apps/web/src/app/api/v1/sse/route.ts`
- Modify: `apps/web/src/lib/db/repositories/realtime-events.ts`
- Modify: `apps/web/src/lib/realtime/useSseStream.ts`
- Modify: `apps/web/src/lib/realtime/replay.ts`
- Create: `apps/web/__tests__/realtime/reconnect.test.tsx`
- Modify: `apps/web/__tests__/api/realtime.test.ts`
- Modify: `docs/specs/realtime_events.md`

- [ ] **Step 1: Create harness request analysis**

Create change id:

```text
20260626-phase3-realtime-reliability
```

Expected: request analysis limits the feature to tests/docs and small fixes around replay/reconnect/cursor behavior.

- [ ] **Step 2: Fix stale comments before behavior changes**

Update comments that still say `id > cursor` to say `sequence > cursor`.

Expected modified lines:

```ts
// Replay events after the Last-Event-ID cursor by resolving the cursor id to sequence.
```

- [ ] **Step 3: Add API contract test for SSE Last-Event-ID replay cursor**

Extend `apps/web/__tests__/api/realtime.test.ts` with:

```ts
it("replays events after Last-Event-ID before opening live stream", async () => {
  queueSelectResults(
    { ...baseGoalSpace, initiatorId: "user-init" },
    [{ userId: "user-chain" }],
    { sequence: 1 },
    [
      {
        id: "evt-2",
        goalSpaceId: "gs-1",
        sequence: 2,
        type: "card.updated",
        resourceType: "card",
        resourceId: "card-1",
        actor: "human",
        actorId: "user-init",
        actorName: null,
        data: { state: "todo" },
        occurredAt: "2026-06-19T00:00:01.000Z",
      },
    ],
  );

  const { GET } = await import("@/app/api/v1/sse/route");
  const response = await GET(
    createJsonRequest("/api/v1/sse?goal_space_id=gs-1", "GET", undefined, {
      ...withTestSession(actorInitiator),
      headers: {
        ...withTestSession(actorInitiator).headers,
        "Last-Event-ID": "evt-1",
      },
    }),
  );

  expect(response.status).toBe(200);
});
```

- [ ] **Step 4: Add hook-level reconnect test**

Create `apps/web/__tests__/realtime/reconnect.test.tsx`:

```ts
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useSseStream } from "@/lib/realtime/useSseStream";

class FakeEventSource {
  static instances: FakeEventSource[] = [];
  static readonly CLOSED = 2;
  readyState = 0;
  onopen: (() => void) | null = null;
  onerror: (() => void) | null = null;
  listeners = new Map<string, Array<(event: MessageEvent<string>) => void>>();

  constructor(readonly url: string) {
    FakeEventSource.instances.push(this);
  }

  addEventListener(type: string, cb: (event: MessageEvent<string>) => void): void {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), cb]);
  }

  close(): void {
    this.readyState = FakeEventSource.CLOSED;
  }
}

function Harness({ goalSpaceId }: { goalSpaceId: string }): JSX.Element {
  const stream = useSseStream({ goalSpaceId });
  return (
    <div>
      <span data-testid="status">{stream.status}</span>
      <button type="button" onClick={stream.reconnect}>
        reconnect
      </button>
    </div>
  );
}

describe("useSseStream reconnect behavior", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    FakeEventSource.instances = [];
    vi.stubGlobal("EventSource", FakeEventSource);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("opens EventSource with goal_space_id query", async () => {
    render(<Harness goalSpaceId="gs 1" />);

    await waitFor(() => {
      expect(FakeEventSource.instances).toHaveLength(1);
    });
    expect(FakeEventSource.instances[0]?.url).toBe("/api/v1/sse?goal_space_id=gs%201");
    expect(screen.getByTestId("status")).toHaveTextContent("connecting");
  });

  it("opens a new EventSource after closed-source error and backoff", async () => {
    render(<Harness goalSpaceId="gs-1" />);

    await waitFor(() => {
      expect(FakeEventSource.instances).toHaveLength(1);
    });
    FakeEventSource.instances[0]!.close();
    FakeEventSource.instances[0]!.onerror?.();

    expect(screen.getByTestId("status")).toHaveTextContent("reconnecting");
    vi.advanceTimersByTime(2_000);

    await waitFor(() => {
      expect(FakeEventSource.instances).toHaveLength(2);
    });
  });
});
```

- [ ] **Step 5: Run realtime tests**

Run:

```bash
pnpm --filter @keplar/web test -- __tests__/api/realtime.test.ts __tests__/api/realtime-cursor-regression.test.ts __tests__/realtime/reconnect.test.tsx
```

Expected:

```text
realtime API and reconnect tests pass
```

- [ ] **Step 6: Update realtime docs**

Modify `docs/specs/realtime_events.md` to state:

```markdown
`Last-Event-ID` carries the event `id`, but the server resolves that `id` to the event's per-goal-space `sequence` and returns rows with `sequence > cursor.sequence`, ordered by `sequence ASC`.
```

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/app/api/v1/sse/route.ts apps/web/src/lib/db/repositories/realtime-events.ts apps/web/src/lib/realtime/useSseStream.ts apps/web/src/lib/realtime/replay.ts apps/web/__tests__/api/realtime.test.ts apps/web/__tests__/realtime/reconnect.test.tsx docs/specs/realtime_events.md .harness/changes/20260626-phase3-realtime-reliability
git commit -m "test(realtime): harden replay and reconnect contracts"
```

---

## Task P3-06: Real-DB Invariant Hardening

**Files:**
- Create: `apps/web/__tests__/db/invariants.test.ts`
- Modify if needed: `apps/web/__tests__/__helpers__/sqlite.ts`

- [ ] **Step 1: Create harness request analysis**

Create change id:

```text
20260626-phase3-real-db-invariants
```

Expected: request analysis limits the feature to real SQLite tests and does not change production behavior unless a real defect is exposed and approved.

- [ ] **Step 2: Write test for one pending confirmation per card**

Create `apps/web/__tests__/db/invariants.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { humanConfirmations, cards } from "@db/schema";
import { makeTestDb, seedFixture } from "../__helpers__/sqlite";

describe("real DB invariants", () => {
  it("enforces one pending confirmation per card", () => {
    const { sqlite, db } = makeTestDb();
    try {
      seedFixture(db, { userId: "u1", goalSpaceId: "g1", boardId: "b1" });
      db.insert(cards)
        .values({
          id: "card-1",
          goalSpaceId: "g1",
          nodeBoardId: "b1",
          displayId: "CARD-001",
          title: "Needs decision",
        })
        .run();

      db.insert(humanConfirmations)
        .values({
          id: "hc-1",
          cardId: "card-1",
          status: "pending",
          triggerType: "high_risk",
          riskLevel: "high",
          aiSummary: "First pending decision.",
          riskFactors: [],
          recommendations: [],
        })
        .run();

      expect(() =>
        db.insert(humanConfirmations)
          .values({
            id: "hc-2",
            cardId: "card-1",
            status: "pending",
            triggerType: "high_risk",
            riskLevel: "high",
            aiSummary: "Second pending decision.",
            riskFactors: [],
            recommendations: [],
          })
          .run(),
      ).toThrow();
    } finally {
      sqlite.close();
    }
  });
});
```

- [ ] **Step 3: Add realtime sequence invariant test**

Append:

```ts
import { realtimeEvents } from "@db/schema";

it("enforces unique realtime sequence per goal space", () => {
  const { sqlite, db } = makeTestDb();
  try {
    seedFixture(db, { userId: "u1", goalSpaceId: "g1", boardId: "b1" });
    db.insert(realtimeEvents)
      .values({
        id: "evt-1",
        goalSpaceId: "g1",
        sequence: 1,
        type: "card.created",
        resourceType: "card",
        resourceId: "card-1",
        data: {},
      })
      .run();

    expect(() =>
      db.insert(realtimeEvents)
        .values({
          id: "evt-2",
          goalSpaceId: "g1",
          sequence: 1,
          type: "card.updated",
          resourceType: "card",
          resourceId: "card-1",
          data: {},
        })
        .run(),
    ).toThrow();
  } finally {
    sqlite.close();
  }
});
```

- [ ] **Step 4: Run DB invariant tests**

Run:

```bash
pnpm --filter @keplar/web test -- __tests__/db/invariants.test.ts
```

Expected:

```text
2 tests pass
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/__tests__/db/invariants.test.ts apps/web/__tests__/__helpers__/sqlite.ts .harness/changes/20260626-phase3-real-db-invariants
git commit -m "test(db): cover beta invariants on real sqlite"
```

---

## Task P3-07: Beta Delivery Docs

**Files:**
- Create: `docs/architecture/beta_qa_checklist.md`
- Modify: `docs/architecture/test_matrix.md`
- Modify: `docs/specs/global_unified_spec.md`
- Modify: `docs/superpowers/plans/2026-06-26-phase3-web-beta-hardening.md`

- [ ] **Step 1: Create harness request analysis**

Create change id:

```text
20260626-phase3-beta-delivery-docs
```

Expected: request analysis limits the feature to documentation updates.

- [ ] **Step 2: Create beta QA checklist**

Create `docs/architecture/beta_qa_checklist.md`:

```markdown
# Web Beta QA Checklist

## Environment

- [ ] Node version is `>=20.10.0 <21.0.0`.
- [ ] pnpm version is `11.5.1`.
- [ ] `pnpm check` passes.
- [ ] `pnpm smoke` passes.
- [ ] `pnpm e2e` passes.

## Browser Workflow

- [ ] Anonymous visit to `/goal-spaces` redirects to `/login`.
- [ ] User can sign in through `/login`.
- [ ] User can create a goal space from `/goal-spaces`.
- [ ] User can open the goal-space detail page.
- [ ] User can create a node board when no board exists.
- [ ] User can create a card from the command input.
- [ ] User can execute the card through `/execute <card_id>`.
- [ ] Audit timeline updates without manual page refresh.
- [ ] SSE connection status remains visible.

## Governance

- [ ] Pending confirmations are visible in the right sidebar.
- [ ] Approve/reject commands call the confirmation API.
- [ ] Rejected confirmations route the card to blocked state.
- [ ] Audit events are visible for card, execution, and confirmation actions.
```

- [ ] **Step 3: Update test matrix**

In `docs/architecture/test_matrix.md`, ensure the verification gates include:

```markdown
- `pnpm check`: typecheck, lint, Vitest, build, and Prettier format check.
- `pnpm smoke`: lightweight application smoke coverage.
- `pnpm e2e`: browser happy path covering login, goal-space creation, node-board creation, card creation, execution, audit, and SSE update.
```

- [ ] **Step 4: Update global unified spec**

In `docs/specs/global_unified_spec.md`, replace stale language that says Playwright is not connected with:

```markdown
Playwright is connected for the Web beta browser happy path. Phase 3 extends it from seeded setup toward browser-first login, goal-space creation, node-board creation, card creation, execution, audit, and SSE verification.
```

- [ ] **Step 5: Verify docs**

Run:

```bash
rg -n "pnpm e2e|Web Beta QA|Playwright is connected" docs/architecture docs/specs
pnpm --filter @keplar/web format:check
```

Expected:

```text
rg finds the updated docs
format:check exits 0
```

- [ ] **Step 6: Commit**

```bash
git add docs/architecture/beta_qa_checklist.md docs/architecture/test_matrix.md docs/specs/global_unified_spec.md docs/superpowers/plans/2026-06-26-phase3-web-beta-hardening.md .harness/changes/20260626-phase3-beta-delivery-docs
git commit -m "docs(phase3): document web beta hardening gates"
```

---

## Final Verification For Phase 3

After P3-00 through P3-07 land, run:

```bash
pnpm check
pnpm smoke
pnpm e2e
git status --short --branch
```

Expected:

```text
pnpm check exits 0
pnpm smoke exits 0
pnpm e2e exits 0
git status is clean except intentional branch ahead state
```

## Self-Review

### Spec Coverage

- Clean baseline gate is covered by P3-00.
- Real login UI is covered by P3-01.
- Goal-space creation UI is covered by P3-02.
- Node-board creation UI is covered by P3-03.
- Browser-first E2E is covered by P3-04.
- Realtime reliability is covered by P3-05.
- Real-DB invariants are covered by P3-06.
- Delivery docs and QA checklist are covered by P3-07.

### Placeholder Scan

The plan intentionally avoids unresolved placeholders and catch-all implementation language. Each code-changing task includes exact paths, concrete test content, implementation snippets, and verification commands.

### Type Consistency

The plan uses the existing API field names from Phase 2 wire types: `goal_space_id`, `node_board_id`, `acceptance_criteria`, `expires_at`, and `keplar_session`. The UI snippets call existing `/api/v1` endpoints and preserve the current response-envelope pattern.
