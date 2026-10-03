import { test, expect, Page } from "@playwright/test";
const baseURL = process.env.E2E_BASE_URL || "http://127.0.0.1:3101";
async function login(page: Page, role = "sales") {
  await page.goto("/login");
  await page.getByLabel("Username", { exact: true }).fill(role);
  await page.getByLabel("Password", { exact: true }).fill(role + "123");
  await page.getByRole("button", { name: "LOGIN", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Quotation dashboard" }),
  ).toBeVisible();
}
async function fits(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth + 1,
      ),
    )
    .toBe(true);
}

test("Phone quotation creation, touch navigation, PDF downloads and shared laptop data", async ({
  browser,
}) => {
  const mobile = await browser.newContext({
    baseURL,
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const page = await mobile.newPage();
  await login(page);
  await page.getByRole("button", { name: "Toggle menu" }).click();
  await expect(
    page.getByRole("dialog", { name: "Workspace navigation" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Customers", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Customers", exact: true }),
  ).toBeVisible();
  await fits(page);
  await page.goto("/quotations/new");
  await page
    .getByLabel("Customer name", { exact: true })
    .fill("Mobile site customer");
  await page
    .getByLabel("Project reference", { exact: true })
    .fill("MOBILE-SITE-QA");
  await page
    .getByLabel("Address", { exact: true })
    .fill("Entered project site address");
  await page
    .getByRole("button", { name: "Save customer", exact: true })
    .click();
  await expect(page.locator(".success")).toContainText("Customer saved");
  await page.getByRole("button", { name: "Add area / section" }).click();
  await page
    .getByLabel("Section 1 catalogue area")
    .selectOption({ label: "Kitchen" });
  await page.getByPlaceholder("Area / section name").fill("Kitchen");
  await page.getByRole("button", { name: "Add item", exact: true }).click();
  await page
    .getByRole("button", { name: "Select product combination" })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await fits(page);
  await page.getByLabel("Filter item").selectOption("Base Unit");
  await page.getByLabel("Filter carcass").selectOption("BWP Ply");
  await page.getByLabel("Filter shutter").selectOption("HDHMR");
  await page.getByLabel("Filter finish").selectOption("Laminate");
  await page
    .getByRole("button", { name: /Base Unit.*BWP Ply.*HDHMR.*Laminate.*1,990/ })
    .click();
  await page.getByLabel("Width (ft)").fill("5.5");
  await page.getByLabel("Length (ft)").fill("4");
  await page.getByLabel("Quantity", { exact: true }).fill("1");
  await expect(page.getByLabel("Width (ft)")).toHaveAttribute(
    "inputmode",
    "decimal",
  );
  await expect(page.getByLabel("Override reason")).toHaveCount(0);
  await page.getByRole("button", { name: "Change quotation rate" }).click();
  await page.getByLabel("Quotation rate line 1").fill("1850");
  await page.getByLabel("Override reason").fill("Agreed at customer site");
  await expect(page.locator(".mobile-editor-bar")).toContainText("48,026");
  await fits(page);
  await page.getByRole("button", { name: /Kitchen.*Collapse/ }).click();
  await expect(page.getByLabel("Width (ft)")).toBeHidden();
  await page.getByRole("button", { name: /Kitchen.*Expand/ }).click();
  await expect(page.getByLabel("Width (ft)")).toBeVisible();
  await page.getByRole("button", { name: "SAVE DRAFT", exact: true }).click();
  await expect(page.locator(".success")).toContainText("saved");
  await page.screenshot({
    path: "test-results/mobile-editor.png",
    fullPage: true,
  });
  let downloaded = 0;
  page.on("download", () => downloaded++);
  await page
    .getByRole("button", { name: "GENERATE QUOTATION", exact: true })
    .click();
  await expect(page).toHaveURL(/\/preview\?revision=/);
  await expect(page.locator(".pdf-canvas-frame")).toHaveAttribute(
    "aria-busy",
    "false",
  );
  expect(downloaded).toBe(0);
  await fits(page);
  await page.getByRole("button", { name: "Zoom in", exact: true }).click();
  await page.getByRole("button", { name: "Fit PDF to width" }).click();
  await expect(page.locator(".pdf-canvas-frame")).toHaveAttribute(
    "aria-busy",
    "false",
  );
  await page.screenshot({
    path: "test-results/mobile-preview.png",
    fullPage: true,
  });
  const pdfEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download PDF", exact: true }).click();
  expect((await pdfEvent).suggestedFilename()).toMatch(/\.pdf$/);
  const excelEvent = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Download Excel", exact: true })
    .click();
  expect((await excelEvent).suggestedFilename()).toMatch(/\.xlsx$/);
  const id = page.url().match(/quotations\/(\d+)/)![1];
  const laptop = await browser.newContext({
    baseURL,
    viewport: { width: 1366, height: 768 },
  });
  const other = await laptop.newPage();
  await login(other);
  await other.goto("/quotations");
  await other.getByLabel("Search quotations").fill("MOBILE-SITE-QA");
  await expect(other.locator("tbody tr")).toHaveCount(1);
  await other.goto(`/quotations/${id}/edit`);
  await expect(other.getByLabel("Quantity", { exact: true })).toHaveValue("1");
  await other.getByLabel("Quantity", { exact: true }).fill("2");
  await other.getByRole("button", { name: "SAVE DRAFT", exact: true }).click();
  await expect(other.locator(".success")).toContainText("saved");
  await page.goto(`/quotations/${id}/edit`);
  await expect(page.getByLabel("Quantity", { exact: true })).toHaveValue("2");
  await fits(page);
  await mobile.close();
  await laptop.close();
});

for (const [width, height] of [
  [320, 568],
  [375, 667],
  [390, 844],
  [430, 932],
  [768, 1024],
  [820, 1180],
  [1366, 768],
  [1440, 900],
  [1920, 1080],
]) {
  test(`Responsive management screens at ${width}×${height}`, async ({
    browser,
  }) => {
    test.setTimeout(90000);
    const context = await browser.newContext({
      baseURL,
      viewport: { width, height },
      hasTouch: width < 1024,
      isMobile: width < 768,
    });
    const page = await context.newPage();
    await login(page, "admin");
    for (const route of [
      "/",
      "/quotations",
      "/customers",
      "/master-list",
      "/price-conflicts?status=unresolved",
      "/settings",
      "/areas",
      "/master-list/import",
      "/quotations/new",
    ]) {
      await page.goto(route);
      await expect(page.locator("main h1")).toBeVisible();
      await page.waitForTimeout(250);
      await fits(page);
      if (
        width < 768 &&
        ["/quotations", "/customers", "/master-list"].includes(route)
      ) {
        await expect
          .poll(() =>
            page
              .locator("tbody tr")
              .first()
              .evaluate((el) => getComputedStyle(el).display),
          )
          .toBe("block");
      }
    }
    await page.goto("/");
    await expect(page.locator("a.stat-link").first()).toBeVisible();
    const cols = await page
      .locator(".stats")
      .first()
      .evaluate(
        (el) => getComputedStyle(el).gridTemplateColumns.split(" ").length,
      );
    expect(cols).toBe(width < 768 ? 1 : width < 1024 ? 2 : 4);
    if (width < 1024) {
      await page.getByRole("button", { name: "Toggle menu" }).click();
      await expect(
        page.getByRole("dialog", { name: "Workspace navigation" }),
      ).toBeVisible();
      await page
        .getByRole("button", { name: "Close navigation menu", exact: true })
        .click();
      await expect(page.getByRole("dialog")).toHaveCount(0);
    }
    await page.screenshot({
      path: `test-results/dashboard-${width}.png`,
      fullPage: true,
    });
    const manifest = await (
      await page.request.get("/manifest.webmanifest")
    ).json();
    expect(manifest.display).toBe("standalone");
    expect((await page.request.get("/app-icon.svg")).ok()).toBe(true);
    await expect
      .poll(() =>
        page.evaluate(() =>
          navigator.serviceWorker.getRegistration().then((r) => Boolean(r)),
        ),
      )
      .toBe(true);
    await context.close();
  });
}
