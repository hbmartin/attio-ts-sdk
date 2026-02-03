import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

// Attio's API returns null for optional fields, but the generated Zod schemas
// use z.optional() which only accepts undefined. Replace with z.nullish()
// to accept both null and undefined.
const filePath = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../src/generated/zod.gen.ts",
);
const content = readFileSync(filePath, "utf8");
writeFileSync(filePath, content.replaceAll("z.optional(", "z.nullish("));
