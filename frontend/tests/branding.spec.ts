import { test, expect } from "@playwright/test";

test("Original bundled logo loads when the branding API fails", async ({ page }) => {
  await page.route("**/api/branding/logo", (route) =>
    route.fulfill({ status: 500, contentType: "application/json", body: '{"detail":"Unavailable"}' }),
  );
  await page.goto("/login");
  const logo = page.getByRole("img", { name: "Casamelia International" });
  await expect(logo).toHaveAttribute("src", "/app-logo.png");
  await expect.poll(() => logo.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
  await page.screenshot({ path: test.info().outputPath("logo-fallback.png") });
  await page.getByLabel("Username", { exact: true }).fill("admin");
  await page.getByLabel("Password", { exact: true }).fill("admin123");
  await page.getByRole("button", { name: "LOGIN", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Quotation dashboard" })).toBeVisible();
  await expect(page.getByRole("img", { name: "Casamelia International" })).toHaveAttribute("src", "/app-logo.png");
});

test("Admin and Sales sessions survive refresh and navigation, then logout clears them", async ({ page }) => {
  for (const user of ["admin", "sales"]) {
    await page.goto("/login");
    await page.getByLabel("Username", { exact: true }).fill(user);
    await page.getByLabel("Password", { exact: true }).fill(user + "123");
    await page.getByRole("button", { name: "LOGIN", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Quotation dashboard" })).toBeVisible();
    await page.reload();
    await expect(page.getByRole("heading", { name: "Quotation dashboard" })).toBeVisible();
    await page.getByRole("link", { name: "Customers", exact: true }).click();
    await expect(page).toHaveURL(/\/customers$/);
    const me = await page.request.get("/api/auth/me");
    expect(me.status()).toBe(200);
    expect((await me.json()).role).toBe(user);
    const cookies = await page.context().cookies();
    expect(cookies.find((cookie) => cookie.name === "casa_session")?.httpOnly).toBe(true);
    if (user === "sales") {
      expect((await page.request.get("/api/users")).status()).toBe(403);
    }
    await page.getByRole("button", { name: "Log out", exact: true }).click();
    await expect(page).toHaveURL(/\/login$/);
    expect((await page.request.get("/api/auth/me")).status()).toBe(401);
  }
});
