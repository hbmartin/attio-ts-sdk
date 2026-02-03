import { defineConfig } from "@hey-api/openapi-ts";

export default defineConfig({
  input: "https://api.attio.com/openapi/api",
  output: "src/generated",
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
      },
    },
    {
      name: "@hey-api/sdk",
      validator: true,
    },
  ],
});
