import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      enabled: false,
    },
    include: ["test/integration/**/*.integration.spec.ts"],
    testTimeout: 30_000,
  },
});
