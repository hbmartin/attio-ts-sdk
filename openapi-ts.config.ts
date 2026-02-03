import { defineConfig } from "@hey-api/openapi-ts";

export default defineConfig({
  input: "https://api.attio.com/openapi/api",
  output: {
    path: "src/generated",
    // Replace z.optional with z.nullish so optional fields also accept null,
    // matching Attio's API behavior where optional fields may return null.
    postProcess: [
      {
        command: "node",
        args: ["scripts/post-generate.js"],
      },
    ],
  },
  plugins: [
    "@hey-api/typescript",
    {
      name: "zod",
      // Attio's OpenAPI spec declares some timestamp fields with format "date"
      // but the API actually returns full ISO 8601 datetimes (e.g. "2023-01-01T15:00:00.000000000Z"),
      // causing z.iso.date() validation to fail. Override both formats to use z.iso.datetime().
      "~resolvers": {
        string(ctx) {
          const { $, schema, symbols } = ctx;
          const { z } = symbols;
          if (schema.format === "date" || schema.format === "date-time") {
            ctx.nodes.format = () => $(z).attr("iso").attr("datetime").call();
          }
        },
        // Attio's API returns null for some required enum fields (e.g. country_code in locations)
        // but the OpenAPI spec doesn't mark them as nullable. Override the nullable node to
        // always wrap enums in z.nullable() so null values pass validation.
        enum(ctx) {
          ctx.nodes.nullable = (innerCtx) => {
            const { $, symbols } = innerCtx;
            const { z } = symbols;
            return $(z).attr("nullable").call(innerCtx.chain.current);
          };
        },
      },
    },
    {
      name: "@hey-api/sdk",
      validator: true,
    },
  ],
});
