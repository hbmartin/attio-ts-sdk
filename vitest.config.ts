import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      provider: "istanbul",
      reporter: ["lcov"],
      include: ["src/attio/**/*.ts"],
      thresholds: {
        branches: 75,
        functions: 95,
        lines: 95,
        statements: 95,
      },
    },
  },
});
