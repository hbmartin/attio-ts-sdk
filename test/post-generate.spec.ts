import { describe, expect, it } from "vitest";
import {
  loosenValueResponseSchemas,
  nullableCurrencyConfigEnums,
  nullableCurrencyConfigTypes,
} from "../scripts/post-generate.js";

describe("post-generate currency config nullability", () => {
  it("makes generated enum validators nullable without fixed indentation", () => {
    const content = [
      "export const zAttribute = z.object({",
      "  config: z.object({",
      "    currency: z.object({",
      "      default_currency_code: z.enum([",
      "        'USD'",
      "      ]),",
      "      display_type: z.enum([",
      "        'code',",
      "        'symbol'",
      "      ])",
      "    })",
      "  })",
      "});",
      "export const zListView = z.object({});",
    ].join("\n");

    const result = nullableCurrencyConfigEnums(content);

    expect(result).toContain(
      [
        "default_currency_code: z.enum([",
        "        'USD'",
        "      ]).nullable()",
      ].join("\n"),
    );
    expect(result).toContain(
      [
        "display_type: z.enum([",
        "        'code',",
        "        'symbol'",
        "      ]).nullable()",
      ].join("\n"),
    );
  });

  it("makes wrapped generated type unions nullable", () => {
    const content = [
      "export type Attribute = {",
      "  config: {",
      "    currency: {",
      "      default_currency_code:",
      "        | 'ARS'",
      "        | 'USD';",
      "      display_type:",
      "        | 'code'",
      "        | 'symbol';",
      "    };",
      "  };",
      "};",
      "export type GetV2ByTargetByIdentifierAttributesData = {};",
    ].join("\n");

    const result = nullableCurrencyConfigTypes(content);

    expect(result).toContain(
      [
        "default_currency_code:",
        "        | 'ARS'",
        "        | 'USD'",
        "        | null;",
      ].join("\n"),
    );
    expect(result).toContain(
      [
        "display_type:",
        "        | 'code'",
        "        | 'symbol'",
        "        | null;",
      ].join("\n"),
    );
  });
});

describe("post-generate value response schemas", () => {
  const strictValueMap = (fieldName: string) =>
    [
      `  ${fieldName}: z.record(z.string(), z.array(z.union([`,
      "    z.object({",
      "      active_from: z.iso.datetime(),",
      "      attribute_type: z.enum(['text']),",
      "      value: z.string()",
      "    })",
      "  ])))",
    ].join("\n");

  const responseBlock = (constName: string, fieldName: string) =>
    [
      `export const ${constName} = z.object({`,
      strictValueMap(fieldName),
      "});",
    ].join("\n");

  it("loosens generated record and list value response maps only", () => {
    const content = [
      responseBlock("zPostV2ObjectsByObjectRecordsQueryResponse", "values"),
      responseBlock("zPostV2ObjectsByObjectRecordsResponse", "values"),
      responseBlock("zPutV2ObjectsByObjectRecordsResponse", "values"),
      responseBlock("zGetV2ObjectsByObjectRecordsByRecordIdResponse", "values"),
      responseBlock(
        "zPatchV2ObjectsByObjectRecordsByRecordIdResponse",
        "values",
      ),
      responseBlock("zPutV2ObjectsByObjectRecordsByRecordIdResponse", "values"),
      responseBlock("zPostV2ListsByListEntriesQueryResponse", "entry_values"),
      responseBlock("zPostV2ListsByListEntriesResponse", "entry_values"),
      responseBlock("zPutV2ListsByListEntriesResponse", "entry_values"),
      responseBlock(
        "zGetV2ListsByListEntriesByEntryIdResponse",
        "entry_values",
      ),
      responseBlock(
        "zPatchV2ListsByListEntriesByEntryIdResponse",
        "entry_values",
      ),
      responseBlock(
        "zPutV2ListsByListEntriesByEntryIdResponse",
        "entry_values",
      ),
      "export const zPostV2ObjectsByObjectRecordsBody = z.object({",
      strictValueMap("values"),
      "});",
    ].join("\n");

    const result = loosenValueResponseSchemas(content);

    expect(
      result.match(
        /^ {2}values: z\.record\(z\.string\(\), z\.array\(z\.unknown\(\)\)\)/gm,
      ),
    ).toHaveLength(6);
    expect(
      result.match(
        /^ {2}entry_values: z\.record\(z\.string\(\), z\.array\(z\.unknown\(\)\)\)/gm,
      ),
    ).toHaveLength(6);
    expect(result).toContain(
      [
        "export const zPostV2ObjectsByObjectRecordsBody = z.object({",
        "  values: z.record(z.string(), z.array(z.union([",
      ].join("\n"),
    );
  });
});
