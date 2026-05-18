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
const currencyConfigFields = ["default_currency_code", "display_type"];
const nullUnionPattern = /(^|\|)\s*null\b/;
const trailingWhitespacePattern = /\s*$/;
const lastMultilineUnionMemberPattern = /\n(\s*)\|[^\n]*$/;

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

const zodEnumFieldPattern = (fieldName) =>
  new RegExp(
    `(${fieldName}:\\s*z\\.enum\\(\\[[\\s\\S]*?\\]\\))(?!\\.(?:nullable|nullish)\\(\\))`,
  );

const typeFieldPattern = (fieldName) =>
  new RegExp(`(${fieldName}:\\s*)([\\s\\S]*?)(\\s*;)`);

const appendNullToType = (type) => {
  if (nullUnionPattern.test(type)) {
    return type;
  }

  const trailingWhitespace = type.match(trailingWhitespacePattern)?.[0] ?? "";
  const baseType = type.slice(0, type.length - trailingWhitespace.length);
  const unionIndent = baseType.match(lastMultilineUnionMemberPattern)?.[1];

  if (unionIndent === undefined) {
    return `${baseType} | null${trailingWhitespace}`;
  }

  return `${baseType}\n${unionIndent}| null${trailingWhitespace}`;
};

export const nullableCurrencyConfigEnums = (content) =>
  replaceInBlock({
    content,
    start: "export const zAttribute = z.object({",
    end: "export const zListView = z.object({",
    replace: (block) =>
      currencyConfigFields.reduce(
        (updatedBlock, fieldName) =>
          updatedBlock.replace(zodEnumFieldPattern(fieldName), "$1.nullable()"),
        block,
      ),
  });

export const nullableCurrencyConfigTypes = (content) =>
  replaceInBlock({
    content,
    start: "export type Attribute = {",
    end: "export type GetV2ByTargetByIdentifierAttributesData = {",
    replace: (block) =>
      currencyConfigFields.reduce(
        (updatedBlock, fieldName) =>
          updatedBlock.replace(
            typeFieldPattern(fieldName),
            (match, prefix, type, terminator) => {
              const nullableType = appendNullToType(type);
              if (nullableType === type) {
                return match;
              }

              return `${prefix}${nullableType}${terminator}`;
            },
          ),
        block,
      ),
  });

export const runPostGenerate = () => {
  const zodPath = resolve(generatedDir, "zod.gen.ts");
  const zodContent = readFileSync(zodPath, "utf8");
  writeFileSync(
    zodPath,
    nullableCurrencyConfigEnums(
      zodContent.replaceAll("z.optional(", "z.nullish("),
    ),
  );

  const typesPath = resolve(generatedDir, "types.gen.ts");
  const typesContent = readFileSync(typesPath, "utf8");
  writeFileSync(typesPath, nullableCurrencyConfigTypes(typesContent));
};

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  runPostGenerate();
}
