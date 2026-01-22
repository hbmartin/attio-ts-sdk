import { visualizer } from "rollup-plugin-visualizer";
import { defineConfig } from "tsdown";

export default defineConfig({
  entry: { index: "./src/index.ts" },
  format: ["esm", "cjs"],
  platform: "node",
  dts: true,
  sourcemap: true,
  plugins: [
    visualizer({
      filename: "stats.html",
      gzipSize: true,
      brotliSize: true,
    }),
  ],
});
