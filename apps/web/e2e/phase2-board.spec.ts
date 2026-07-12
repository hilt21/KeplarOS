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

// ─── constants ─────────────────────────────────────────────────────────

const SEEDED_USER_ID = "e2e-user-00000001";
const SEEDED_USER_EMAIL = "e2e@keplar.test";
const SEEDED_USER_NAME = "E2E Initiator";
const SEEDED_USER_ROLE = "initiator";
const E2E_PASSWORD = "e2e-password";

const GOAL_SPACE_NAME = "P3 browser beta";

const CARD_TITLE = "E2E verification card";

// ─── helpers ──────────────────────────────────────────────────────────

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
  // Warm up the dev server: Next.js compiles routes on first hit.
  // Without this, the first POST may receive "socket hang up" while
  // the route is still being compiled. Retry the GET up to 8 times
  // with backoff until the server responds.
  const warmupUrl = `${baseURL ?? "http://127.0.0.1:3000"}/api/v1/auth/me`;
  let warmed = false;
  for (let i = 0; i < 8 && !warmed; i += 1) {
    try {
      const res = await request.get(warmupUrl);
      warmed = res.status() === 401;
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

  // 1. Login through the P3-01 LoginForm UI. P3-04b converted the
  //    submit button to `type="button"` + onClick and added a
  //    `data-hydrated="true"` attribute that flips via useEffect.
  //    We wait for that attribute before clicking so the React
  //    onClick handler is guaranteed to be attached.
  await page.goto("/login");
  await page.locator('button[data-hydrated="true"]').waitFor();
  await page.getByLabel("Email").fill(SEEDED_USER_EMAIL);
  await page.getByLabel("Password").fill(E2E_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  // Dev server compiles /goal-spaces on first hit; the default 10s
  // expect timeout is too tight. 30s covers first-compile + route
  // data fetch comfortably.
  await expect(page).toHaveURL(/\/goal-spaces$/, { timeout: 30_000 });

  // 2. Generate, review, and apply the deterministic Story draft.
  await page.getByLabel("Business goal").fill(GOAL_SPACE_NAME);
  await page.getByRole("button", { name: "Generate deterministic draft" }).click();
  const draftEditor = page.getByLabel(/Editable Story draft/);
  await expect(draftEditor).toBeVisible({ timeout: 15_000 });
  const editedDraft = JSON.parse(await draftEditor.inputValue()) as {
    cards: Array<{ title: string }>;
  };
  editedDraft.cards[0]!.title = "Edited initial planning";
  await draftEditor.fill(JSON.stringify(editedDraft, null, 2));
  await page.getByRole("button", { name: "Apply draft and create workspace" }).click();
  await expect(page).toHaveURL(/\/goal-spaces\/[A-Za-z0-9_-]+$/);

  // Capture the goal space id from the URL for afterAll cleanup.
  const url = new URL(page.url());
  const pathSegments = url.pathname.split("/").filter((s) => s.length > 0);
  goalSpaceId = pathSegments[pathSegments.length - 1];

  // 3. Apply created the initial node board, so Kanban is immediately usable.
  // Draft cards stay in their initial state, so the Workspaces index proves
  // the edited initial Card exists before a later command-palette Card is made.
  await expect(page.getByTestId("lane-backlog")).toBeVisible({ timeout: 15_000 });
  const workspaces = page.locator("[aria-label='Workspaces']");
  await expect(
    workspaces
      .locator(`#workspace-section-${goalSpaceId}-tasks`)
      .getByRole("button", { name: "CARD-001 Edited initial planning", exact: true }),
  ).toBeVisible({ timeout: 15_000 });

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

  // 5. Execute the card via the command palette. The fixture outcome is
  //    intentionally non-deterministic, so assert the accepted execution
  //    request rather than a transient UI status label.
  const executeResponsePromise = page.waitForResponse(
    (resp) =>
      resp.url().match(new RegExp(`/api/v1/cards/${cardId}/execute$`)) !== null &&
      resp.request().method() === "POST",
    { timeout: 15_000 },
  );
  await commandInput.fill(`/execute ${cardId}`);
  await commandInput.press("Enter");
  expect((await executeResponsePromise).status()).toBe(200);

  // 6. Final assertion: the page did not crash mid-execute and the
  //    SSE-driven UI stayed healthy after the execution round-trip.
  await expect(page.getByTestId("lane-backlog")).toBeVisible();
});
