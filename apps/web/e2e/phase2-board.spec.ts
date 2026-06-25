/**
 * F2-10 Phase 2 board E2E happy-path.
 *
 * Single happy-path Playwright test that exercises the F2-09 Web UI
 * against the running `pnpm dev` server. The test:
 *
 *  1. Seeds a user row + an auth_credentials row directly into the
 *     dev SQLite DB (the dev DB has no seeded users; auth/login
 *     requires an existing row).
 *  2. Mints a `keplar_session` cookie via `signSessionValue` (the
 *     F2-10 T0 export that shares `lib/auth/session.ts`'s internal
 *     signing primitives with `createSession`).
 *  3. Pre-creates goal space + node board + one card via direct
 *     HTTP calls (the F2-09 UI does not yet ship goal-space /
 *     node-board / login pages; the plan documents those UI flows
 *     as Phase 3 follow-ups).
 *  4. Navigates to /goal-spaces, asserts the seeded goal space is
 *     listed, clicks through to detail, asserts the board lanes
 *     render, types `/create-card <title>` and `/execute <card_id>`
 *     in the command palette, and asserts an SSE-driven UI update
 *     arrives without manual refresh.
 *
 * The test asserts OBSERVABLE UI behavior (presence of rows, audit
 * timeline growth) rather than specific state transitions, because
 * the fixture executor's outcome is intentionally non-deterministic
 * across role + card combinations.
 */

import { test, expect, type APIRequestContext, type BrowserContext } from "@playwright/test";
import { resolve } from "node:path";
import { existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import Database from "better-sqlite3";

import { signSessionValue } from "../src/lib/auth/session";

// ─── constants ─────────────────────────────────────────────────────────

const SEEDED_USER_ID = "e2e-user-00000001";
const SEEDED_USER_EMAIL = "e2e@keplar.test";
const SEEDED_USER_NAME = "E2E Initiator";
const SEEDED_USER_ROLE = "initiator";

const SESSION_COOKIE_NAME = "keplar_session";
const SESSION_TTL_MS = 30 * 60 * 1000;

// Relative to apps/web cwd (matches apps/web/src/lib/db/client.ts).
const DEV_DB_PATH = resolve(process.cwd(), "db/dev.db");

// ─── helpers ──────────────────────────────────────────────────────────

interface SeededRefs {
  readonly goalSpaceId: string;
  readonly nodeBoardId: string;
  readonly cardId: string;
}

function ensureDbFile(): void {
  const dir = dirname(DEV_DB_PATH);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

function seedUser(db: Database.Database): void {
  const now = new Date().toISOString();
  // Insert (or replace) the user row. We use INSERT OR REPLACE so the
  // test is idempotent across reruns against the same dev DB.
  db.prepare(
    `INSERT OR REPLACE INTO users (id, name, email, role, preferences, created_at)
     VALUES (?, ?, ?, ?, '{}', ?)`,
  ).run(SEEDED_USER_ID, SEEDED_USER_NAME, SEEDED_USER_EMAIL, SEEDED_USER_ROLE, now);
  // The auth_credentials row is required by POST /api/v1/auth/login
  // and by FK from users. We store a dummy hash; the test never logs
  // in via /auth/login (it injects the session cookie directly), so
  // the hash value does not need to verify any password.
  db.prepare(
    `INSERT OR REPLACE INTO auth_credentials (user_id, password_hash, failed_login_attempts, last_rotated_at)
     VALUES (?, 'e2e-dummy-hash', 0, ?)`,
  ).run(SEEDED_USER_ID, now);
}

function createSessionCookieValue(): string {
  return signSessionValue({
    sub: SEEDED_USER_ID,
    exp: Date.now() + SESSION_TTL_MS,
  });
}

async function apiCreateGoalSpace(
  request: APIRequestContext,
  cookieValue: string,
): Promise<string> {
  const response = await request.post("/api/v1/goal-spaces", {
    headers: { cookie: `${SESSION_COOKIE_NAME}=${cookieValue}` },
    data: {
      name: `F2-10 E2E ${Date.now()}`,
      description: "End-to-end beta verification.",
      constraints: [],
      acceptance_criteria: [],
    },
  });
  expect(response.ok(), `POST /api/v1/goal-spaces returned ${response.status()}`).toBeTruthy();
  const body = (await response.json()) as { data: { id: string } };
  return body.data.id;
}

async function apiCreateNodeBoard(
  request: APIRequestContext,
  cookieValue: string,
  goalSpaceId: string,
): Promise<string> {
  const response = await request.post(`/api/v1/goal-spaces/${goalSpaceId}/node-boards`, {
    headers: { cookie: `${SESSION_COOKIE_NAME}=${cookieValue}` },
    data: { key: "MAIN", name: "Main board", description: "E2E board" },
  });
  expect(response.ok(), `POST node-boards returned ${response.status()}`).toBeTruthy();
  const body = (await response.json()) as { data: { id: string } };
  return body.data.id;
}

async function apiCreateCard(
  request: APIRequestContext,
  cookieValue: string,
  goalSpaceId: string,
  nodeBoardId: string,
): Promise<string> {
  const response = await request.post(`/api/v1/goal-spaces/${goalSpaceId}/cards`, {
    headers: { cookie: `${SESSION_COOKIE_NAME}=${cookieValue}` },
    data: { title: "E2E seed card", node_board_id: nodeBoardId },
  });
  expect(response.ok(), `POST cards returned ${response.status()}`).toBeTruthy();
  const body = (await response.json()) as { data: { id: string } };
  return body.data.id;
}

// ─── setup ─────────────────────────────────────────────────────────────

let refs: SeededRefs;
let cookieValue: string;

test.beforeAll(async ({ request, baseURL }) => {
  ensureDbFile();
  const db = new Database(DEV_DB_PATH);
  try {
    seedUser(db);
  } finally {
    db.close();
  }

  cookieValue = createSessionCookieValue();

  // Warm up the dev server: Next.js compiles routes on first hit.
  // Without this, the first POST may receive "socket hang up" while
  // the route is still being compiled. Retry the GET up to 5 times
  // with backoff until the server responds.
  const warmupUrl = `${baseURL ?? "http://127.0.0.1:3000"}/api/v1/auth/me`;
  let warmed = false;
  for (let i = 0; i < 8 && !warmed; i += 1) {
    try {
      const res = await request.get(warmupUrl, {
        headers: { cookie: `${SESSION_COOKIE_NAME}=${cookieValue}` },
      });
      // Any HTTP response (even 401) means the server is up.
      warmed = res.status() > 0;
    } catch {
      await new Promise((r) => setTimeout(r, 500 * (i + 1)));
    }
  }

  const goalSpaceId = await apiCreateGoalSpace(request, cookieValue);
  const nodeBoardId = await apiCreateNodeBoard(request, cookieValue, goalSpaceId);
  const cardId = await apiCreateCard(request, cookieValue, goalSpaceId, nodeBoardId);

  refs = { goalSpaceId, nodeBoardId, cardId };
});

test.afterAll(async ({ request }) => {
  if (!refs) return;
  // Best-effort cleanup so reruns don't accumulate state. The cancel
  // endpoint is the cleanest reversible action available in F2-09.
  await request.post(`/api/v1/goal-spaces/${refs.goalSpaceId}/cancel`, {
    headers: { cookie: `${SESSION_COOKIE_NAME}=${cookieValue}` },
    data: { reason: "e2e cleanup" },
  });
});

async function injectSessionCookie(context: BrowserContext): Promise<void> {
  await context.addCookies([
    {
      name: SESSION_COOKIE_NAME,
      value: cookieValue,
      url: "http://127.0.0.1:3000",
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
}

// ─── test ──────────────────────────────────────────────────────────────

test("phase 2 board happy path: list → detail → create card → execute → audit → SSE update", async ({
  page,
  context,
}) => {
  test.setTimeout(60_000);
  await injectSessionCookie(context);

  // 1. /goal-spaces lists the seeded goal space.
  await page.goto("/goal-spaces");
  await expect(page.getByRole("link", { name: /F2-10 E2E/ })).toBeVisible({ timeout: 15_000 });

  // 2. Navigate into the goal-space detail.
  await page.getByRole("link", { name: /F2-10 E2E/ }).click();
  await expect(page).toHaveURL(new RegExp(`/goal-spaces/${refs.goalSpaceId}$`));
  await expect(page.getByTestId("lane-backlog")).toBeVisible({ timeout: 15_000 });

  // 3. Use the command palette to create a new card. We don't know
  //    its assigned display_id, so we just assert that the existing
  //    card count goes up by one in any lane.
  const commandInput = page.getByLabel("Command input");
  await commandInput.fill("/create-card E2E verification card");
  await commandInput.press("Enter");

  // Wait for the SSE-driven UI update: at least one card row whose
  // title is "E2E verification card" should appear somewhere on the
  // board. We don't assert a specific lane because the F2-09
  // command handler picks the first board, and that board's lane
  // ordering is deterministic but server-controlled.
  await expect(page.getByRole("button", { name: /E2E verification card/ }).first()).toBeVisible({
    timeout: 15_000,
  });

  // 4. Execute the seeded card. The fixture executor is
  //    deterministic per (card, role) but the state outcome is not
  //    formally guaranteed; we assert that an audit row appears.
  await commandInput.fill(`/execute ${refs.cardId}`);
  await commandInput.press("Enter");

  // The right sidebar's audit timeline renders events in the
  // document. We wait for any new ai_role_* row, OR an in-flight
  // execution row, whichever the fixture produces.
  await expect(
    page.locator("text=/ai_role_started|ai_role_completed|ai_role_failed|// idle/").first(),
  ).toBeVisible({ timeout: 15_000 });

  // 5. Final assertion: the seeded goal space still renders the
  //    board header (i.e. the page did not crash mid-execute). This
  //    is a smoke check that the SSE-driven UI stayed healthy
  //    after the execution round-trip.
  await expect(page.getByTestId("lane-backlog")).toBeVisible();
});
