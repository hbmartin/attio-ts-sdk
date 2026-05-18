import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Attio's API returns null for optional fields, but the generated Zod schemas
// use z.optional() which only accepts undefined. Replace with z.nullish()
// to accept both null and undefined.
const generatedDir = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../src/generated",
);

const replaceInBlock = ({ content, start, end, replace }) => {
  const startIndex = content.indexOf(start);
  if (startIndex === -1) {
    throw new Error(`Could not find generated block start: ${start}`);
  }

  const endIndex = content.indexOf(end, startIndex);
  if (endIndex === -1) {
    throw new Error(`Could not find generated block end: ${end}`);
  }

  const before = content.slice(0, startIndex);
  const block = content.slice(startIndex, endIndex);
  const after = content.slice(endIndex);

  return `${before}${replace(block)}${after}`;
};

const nullableCurrencyConfigEnums = (content) =>
  replaceInBlock({
    content,
    start: "export const zAttribute = z.object({",
    end: "export const zListView = z.object({",
    replace: (block) =>
      block
        .replace(
          /(default_currency_code: z\.enum\(\[[\s\S]*?\n {12}\]\))(?!\.(?:nullable|nullish)\(\))/,
          "$1.nullable()",
        )
        .replace(
          /(display_type: z\.enum\(\[[\s\S]*?\n {12}\]\))(?!\.(?:nullable|nullish)\(\))/,
          "$1.nullable()",
        ),
  });

const nullableCurrencyConfigTypes = (content) =>
  replaceInBlock({
    content,
    start: "export type Attribute = {",
    end: "export type GetV2ByTargetByIdentifierAttributesData = {",
    replace: (block) =>
      block
        .replace(
          /(default_currency_code: )([^;\n]+);/,
          (_match, prefix, type) =>
            type.includes("| null")
              ? `${prefix}${type};`
              : `${prefix}${type} | null;`,
        )
        .replace(/(display_type: )([^;\n]+);/, (_match, prefix, type) =>
          type.includes("| null")
            ? `${prefix}${type};`
            : `${prefix}${type} | null;`,
        ),
  });

const zodPath = resolve(generatedDir, "zod.gen.ts");
const zodContent = readFileSync(zodPath, "utf8");
writeFileSync(
  zodPath,
  nullableCurrencyConfigEnums(zodContent.replaceAll("z.optional(", "z.nullish(")),
);

const typesPath = resolve(generatedDir, "types.gen.ts");
const typesContent = readFileSync(typesPath, "utf8");
writeFileSync(typesPath, nullableCurrencyConfigTypes(typesContent));
