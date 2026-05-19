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
const valueResponseSchemaNames = [
  "zPostV2ObjectsByObjectRecordsQueryResponse",
  "zPostV2ObjectsByObjectRecordsResponse",
  "zPutV2ObjectsByObjectRecordsResponse",
  "zGetV2ObjectsByObjectRecordsByRecordIdResponse",
  "zPatchV2ObjectsByObjectRecordsByRecordIdResponse",
  "zPutV2ObjectsByObjectRecordsByRecordIdResponse",
  "zPostV2ListsByListEntriesQueryResponse",
  "zPostV2ListsByListEntriesResponse",
  "zPutV2ListsByListEntriesResponse",
  "zGetV2ListsByListEntriesByEntryIdResponse",
  "zPatchV2ListsByListEntriesByEntryIdResponse",
  "zPutV2ListsByListEntriesByEntryIdResponse",
];
const looseValueFields = ["values", "entry_values"];
const nullUnionPattern = /(^|\|)\s*null\b/;
const trailingWhitespacePattern = /\s*$/;
const lastMultilineUnionMemberPattern = /\n(\s*)\|[^\n]*$/;

const replaceContentSlice = ({ content, startIndex, endIndex, replace }) => {
  const before = content.slice(0, startIndex);
  const block = content.slice(startIndex, endIndex);
  const after = content.slice(endIndex);

  return `${before}${replace(block)}${after}`;
};

const replaceInBlock = ({ content, start, end, replace }) => {
  const startIndex = content.indexOf(start);
  if (startIndex === -1) {
    throw new Error(`Could not find generated block start: ${start}`);
  }

  const endIndex = content.indexOf(end, startIndex);
  if (endIndex === -1) {
    throw new Error(`Could not find generated block end: ${end}`);
  }

  return replaceContentSlice({ content, startIndex, endIndex, replace });
};

const replaceInConstBlock = ({ content, constName, replace }) => {
  const start = `export const ${constName} =`;
  const startIndex = content.indexOf(start);
  if (startIndex === -1) {
    throw new Error(`Could not find generated const: ${constName}`);
  }

  const nextConstIndex = content.indexOf(
    "\nexport const ",
    startIndex + start.length,
  );
  const endIndex = nextConstIndex === -1 ? content.length : nextConstIndex;

  return replaceContentSlice({ content, startIndex, endIndex, replace });
};

const zodEnumFieldPattern = (fieldName) =>
  new RegExp(
    `(${fieldName}:\\s*z\\.enum\\(\\[[\\s\\S]*?\\]\\))(?!\\.(?:nullable|nullish)\\(\\))`,
  );

const typeFieldPattern = (fieldName) =>
  new RegExp(`(${fieldName}:\\s*)([\\s\\S]*?)(\\s*;)`);

const strictValueMapPattern = (fieldName) =>
  new RegExp(
    `^(\\s*)${fieldName}: z\\.record\\(z\\.string\\(\\), z\\.array\\(z\\.union\\(\\[\\n[\\s\\S]*?^\\s*\\]\\)\\)\\)`,
    "gm",
  );

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

const loosenValueMapsInBlock = (block) =>
  looseValueFields.reduce(
    (updatedBlock, fieldName) =>
      updatedBlock.replace(
        strictValueMapPattern(fieldName),
        `$1${fieldName}: z.record(z.string(), z.array(z.unknown()))`,
      ),
    block,
  );

export const loosenValueResponseSchemas = (content) =>
  valueResponseSchemaNames.reduce(
    (updatedContent, constName) =>
      replaceInConstBlock({
        content: updatedContent,
        constName,
        replace: loosenValueMapsInBlock,
      }),
    content,
  );

export const runPostGenerate = () => {
  const zodPath = resolve(generatedDir, "zod.gen.ts");
  const zodContent = readFileSync(zodPath, "utf8");
  writeFileSync(
    zodPath,
    loosenValueResponseSchemas(
      nullableCurrencyConfigEnums(
        zodContent.replaceAll("z.optional(", "z.nullish("),
      ),
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
