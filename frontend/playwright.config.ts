import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  workers: 1,
  timeout: 60000,
  use: {
    baseURL: process.env.E2E_BASE_URL || "http://127.0.0.1:3101",
    channel: "msedge",
    headless: true,
    screenshot: "only-on-failure",
  },
  reporter: [["list"], ["html", { open: "never" }]],
});
