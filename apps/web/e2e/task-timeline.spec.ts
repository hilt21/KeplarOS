import { test, expect } from "@playwright/test";

test.describe("task timeline", () => {
  test("renders timeline entries when navigating to a task", async ({ page }) => {
    await page.request.post("/api/v1/auth/login", {
      data: { email: "e2e@keplar.test", password: "e2e-password" },
    });
    await page.goto("/goal-spaces");
    const cardRow = page.getByRole("button", { name: /CARD-/ }).first();
    await expect(cardRow).toBeVisible({ timeout: 15_000 });
    await cardRow.click();
    await expect(page).toHaveURL(/\/goal-spaces\/[^/]+\/tasks\/[^/]+$/);
    const breadcrumb = page.getByText("backlog");
    await expect(breadcrumb.first()).toBeVisible();
  });
});
