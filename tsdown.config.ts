import { defineConfig } from "tsdown";

export default defineConfig([
  {
    entry: { index: "./src/index.ts" },
    platform: "node",
    dts: true,
    sourcemap: true,
  },
  {
    entry: { browser: "./src/index.ts" },
    platform: "browser",
    dts: true,
    minify: true,
    sourcemap: true,
  },
]);
