import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

const resolveAttioClient = vi.fn();

vi.mock("../../src/attio/client", () => ({
  resolveAttioClient,
}));

describe("operations", () => {
  let callAndUnwrapData: typeof import("../../src/attio/operations").callAndUnwrapData;
  let callAndUnwrapItems: typeof import("../../src/attio/operations").callAndUnwrapItems;
  let callAndUnwrapRecord: typeof import("../../src/attio/operations").callAndUnwrapRecord;
  let unwrapAndNormalizeRecords: typeof import("../../src/attio/operations").unwrapAndNormalizeRecords;
  let callAndDelete: typeof import("../../src/attio/operations").callAndDelete;

  beforeAll(async () => {
    ({
      callAndUnwrapData,
      callAndUnwrapItems,
      callAndUnwrapRecord,
      unwrapAndNormalizeRecords,
      callAndDelete,
    } = await import("../../src/attio/operations"));
  });

  beforeEach(() => {
    vi.clearAllMocks();
    resolveAttioClient.mockReturnValue({ id: "mock-client" });
  });

  describe("callAndUnwrapData", () => {
    it("resolves client and unwraps nested data", async () => {
      const apiCall = vi.fn().mockResolvedValue({
        data: { data: { name: "test" } },
      });

      const result = await callAndUnwrapData({ apiKey: "key-1" }, apiCall);

      expect(resolveAttioClient).toHaveBeenCalledWith({ apiKey: "key-1" });
      expect(apiCall).toHaveBeenCalledWith({ id: "mock-client" });
      expect(result).toEqual({ name: "test" });
    });

    it("validates with schema when provided", async () => {
      const schema = z.object({ name: z.string() });
      const apiCall = vi.fn().mockResolvedValue({
        data: { name: "valid" },
      });

      const result = await callAndUnwrapData({}, apiCall, { schema });

      expect(result).toEqual({ name: "valid" });
    });

    it("throws on schema validation failure", async () => {
      const schema = z.object({ name: z.string() });
      const apiCall = vi.fn().mockResolvedValue({
        data: { name: 123 },
      });

      await expect(callAndUnwrapData({}, apiCall, { schema })).rejects.toThrow(
        "schema mismatch",
      );
    });

    it("propagates API call errors", async () => {
      const apiCall = vi.fn().mockRejectedValue(new Error("network failure"));

      await expect(callAndUnwrapData({}, apiCall)).rejects.toThrow(
        "network failure",
      );
    });
  });

  describe("callAndUnwrapItems", () => {
    it("resolves client and unwraps item arrays", async () => {
      const items = [{ id: 1 }, { id: 2 }];
      const apiCall = vi.fn().mockResolvedValue({
        data: { data: items },
      });

      const result = await callAndUnwrapItems({ apiKey: "key-2" }, apiCall);

      expect(resolveAttioClient).toHaveBeenCalledWith({ apiKey: "key-2" });
      expect(apiCall).toHaveBeenCalledWith({ id: "mock-client" });
      expect(result).toEqual(items);
    });

    it("validates items with schema when provided", async () => {
      const schema = z.object({ id: z.number() });
      const apiCall = vi.fn().mockResolvedValue({
        data: { data: [{ id: 1 }, { id: 2 }] },
      });

      const result = await callAndUnwrapItems({}, apiCall, { schema });

      expect(result).toEqual([{ id: 1 }, { id: 2 }]);
    });

    it("returns empty array when no items found", async () => {
      const apiCall = vi.fn().mockResolvedValue({
        data: { data: "not-an-array" },
      });

      const result = await callAndUnwrapItems({}, apiCall);

      expect(result).toEqual([]);
    });

    it("throws on schema validation failure for items", async () => {
      const schema = z.object({ id: z.number() });
      const apiCall = vi.fn().mockResolvedValue({
        data: { data: [{ id: "not-a-number" }] },
      });

      await expect(callAndUnwrapItems({}, apiCall, { schema })).rejects.toThrow(
        "schema mismatch",
      );
    });
  });

  describe("callAndUnwrapRecord", () => {
    it("resolves client, asserts OK, normalizes, and validates", async () => {
      const apiCall = vi.fn().mockResolvedValue({
        data: {
          data: {
            id: { record_id: "rec-1" },
            values: { name: [{ value: "Test" }] },
          },
        },
      });

      const result = await callAndUnwrapRecord({}, apiCall);

      expect(resolveAttioClient).toHaveBeenCalledWith({});
      expect(apiCall).toHaveBeenCalledWith({ id: "mock-client" });
      expect(result).toHaveProperty("id");
      expect(result).toHaveProperty("values");
    });

    it("uses custom itemSchema when provided", async () => {
      const schema = z.object({ custom: z.string() }).passthrough();
      const apiCall = vi.fn().mockResolvedValue({
        data: {
          data: {
            id: { record_id: "rec-1" },
            values: { field: "value" },
            custom: "extra",
          },
        },
      });

      const result = await callAndUnwrapRecord({ itemSchema: schema }, apiCall);

      expect(result).toHaveProperty("custom", "extra");
    });

    it("throws on error responses", async () => {
      const apiCall = vi.fn().mockResolvedValue({
        data: undefined,
        error: { message: "Not found" },
      });

      await expect(callAndUnwrapRecord({}, apiCall)).rejects.toThrow();
    });
  });

  describe("unwrapAndNormalizeRecords", () => {
    it("unwraps items, normalizes records, and validates", () => {
      const schema = z.record(z.string(), z.unknown());
      const input = {
        data: {
          data: [
            {
              id: { record_id: "rec-1" },
              values: { name: [{ value: "A" }] },
            },
            {
              id: { record_id: "rec-2" },
              values: { name: [{ value: "B" }] },
            },
          ],
        },
      };

      const result = unwrapAndNormalizeRecords(input, schema);

      expect(result).toHaveLength(2);
      expect(result[0]).toHaveProperty("id");
      expect(result[1]).toHaveProperty("values");
    });

    it("returns empty array for no items", () => {
      const schema = z.record(z.string(), z.unknown());

      const result = unwrapAndNormalizeRecords(
        { data: { data: "not-array" } },
        schema,
      );

      expect(result).toEqual([]);
    });
  });

  describe("callAndDelete", () => {
    it("resolves client, executes delete, and returns true", async () => {
      const apiCall = vi.fn().mockResolvedValue(undefined);

      const result = await callAndDelete({ apiKey: "key-3" }, apiCall);

      expect(resolveAttioClient).toHaveBeenCalledWith({ apiKey: "key-3" });
      expect(apiCall).toHaveBeenCalledWith({ id: "mock-client" });
      expect(result).toBe(true);
    });

    it("propagates API call errors", async () => {
      const apiCall = vi.fn().mockRejectedValue(new Error("delete failed"));

      await expect(callAndDelete({}, apiCall)).rejects.toThrow("delete failed");
    });
  });
});
