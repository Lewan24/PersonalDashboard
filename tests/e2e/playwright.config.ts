import { defineConfig } from "../../src/personal-hub-web/node_modules/@playwright/test/index";
export default defineConfig({
  testDir: ".",
  testMatch: "*.spec.ts",
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: process.env.HUB_URL ?? "http://127.0.0.1:8080",
    trace: "retain-on-failure",
    launchOptions: {
      ...(process.env.CHROMIUM_PATH
        ? { executablePath: process.env.CHROMIUM_PATH }
        : {}),
    },
  },
  reporter: [
    ["list"],
    ["html", { open: "never", outputFolder: "../../docs/e2e-report" }],
  ],
  outputDir: "../../docs/e2e-results",
});
