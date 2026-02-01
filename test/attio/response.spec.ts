import { describe, expect, it } from "vitest";
import { z } from "zod";
import { AttioResponseError } from "../../src/attio/errors";
import {
  assertOk,
  toResult,
  unwrapData,
  unwrapItems,
  unwrapPaginationCursor,
} from "../../src/attio/response";

describe("unwrapData", () => {
  it("returns result as-is when not an object", () => {
    expect(unwrapData(null)).toBe(null);
    expect(unwrapData(undefined)).toBe(undefined);
    expect(unwrapData("string")).toBe("string");
    expect(unwrapData(123)).toBe(123);
  });

  it("unwraps data property when present", () => {
    const inner = { foo: "bar" };
    expect(unwrapData({ data: inner })).toBe(inner);
  });

  it("unwraps nested data properties", () => {
    const inner = { foo: "bar" };
    expect(unwrapData({ data: { data: inner } })).toBe(inner);
  });

  it("returns object as-is when no data property", () => {
    const obj = { foo: "bar" };
    expect(unwrapData(obj)).toBe(obj);
  });

  it("validates with schema when provided", () => {
    const schema = z.object({ id: z.string() });
    const result = unwrapData({ data: { id: "test" } }, { schema });
    expect(result).toEqual({ id: "test" });
  });

  it("throws when schema validation fails", () => {
    const schema = z.object({ id: z.string() });
    expect(() => unwrapData({ data: { id: 123 } }, { schema })).toThrow(
      AttioResponseError,
    );
  });
});

describe("unwrapItems", () => {
  it("returns array directly when data is array", () => {
    const arr = [1, 2, 3];
    expect(unwrapItems({ data: arr })).toBe(arr);
  });

  it("unwraps nested data array", () => {
    const items = [{ id: 1 }, { id: 2 }];
    expect(unwrapItems({ data: { data: items } })).toBe(items);
  });

  it("unwraps deeply nested items array", () => {
    const items = [{ id: 1 }, { id: 2 }];
    expect(unwrapItems({ data: { data: { items } } })).toBe(items);
  });

  it("unwraps nested items array", () => {
    const items = [{ id: 1 }, { id: 2 }];
    expect(unwrapItems({ data: { items } })).toBe(items);
  });

  it("unwraps nested records array", () => {
    const records = [{ id: 1 }, { id: 2 }];
    expect(unwrapItems({ data: { records } })).toBe(records);
  });

  it("returns empty array when no nested array found", () => {
    expect(unwrapItems({ data: { foo: "bar" } })).toEqual([]);
  });

  it("returns empty array when result is not an object", () => {
    expect(unwrapItems(null)).toEqual([]);
    expect(unwrapItems(undefined)).toEqual([]);
    expect(unwrapItems("string")).toEqual([]);
  });

  it("validates items with schema when provided", () => {
    const schema = z.object({ id: z.number() });
    const items = [{ id: 1 }, { id: 2 }];
    const result = unwrapItems({ data: { items } }, { schema });
    expect(result).toEqual([{ id: 1 }, { id: 2 }]);
  });

  it("throws when schema validation fails for items", () => {
    const schema = z.object({ id: z.string() });
    expect(() =>
      unwrapItems({ data: { items: [{ id: 123 }] } }, { schema }),
    ).toThrow(AttioResponseError);
  });
});

describe("unwrapPaginationCursor", () => {
  it("returns null when result is not an object", () => {
    expect(unwrapPaginationCursor(null)).toBe(null);
    expect(unwrapPaginationCursor(undefined)).toBe(null);
    expect(unwrapPaginationCursor("string")).toBe(null);
  });

  it("extracts next_cursor from root pagination", () => {
    const result = { pagination: { next_cursor: "cursor-123" } };
    expect(unwrapPaginationCursor(result)).toBe("cursor-123");
  });

  it("extracts nextCursor from root pagination", () => {
    const result = { pagination: { nextCursor: "cursor-456" } };
    expect(unwrapPaginationCursor(result)).toBe("cursor-456");
  });

  it("extracts cursor from nested data pagination", () => {
    const result = { data: { pagination: { next_cursor: "cursor-789" } } };
    expect(unwrapPaginationCursor(result)).toBe("cursor-789");
  });

  it("returns null when pagination is not an object", () => {
    expect(unwrapPaginationCursor({ pagination: null })).toBe(null);
    expect(unwrapPaginationCursor({ pagination: "invalid" })).toBe(null);
  });

  it("returns null when cursor is not a string", () => {
    expect(unwrapPaginationCursor({ pagination: { next_cursor: 123 } })).toBe(
      null,
    );
    expect(unwrapPaginationCursor({ pagination: { next_cursor: null } })).toBe(
      null,
    );
  });

  it("prioritizes root pagination over nested", () => {
    const result = {
      pagination: { next_cursor: "root-cursor" },
      data: { pagination: { next_cursor: "nested-cursor" } },
    };
    expect(unwrapPaginationCursor(result)).toBe("root-cursor");
  });

  it("returns null when no pagination found", () => {
    expect(unwrapPaginationCursor({ data: { items: [] } })).toBe(null);
  });
});

describe("assertOk", () => {
  it("returns unwrapped data for successful response", () => {
    const result = { data: { data: { id: "rec_123" } } };
    expect(assertOk(result)).toEqual({ id: "rec_123" });
  });

  it("throws normalized errors when response has error", () => {
    const request = new Request("https://example.com/test");
    const response = new Response(JSON.stringify({ message: "fail" }), {
      status: 400,
    });
    const result = { error: { message: "fail" }, request, response };

    expect(() => assertOk(result)).toThrow("fail");
  });

  it("throws when schema validation fails", () => {
    const schema = z.object({ id: z.string() });
    expect(() => assertOk({ data: { id: 123 } }, { schema })).toThrow(
      AttioResponseError,
    );
  });
});

describe("toResult", () => {
  it("returns ok true with value on success", () => {
    const result = toResult({ data: { data: { id: "rec_123" } } });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual({ id: "rec_123" });
    }
  });

  it("returns ok false with error on failure", () => {
    const request = new Request("https://example.com/test");
    const response = new Response(JSON.stringify({ message: "fail" }), {
      status: 400,
    });
    const result = toResult({ error: { message: "fail" }, request, response });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeDefined();
    }
  });

  it("returns ok false when schema validation fails", () => {
    const schema = z.object({ id: z.string() });
    const result = toResult({ data: { id: 123 } }, { schema });

    expect(result.ok).toBe(false);
  });
});
