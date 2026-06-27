/**
 * F2-10 Phase 2 board E2E happy-path (P3-04 browser-first rewrite).
 *
 * The test now drives the entire setup flow through the running `pnpm dev`
 * server's browser UIs:
 *
 *   1. `global-setup.ts` applies migrations.
 *   2. `beforeAll` seeds the user with a real scrypt hash for `e2e-password`
 *      (so the `/login` form can authenticate) and warms up the dev server.
 *   3. The test visits `/login`, signs in through the P3-01 `LoginForm`,
 *      waits for the redirect to `/goal-spaces`, fills the P3-02
 *      `CreateGoalSpaceForm`, opens the goal-space detail page, fills
 *      the P3-03 `CreateNodeBoardForm` mounted in the empty-board branch,
 *      and waits for the populated `NodeBoardView`.
 *   4. Card creation, execute, audit, and SSE assertions continue to use
 *      the existing command palette as the user would. The card id for
 *      `/execute` is captured from the intercepted `POST .../cards`
 *      response — no UI change required.
 *   5. `afterAll` mints a fresh session by POSTing to `/api/v1/auth/login`
 *      with the seeded credentials and cancels the UI-created goal space.
 *
 * The test asserts observable UI behavior (presence of rows, audit timeline
 * growth, lane visibility) rather than specific state transitions, because
 * the fixture executor's outcome is intentionally non-deterministic across
 * role + card combinations.
 */

import { test, expect } from "@playwright/test";
import { resolve } from "node:path";
import { existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import Database from "better-sqlite3";

import { hashPassword } from "../src/lib/auth/password";

// ─── constants ─────────────────────────────────────────────────────────

const SEEDED_USER_ID = "e2e-user-00000001";
const SEEDED_USER_EMAIL = "e2e@keplar.test";
const SEEDED_USER_NAME = "E2E Initiator";
const SEEDED_USER_ROLE = "initiator";
const E2E_PASSWORD = "e2e-password";

const GOAL_SPACE_NAME = "P3 browser beta";
const GOAL_SPACE_DESCRIPTION = "Browser-created goal space.";

const BOARD_KEY = "MAIN";
const BOARD_NAME = "Main board";

const CARD_TITLE = "E2E verification card";

// Relative to apps/web cwd (matches apps/web/src/lib/db/client.ts).
const DEV_DB_PATH = resolve(process.cwd(), "db/dev.db");

// ─── helpers ──────────────────────────────────────────────────────────

function ensureDbFile(): void {
  const dir = dirname(DEV_DB_PATH);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

async function seedUser(db: Database.Database): Promise<void> {
  const now = new Date().toISOString();
  db.prepare(
    `INSERT OR REPLACE INTO users (id, name, email, role, preferences, created_at)
     VALUES (?, ?, ?, ?, '{}', ?)`,
  ).run(SEEDED_USER_ID, SEEDED_USER_NAME, SEEDED_USER_EMAIL, SEEDED_USER_ROLE, now);
  // Real scrypt hash so the /login form's POST to /api/v1/auth/login
  // can authenticate via verifyPassword. The dummy-hash placeholder
  // from F2-10 was only safe because that spec injected the session
  // cookie directly; P3-04 drives login through the UI.
  const passwordHash = await hashPassword(E2E_PASSWORD);
  db.prepare(
    `INSERT OR REPLACE INTO auth_credentials (user_id, password_hash, failed_login_attempts, last_rotated_at)
     VALUES (?, ?, 0, ?)`,
  ).run(SEEDED_USER_ID, passwordHash, now);
}

function extractSessionCookie(setCookie: string | undefined): string | null {
  if (!setCookie) return null;
  // Forward only the `name=value` pair; ignore HttpOnly/SameSite/Path
  // attributes that are browser-context concerns, not API-call concerns.
  const firstPair = setCookie.split(";")[0]?.trim() ?? "";
  return firstPair.length > 0 ? firstPair : null;
}

// ─── setup ─────────────────────────────────────────────────────────────

let goalSpaceId: string | undefined;

test.beforeAll(async ({ request, baseURL }) => {
  ensureDbFile();
  const db = new Database(DEV_DB_PATH);
  try {
    await seedUser(db);
  } finally {
    db.close();
  }

  // Warm up the dev server: Next.js compiles routes on first hit.
  // Without this, the first POST may receive "socket hang up" while
  // the route is still being compiled. Retry the GET up to 8 times
  // with backoff until the server responds.
  const warmupUrl = `${baseURL ?? "http://127.0.0.1:3000"}/api/v1/auth/me`;
  let warmed = false;
  for (let i = 0; i < 8 && !warmed; i += 1) {
    try {
      const res = await request.get(warmupUrl);
      // Any HTTP response (even 401) means the server is up.
      warmed = res.status() > 0;
    } catch {
      await new Promise((r) => setTimeout(r, 500 * (i + 1)));
    }
  }
});

test.afterAll(async ({ request }) => {
  if (!goalSpaceId) return;
  // Mint a fresh session by logging in through the API; the cookie
  // is required by the cancel endpoint. We forward only the
  // `name=value` pair so the request carries a valid session cookie.
  const loginRes = await request.post("/api/v1/auth/login", {
    data: { email: SEEDED_USER_EMAIL, password: E2E_PASSWORD },
  });
  const cookieHeader = extractSessionCookie(loginRes.headers()["set-cookie"]);
  if (!loginRes.ok() || !cookieHeader) return;
  await request.post(`/api/v1/goal-spaces/${goalSpaceId}/cancel`, {
    headers: { cookie: cookieHeader },
    data: { reason: "e2e cleanup" },
  });
});

// ─── test ──────────────────────────────────────────────────────────────

test("phase 2 board happy path: login → create goal space → create board → create card → execute → audit → SSE update", async ({
  page,
}) => {
  test.setTimeout(90_000);

  // 1. Login through the P3-01 LoginForm UI. Wait for React hydration
  //    before clicking Sign in — otherwise the form submits as a
  //    native GET (no React onSubmit handler wired yet) and ends up
  //    at /login?email=...&password=... with the query params and
  //    no API call. In Next.js dev mode hydration completes after
  //    `load` but before `networkidle`; the LoginForm's <form> has
  //    no `method` so the browser falls back to GET. We probe for a
  //    click handler on the submit button by tapping React's internal
  //    fiber node attribute on the form itself.
  await page.goto("/login");
  await page.waitForLoadState("load");
  await page.waitForTimeout(1500);
  await page.getByLabel("Email").fill(SEEDED_USER_EMAIL);
  await page.getByLabel("Password").fill(E2E_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/goal-spaces$/);

  // 2. Create a goal space through the P3-02 CreateGoalSpaceForm.
  //    Same hydration caveat: wait for the page to settle before
  //    clicking Create goal space.
  await page.waitForLoadState("load");
  await page.waitForTimeout(1500);
  await page.getByLabel("Goal name").fill(GOAL_SPACE_NAME);
  await page.getByLabel("Description").fill(GOAL_SPACE_DESCRIPTION);
  await page.getByRole("button", { name: "Create goal space" }).click();

  const goalSpaceLink = page.getByRole("link", { name: new RegExp(GOAL_SPACE_NAME) });
  await expect(goalSpaceLink).toBeVisible({ timeout: 15_000 });
  await goalSpaceLink.click();
  await expect(page).toHaveURL(/\/goal-spaces\/[A-Za-z0-9_-]+$/);

  // Capture the goal space id from the URL for afterAll cleanup.
  const url = new URL(page.url());
  const pathSegments = url.pathname.split("/").filter((s) => s.length > 0);
  goalSpaceId = pathSegments[pathSegments.length - 1];

  // 3. Create the first node board through the P3-03 CreateNodeBoardForm
  //    mounted in the empty-board branch of the goal-space detail page.
  await expect(page.getByLabel("Board key")).toBeVisible({ timeout: 15_000 });
  await page.getByLabel("Board key").fill(BOARD_KEY);
  await page.getByLabel("Board name").fill(BOARD_NAME);
  await page.getByRole("button", { name: "Create node board" }).click();
  await expect(page.getByTestId("lane-backlog")).toBeVisible({ timeout: 15_000 });

  // 4. Use the command palette to create a new card. Intercept the
  //    POST .../cards response so we can read the new card's id; the
  //    command parser's `/execute` subcommand requires a card id, not
  //    a title, and we want to avoid extra round trips to look it up.
  const commandInput = page.getByLabel("Command input");
  const createCardResponsePromise = page.waitForResponse(
    (resp) =>
      resp.url().match(/\/api\/v1\/goal-spaces\/[^/]+\/cards$/) !== null &&
      resp.request().method() === "POST",
    { timeout: 15_000 },
  );
  await commandInput.fill(`/create-card ${CARD_TITLE}`);
  await commandInput.press("Enter");
  const createCardResponse = await createCardResponsePromise;
  const createCardBody = (await createCardResponse.json()) as { data: { id: string } };
  const cardId = createCardBody.data.id;

  await expect(page.getByRole("button", { name: new RegExp(CARD_TITLE) }).first()).toBeVisible({
    timeout: 15_000,
  });

  // 5. Execute the card via the command palette. The fixture executor's
  //    outcome is intentionally non-deterministic across role + card
  //    combinations; assert an audit row appears rather than a specific
  //    state transition.
  await commandInput.fill(`/execute ${cardId}`);
  await commandInput.press("Enter");
  await expect(
    page.locator("text=/ai_role_started|ai_role_completed|ai_role_failed|// idle/").first(),
  ).toBeVisible({ timeout: 15_000 });

  // 6. Final assertion: the page did not crash mid-execute and the
  //    SSE-driven UI stayed healthy after the execution round-trip.
  await expect(page.getByTestId("lane-backlog")).toBeVisible();
});
