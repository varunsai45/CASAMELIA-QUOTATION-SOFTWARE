import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
test("Sales selects an area, overrides a project rate, previews then downloads saved documents", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/login");
  await page.getByLabel("Username", { exact: true }).fill("sales");
  await page.getByLabel("Password", { exact: true }).fill("sales123");
  await page.getByRole("button", { name: "LOGIN", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Quotation dashboard" }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Admin settings" })).toHaveCount(
    0,
  );
  await page.getByRole("link", { name: "New quotation", exact: true }).click();
  await page
    .getByLabel("Customer name", { exact: true })
    .fill("Browser QA Customer");
  await page
    .getByLabel("Project reference", { exact: true })
    .fill("BROWSER-QA-2026");
  await page.getByLabel("Address", { exact: true }).fill("Kanakapura");
  await page
    .getByRole("button", { name: "Save customer", exact: true })
    .click();
  await expect(page.locator(".success")).toContainText("Customer saved");
  await page.getByRole("button", { name: "Add area / section" }).click();
  await page
    .getByLabel("Section 1 catalogue area")
    .selectOption({ label: "Kitchen" });
  await page.getByLabel("Section 1 name").fill("FOYER AREA");
  await page.getByRole("button", { name: "Add item", exact: true }).click();
  await page
    .getByRole("button", { name: "Select product combination" })
    .click();
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
  await expect(page.locator(".grand-total")).toContainText("51,660.40");
  await expect(page.getByLabel("Override reason")).toHaveCount(0);
  await page.getByRole("button", { name: "Change quotation rate" }).click();
  await page.getByLabel("Quotation rate line 1").fill("1850");
  await expect(page.getByLabel("Override reason")).toBeVisible();
  await page.getByLabel("Override reason").fill("Temporary reason");
  await page.getByLabel("Quotation rate line 1").fill("1990");
  await expect(page.getByLabel("Override reason")).toHaveCount(0);
  await page.getByLabel("Quotation rate line 1").fill("1850");
  await page.getByLabel("Override reason").fill("Project-specific agreed rate");
  await expect(page.locator(".grand-total")).toContainText("48,026.00");
  await expect(page.locator(".line-price")).toContainText("1,990");
  await page.getByText("Additional charges", { exact: true }).click();
  await page
    .getByLabel("Other description")
    .fill("Cushion and one-time fitting");
  await page.getByLabel("Rate addition").fill("1210");
  await page.getByLabel("One-time charge").fill("4000");
  await expect(page.locator(".grand-total")).toContainText("84,157.60");
  await page.getByRole("button", { name: "SAVE DRAFT" }).click();
  await expect(page.locator(".success")).toContainText("saved");
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: "test-results/quotation-editor.png",
    fullPage: true,
  });
  const downloads: string[] = [];
  page.on("download", (d) => downloads.push(d.suggestedFilename()));
  await page.getByRole("button", { name: "GENERATE QUOTATION" }).click();
  await expect(page).toHaveURL(/\/preview\?revision=/);
  await expect(page.locator(".pdf-canvas-frame")).toHaveAttribute(
    "aria-busy",
    "false",
  );
  await expect(page.locator(".pdf-toolbar")).toContainText("Page 1 /");
  expect(downloads).toHaveLength(0);
  await page.getByRole("button", { name: "Zoom in", exact: true }).click();
  await expect(page.locator(".pdf-toolbar")).toContainText("125%");
  await page.getByRole("button", { name: "Fit PDF to width" }).click();
  await expect(page.locator(".pdf-canvas-frame")).toHaveAttribute(
    "aria-busy",
    "false",
  );
  await page.screenshot({
    path: "test-results/quotation-preview.png",
    fullPage: true,
  });
  const pdfEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download PDF", exact: true }).click();
  const file = await pdfEvent;
  const excelEvent = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Download Excel", exact: true })
    .click();
  const xlsx = await excelEvent;
  expect(file.suggestedFilename()).toMatch(
    /^Casamelia_Quotation_CASA-\d{4}-\d+\.pdf$/,
  );
  const dest = path.join("test-results", file.suggestedFilename());
  await file.saveAs(dest);
  expect(fs.readFileSync(dest).subarray(0, 4).toString()).toBe("%PDF");
  const excelDest = path.join("test-results", xlsx.suggestedFilename());
  await xlsx.saveAs(excelDest);
  expect(fs.readFileSync(excelDest).subarray(0, 2).toString()).toBe("PK");
  await page.getByRole("link", { name: "Close preview" }).click();
  await expect(page.getByRole("heading", { name: /CASA-/ })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Saved document versions" }),
  ).toBeVisible();
  await expect(page.locator(".version-row")).toHaveCount(1);
  const quoteId = page.url().match(/quotations\/(\d+)/)![1];
  const oldVersion = await page.request.get(
    `/api/quotations/${quoteId}/versions`,
  );
  const originalRevision = (await oldVersion.json())[0].revision;
  await page.getByRole("link", { name: "Edit quotation", exact: true }).click();
  await page.getByLabel("Quantity", { exact: true }).fill("2");
  await page.getByRole("button", { name: "GENERATE QUOTATION" }).click();
  await expect(page).toHaveURL(/\/preview\?revision=/);
  await expect(page.locator(".pdf-canvas-frame")).toHaveAttribute(
    "aria-busy",
    "false",
  );
  expect(downloads).toHaveLength(2);
  const oldPdf = await page.request.get(
    `/api/quotations/${quoteId}/pdf?revision=${originalRevision}`,
  );
  expect(await oldPdf.body()).toEqual(fs.readFileSync(dest));
  await page.getByRole("link", { name: "Close preview" }).click();
  await expect(page.locator(".version-row")).toHaveCount(2);
  await page.getByRole("link", { name: "Customers", exact: true }).click();
  await page.getByLabel("Search customers").fill("Browser QA Customer");
  await page
    .getByRole("link", { name: "Browser QA Customer", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Quotation history" }),
  ).toBeVisible();
  await page.getByRole("link", { name: /Preview CASA-/ }).click();
  await expect(page.locator(".pdf-canvas-frame")).toHaveAttribute(
    "aria-busy",
    "false",
  );

  await page.getByRole("link", { name: "Quotations", exact: true }).click();
  await page.getByLabel("Search quotations").fill("BROWSER-QA-2026");
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await expect(page.locator("tbody tr")).toContainText("Browser QA Customer");
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Quotation dashboard" }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/tablet-dashboard.png",
    fullPage: true,
  });
  expect(errors).toEqual([]);
});
test("Admin sees every preserved conflict and resolves one with attribution", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByLabel("Username", { exact: true }).fill("admin");
  await page.getByLabel("Password", { exact: true }).fill("admin123");
  await page.getByRole("button", { name: "LOGIN", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Quotation dashboard" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Master List", exact: true }).click();
  await page
    .getByRole("link", { name: "Price conflicts", exact: true })
    .last()
    .click();
  await expect(page.locator(".conflict-card")).toHaveCount(32);
  await expect(page.locator(".page-heading")).toContainText("32 unresolved");
  await page.screenshot({
    path: "test-results/admin-conflicts.png",
    fullPage: true,
  });
  const first = page.locator(".conflict-card").first();
  await expect(first).toContainText("82,280");
  await expect(first).toContainText("83,550");
  await first.getByRole("button", { name: /Use.*83,550/ }).click();
  await expect(page.locator(".page-heading")).toContainText("31 unresolved");
  await page.getByRole("button", { name: "Resolved history" }).click();
  await expect(page.locator(".conflict-card")).toHaveCount(1);
  await expect(page.locator(".resolution")).toContainText("Resolved by admin");
  await expect(page.locator(".conflict-card")).toContainText("82,280");
  await expect(page.locator(".resolution")).toContainText("83,550");
  await page.getByRole("link", { name: "Admin settings" }).click();
  await expect(page.getByRole("heading", { name: "Audit log" })).toBeVisible();
  await expect(page.locator(".audit-row").first()).toContainText(
    "price conflict resolved",
  );
});

test("Dashboard cards navigate and apply their filters", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Username", { exact: true }).fill("admin");
  await page.getByLabel("Password", { exact: true }).fill("admin123");
  await page.getByRole("button", { name: "LOGIN", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Quotation dashboard" }),
  ).toBeVisible();
  const cards = [
    ["Total quotations", "/quotations"],
    ["Draft quotations", "/quotations?status=draft"],
    ["Generated quotations", "/quotations?status=generated"],
    ["Total quotation value", "/quotations"],
    ["Customers", "/customers"],
    ["Master List items", "/master-list"],
    ["Unresolved price conflicts", "/price-conflicts?status=unresolved"],
  ];
  for (const [label, url] of cards) {
    await page.goto("/");
    await page.locator("a.stat-link").filter({ hasText: label }).click();
    await expect(page).toHaveURL("http://127.0.0.1:3101" + url);
    if (url.includes("status=draft") || url.includes("status=generated")) {
      const status = url.split("status=")[1];
      await expect(page.getByLabel("Quotation status")).toHaveValue(status);
      await expect(
        page.locator("tbody tr .badge").filter({ hasNotText: status }),
      ).toHaveCount(0);
    }
  }
  await page.goto("/");
  await page.screenshot({
    path: "test-results/v2-dashboard.png",
    fullPage: true,
  });
});

test("Saved multi-page PDF supports navigation without regeneration", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByLabel("Username", { exact: true }).fill("sales");
  await page.getByLabel("Password", { exact: true }).fill("sales123");
  await page.getByRole("button", { name: "LOGIN", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Quotation dashboard" }),
  ).toBeVisible();
  const areas = await (await page.request.get("/api/areas")).json();
  const area = areas.find((a: { name: string }) => a.name === "Kitchen");
  const products = await (
    await page.request.get(
      `/api/master-list?area_id=${area.id}&item=Base%20Unit&limit=500`,
    )
  ).json();
  const product = products.items.find(
    (p: { specification: string }) =>
      p.specification === "BWP Ply + HDHMR + Laminate",
  );
  const items = Array.from({ length: 24 }, (_, i) => ({
    key: `page-qa-${i}`,
    product_id: product.id,
    item_label: product.item,
    description: product.specification,
    measurement_mode: "area",
    width: "5.5",
    length: "4",
    quantity: "1",
  }));
  const saved = await page.request.post("/api/quotations", {
    headers: { "X-Casa-Request": "1" },
    data: {
      customer_name: "Entered multi-page QA customer",
      address: "Entered QA address",
      project_reference: "MULTI-PAGE-QA",
      quote_date: "2026-10-03",
      sections: [{ name: "Kitchen", area_id: area.id, items }],
    },
  });
  expect(saved.status()).toBe(201);
  const q = await saved.json();
  const downloads: string[] = [];
  page.on("download", (d) => downloads.push(d.suggestedFilename()));
  await page.goto(`/quotations/${q.id}`);
  await page
    .getByRole("button", { name: "Generate quotation", exact: true })
    .click();
  await expect(page).toHaveURL(/\/preview\?revision=/);
  await expect(page.locator(".pdf-canvas-frame")).toHaveAttribute(
    "aria-busy",
    "false",
  );
  expect(downloads).toHaveLength(0);
  const versions = await (
    await page.request.get(`/api/quotations/${q.id}/versions`)
  ).json();
  const version = versions[0];
  let generatedAgain = 0;
  page.on("request", (r) => {
    if (r.method() === "POST" && r.url().endsWith("/generate"))
      generatedAgain++;
  });
  await page.goto(`/quotations/${q.id}/preview?revision=${version.revision}`);
  await expect(page.locator(".pdf-canvas-frame")).toHaveAttribute(
    "aria-busy",
    "false",
  );
  await expect(
    page.getByRole("button", { name: "Next PDF page" }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Next PDF page" }).click();
  await expect(page.locator(".pdf-toolbar")).toContainText("Page 2 /");
  await expect(page.locator(".pdf-canvas-frame")).toHaveAttribute(
    "aria-busy",
    "false",
  );
  await page.screenshot({
    path: "test-results/preview-page-2.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Previous PDF page" }).click();
  await expect(page.locator(".pdf-toolbar")).toContainText("Page 1 /");
  expect(generatedAgain).toBe(0);
});
