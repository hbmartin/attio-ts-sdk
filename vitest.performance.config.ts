import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      enabled: false,
    },
    include: ["test/performance/**/*.perf.ts"],
    testTimeout: 10_000,
  },
});
