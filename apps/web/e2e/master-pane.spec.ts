import { test, expect } from "@playwright/test";

test.describe("master pane", () => {
  test("groups tasks under goal-space sections and supports expand/collapse", async ({ page }) => {
    await page.goto("/goal-spaces");
    await page.request.post("/api/v1/auth/login", {
      data: { email: "e2e@keplar.test", password: "e2e-password" },
    });
    await page.goto("/goal-spaces");
    const firstLink = page.getByRole("link", { name: /CARD-/ }).first();
    await expect(firstLink).toBeVisible({ timeout: 15_000 });
    const chevron = page.getByRole("button", { name: "Collapse" }).first();
    await chevron.click();
    expect(page.getByRole("button", { name: "Expand" }).first()).toBeVisible();
  });
});
