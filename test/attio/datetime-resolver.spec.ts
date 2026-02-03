import { describe, expect, it } from "vitest";
import { zInputValue, zOutputValue } from "../../src/generated/zod.gen";

describe("datetime resolver", () => {
  describe("zInputValue timestamp parsing", () => {
    it("accepts nanosecond-precision ISO datetime", () => {
      const result = zInputValue.safeParse({
        value: "2023-01-01T15:00:00.000000000Z",
      });
      expect(result.success).toBe(true);
    });

    it("accepts millisecond-precision ISO datetime", () => {
      const result = zInputValue.safeParse({
        value: "2023-01-01T15:00:00.000Z",
      });
      expect(result.success).toBe(true);
    });

    it("accepts second-precision ISO datetime", () => {
      const result = zInputValue.safeParse({
        value: "2023-01-01T15:00:00Z",
      });
      expect(result.success).toBe(true);
    });

    it("accepts datetime with timezone offset", () => {
      const result = zInputValue.safeParse({
        value: "2023-01-01T15:00:00.000000000+05:30",
      });
      expect(result.success).toBe(true);
    });
  });

  describe("zOutputValue timestamp parsing", () => {
    it("accepts nanosecond-precision ISO datetime", () => {
      const result = zOutputValue.safeParse({
        attribute_type: "timestamp",
        value: "2023-01-01T15:00:00.000000000Z",
      });
      expect(result.success).toBe(true);
    });

    it("accepts millisecond-precision ISO datetime", () => {
      const result = zOutputValue.safeParse({
        attribute_type: "timestamp",
        value: "2023-01-01T15:00:00.000Z",
      });
      expect(result.success).toBe(true);
    });

    it("rejects plain date string for timestamp attribute", () => {
      const result = zOutputValue.safeParse({
        attribute_type: "timestamp",
        value: "2023-01-01",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("zInputValue interaction datetime parsing", () => {
    it("accepts nanosecond-precision interacted_at", () => {
      const result = zInputValue.safeParse({
        interaction_type: "meeting",
        interacted_at: "2023-06-15T10:30:00.000000000Z",
        owner_actor: {},
      });
      expect(result.success).toBe(true);
    });
  });
});
