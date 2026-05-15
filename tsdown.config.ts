import { defineConfig } from "tsdown";

export default defineConfig({
  entry: { index: "./src/index.ts" },
  format: ["esm", "cjs"],
  platform: "node",
  dts: true,
  sourcemap: true,
  exports: true,
  publint: true,
  attw: {
    profile: "node16",
    level: "error",
  },
});
