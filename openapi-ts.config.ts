import { defineConfig } from "@hey-api/openapi-ts";

export default defineConfig({
  input: "https://api.attio.com/openapi/api",
  output: "src/generated",
  plugins: [
    "@hey-api/typescript",
    {
      name: "zod",
    },
    {
      name: "@hey-api/sdk",
      validator: true,
    },
  ],
});
