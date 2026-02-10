import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  executeDataOperation,
  executeItemsOperation,
  executeValidatedDataOperation,
  executeValidatedItemsOperation,
} from "../../src/attio/operations";

describe("operations", () => {
  it("executes and unwraps data operations", async () => {
    const result = await executeDataOperation({
      input: { client: {} },
      request: async () => ({ data: { data: { id: "one" } } }),
      schema: z.object({ id: z.string() }),
    });

    expect(result).toEqual({ id: "one" });
  });

  it("executes and unwraps item operations", async () => {
    const result = await executeItemsOperation({
      input: { client: {} },
      request: async () => ({ data: { data: [{ id: "one" }] } }),
      schema: z.object({ id: z.string() }),
    });

    expect(result).toEqual([{ id: "one" }]);
  });

  it("normalizes and validates data operations", async () => {
    const result = await executeValidatedDataOperation({
      input: { client: {} },
      request: async () => ({ data: { id: "one" } }),
      normalize: (item) => ({ id: item.id, normalized: true }),
      schema: z.object({
        id: z.string(),
        normalized: z.boolean(),
      }),
    });

    expect(result).toEqual({ id: "one", normalized: true });
  });

  it("normalizes and validates item operations", async () => {
    const result = await executeValidatedItemsOperation({
      input: { client: {} },
      request: async () => ({ data: { data: [{ id: "one" }] } }),
      normalize: (items) =>
        items.map((item) => ({
          id: item.id,
          normalized: true,
        })),
      schema: z.object({
        id: z.string(),
        normalized: z.boolean(),
      }),
    });

    expect(result).toEqual([{ id: "one", normalized: true }]);
  });
});
