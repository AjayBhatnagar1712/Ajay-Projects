import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
    },
  },
  test: {
    environment: "node",
    fileParallelism: false,
    include: [
      "src/**/*.test.ts",
      "viteAnalyticsPlugin.test.ts",
      "viteAnalyticsBuild.test.ts",
      "marketingAuthFlowShellDesktop.test.ts",
    ],
  },
});
