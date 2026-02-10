import { describe, expect, it } from "vitest";
import { createBrandedId } from "../../src/attio/ids";

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
});
