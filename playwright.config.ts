import { defineConfig, devices } from "@playwright/test";

const isCI = !!process.env.CI;

// El stack (base, API en 3000, UI en 4200) lo levanta CI o scripts; no hay webServer.
export default defineConfig({
  testDir: "./e2e/tests",
  globalSetup: "./e2e/global-setup.ts",
  retries: 1,
  workers: 4,
  forbidOnly: isCI,
  reporter: [
    ["list"],
    ["html", { open: "never", outputFolder: "playwright-report" }],
    ["./e2e/support/summary-reporter.ts"],
  ],
  use: {
    baseURL: process.env.E2E_UI_URL ?? "http://localhost:4200",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    locale: "es-MX",
    // La API interpreta las fechas en hora de Ciudad de México; sin esto, entre 00:00 y 06:00 UTC
    // el navegador del CI pide "hoy" con la fecha UTC y las órdenes cobradas no aparecen.
    timezoneId: "America/Mexico_City",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
