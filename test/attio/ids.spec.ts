import { describe, expect, it } from "vitest";
import { createBrandedId, createBrandedIdSchema } from "../../src/attio/ids";

describe("ids", () => {
  it("creates branded IDs from non-empty values", () => {
    const value = createBrandedId<"CustomId">("id-123", "CustomId");
    expect(value).toBe("id-123");
  });

  it("rejects empty and whitespace-only IDs", () => {
    expect(() => createBrandedId<"CustomId">("", "CustomId")).toThrow(
      "CustomId cannot be empty",
    );
    expect(() => createBrandedId<"CustomId">("   ", "CustomId")).toThrow(
      "CustomId cannot be empty",
    );
  });

  it("creates reusable branded ID schemas", () => {
    const schema = createBrandedIdSchema<"CustomId">("CustomId");

    expect(schema.parse("id-123")).toBe("id-123");
    expect(() => schema.parse("")).toThrow();
    expect(() => schema.parse("   ")).toThrow();
  });
});
