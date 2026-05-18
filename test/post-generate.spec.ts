import { describe, expect, it } from "vitest";
import {
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
