import { defineConfig } from "tsdown";

export default defineConfig({
  entry: { index: "./src/index.ts" },
  platform: "node",
  dts: true,
  sourcemap: true,
});
