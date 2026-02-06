import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

import {
  createOffsetPageResultSchema,
  createPageResultSchema,
  paginate,
  paginateAsync,
  paginateOffset,
  paginateOffsetAsync,
  parseOffsetPageResult,
  parsePageResult,
  toOffsetPageResult,
  toPageResult,
} from "../../src/attio/pagination";

describe("toPageResult", () => {
  it("converts API response to PageResult format", () => {
    const result = toPageResult({
      data: { items: [{ id: 1 }, { id: 2 }] },
      pagination: { next_cursor: "cursor-123" },
    });

    expect(result.items).toEqual([{ id: 1 }, { id: 2 }]);
    expect(result.nextCursor).toBe("cursor-123");
  });

  it("returns empty items when no array found", () => {
    const result = toPageResult({ data: { foo: "bar" } });

    expect(result.items).toEqual([]);
    expect(result.nextCursor).toBe(null);
  });
});

describe("createPageResultSchema", () => {
  it("creates schema that validates items with provided schema", () => {
    const itemSchema = z.object({ id: z.number() });
    const schema = createPageResultSchema(itemSchema);

    const result = schema.safeParse({
      items: [{ id: 1 }, { id: 2 }],
      nextCursor: "cursor-123",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.items).toEqual([{ id: 1 }, { id: 2 }]);
      expect(result.data.nextCursor).toBe("cursor-123");
    }
  });

  it("rejects items that do not match schema", () => {
    const itemSchema = z.object({ id: z.number() });
    const schema = createPageResultSchema(itemSchema);

    const result = schema.safeParse({
      items: [{ id: "not-a-number" }],
      nextCursor: null,
    });

    expect(result.success).toBe(false);
  });

  it("accepts null and undefined nextCursor", () => {
    const itemSchema = z.object({ id: z.number() });
    const schema = createPageResultSchema(itemSchema);

    const resultNull = schema.safeParse({ items: [], nextCursor: null });
    const resultUndefined = schema.safeParse({ items: [] });

    expect(resultNull.success).toBe(true);
    expect(resultUndefined.success).toBe(true);
  });
});

describe("createOffsetPageResultSchema", () => {
  it("creates schema that validates offset pages", () => {
    const itemSchema = z.object({ id: z.number() });
    const schema = createOffsetPageResultSchema(itemSchema);

    const result = schema.safeParse({
      items: [{ id: 1 }],
      nextOffset: 10,
      total: 50,
    });

    expect(result.success).toBe(true);
  });
});

describe("toOffsetPageResult", () => {
  it("converts API response to OffsetPageResult format", () => {
    const result = toOffsetPageResult({
      data: { items: [{ id: 1 }, { id: 2 }] },
      pagination: { next_offset: 2 },
    });

    expect(result.items).toEqual([{ id: 1 }, { id: 2 }]);
    expect(result.nextOffset).toBe(2);
  });
});

describe("parseOffsetPageResult", () => {
  it("parses valid offset page result", () => {
    const result = parseOffsetPageResult({
      items: [{ id: 1 }, { id: 2 }],
      nextOffset: 3,
    });

    expect(result).toEqual({
      items: [{ id: 1 }, { id: 2 }],
      nextOffset: 3,
    });
  });
});

describe("parsePageResult", () => {
  it("parses valid page result without itemSchema", () => {
    const result = parsePageResult({
      items: [{ id: 1 }, { id: 2 }],
      nextCursor: "cursor-123",
    });

    expect(result).toEqual({
      items: [{ id: 1 }, { id: 2 }],
      nextCursor: "cursor-123",
    });
  });

  it("parses valid page result with itemSchema", () => {
    const itemSchema = z.object({ id: z.number() });
    const result = parsePageResult(
      {
        items: [{ id: 1 }, { id: 2 }],
        nextCursor: "cursor-123",
      },
      itemSchema,
    );

    expect(result).toEqual({
      items: [{ id: 1 }, { id: 2 }],
      nextCursor: "cursor-123",
    });
  });

  it("returns undefined for invalid page structure", () => {
    const result = parsePageResult({ foo: "bar" });

    expect(result).toBeUndefined();
  });

  it("returns undefined when items do not match schema", () => {
    const itemSchema = z.object({ id: z.number() });
    const result = parsePageResult(
      {
        items: [{ id: "not-a-number" }],
        nextCursor: null,
      },
      itemSchema,
    );

    expect(result).toBeUndefined();
  });

  it("returns undefined for non-object input", () => {
    expect(parsePageResult(null)).toBeUndefined();
    expect(parsePageResult(undefined)).toBeUndefined();
    expect(parsePageResult("string")).toBeUndefined();
    expect(parsePageResult(123)).toBeUndefined();
  });
});

describe("paginate", () => {
  it("fetches all pages when no limits set", async () => {
    const fetchPage = vi
      .fn()
      .mockResolvedValueOnce({
        items: [{ id: 1 }],
        nextCursor: "cursor-1",
      })
      .mockResolvedValueOnce({
        items: [{ id: 2 }],
        nextCursor: "cursor-2",
      })
      .mockResolvedValueOnce({
        items: [{ id: 3 }],
        nextCursor: null,
      });

    const items = await paginate(fetchPage);

    expect(items).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }]);
    expect(fetchPage).toHaveBeenCalledTimes(3);
    expect(fetchPage).toHaveBeenNthCalledWith(1, null);
    expect(fetchPage).toHaveBeenNthCalledWith(2, "cursor-1");
    expect(fetchPage).toHaveBeenNthCalledWith(3, "cursor-2");
  });

  it("respects maxPages option", async () => {
    const fetchPage = vi
      .fn()
      .mockResolvedValueOnce({
        items: [{ id: 1 }],
        nextCursor: "cursor-1",
      })
      .mockResolvedValueOnce({
        items: [{ id: 2 }],
        nextCursor: "cursor-2",
      });

    const items = await paginate(fetchPage, { maxPages: 2 });

    expect(items).toEqual([{ id: 1 }, { id: 2 }]);
    expect(fetchPage).toHaveBeenCalledTimes(2);
  });

  it("respects maxItems option", async () => {
    const fetchPage = vi
      .fn()
      .mockResolvedValueOnce({
        items: [{ id: 1 }, { id: 2 }, { id: 3 }],
        nextCursor: "cursor-1",
      })
      .mockResolvedValueOnce({
        items: [{ id: 4 }, { id: 5 }],
        nextCursor: null,
      });

    const items = await paginate(fetchPage, { maxItems: 4 });

    expect(items).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }]);
  });

  it("starts from provided cursor", async () => {
    const fetchPage = vi.fn().mockResolvedValueOnce({
      items: [{ id: 5 }],
      nextCursor: null,
    });

    await paginate(fetchPage, { cursor: "start-cursor" });

    expect(fetchPage).toHaveBeenCalledWith("start-cursor");
  });

  it("handles raw API responses by converting them via toPageResult", async () => {
    const fetchPage = vi
      .fn()
      .mockResolvedValueOnce({
        data: { items: [{ id: 1 }] },
        pagination: { next_cursor: "cursor-1" },
      })
      .mockResolvedValueOnce({
        data: { items: [{ id: 2 }] },
        pagination: { next_cursor: null },
      });

    const items = await paginate(fetchPage);

    expect(items).toEqual([{ id: 1 }, { id: 2 }]);
  });

  it("stops when nextCursor is undefined", async () => {
    const fetchPage = vi.fn().mockResolvedValueOnce({
      items: [{ id: 1 }],
      nextCursor: undefined,
    });

    const items = await paginate(fetchPage);

    expect(items).toEqual([{ id: 1 }]);
    expect(fetchPage).toHaveBeenCalledTimes(1);
  });

  it("stops fetching when maxItems reached even with more pages available", async () => {
    const fetchPage = vi.fn().mockResolvedValueOnce({
      items: [{ id: 1 }, { id: 2 }, { id: 3 }],
      nextCursor: "cursor-1",
    });

    const items = await paginate(fetchPage, { maxItems: 2 });

    expect(items).toEqual([{ id: 1 }, { id: 2 }]);
    expect(fetchPage).toHaveBeenCalledTimes(1);
  });

  it("validates items with itemSchema when provided", async () => {
    const itemSchema = z.object({ id: z.number() });
    const fetchPage = vi
      .fn()
      .mockResolvedValueOnce({
        items: [{ id: 1 }],
        nextCursor: "cursor-1",
      })
      .mockResolvedValueOnce({
        items: [{ id: 2 }],
        nextCursor: null,
      });

    const items = await paginate(fetchPage, { itemSchema });

    expect(items).toEqual([{ id: 1 }, { id: 2 }]);
    expect(fetchPage).toHaveBeenCalledTimes(2);
  });

  it("falls back to toPageResult when itemSchema validation fails", async () => {
    const itemSchema = z.object({ id: z.number(), required: z.string() });
    const fetchPage = vi.fn().mockResolvedValueOnce({
      data: { items: [{ id: 1 }] },
      pagination: { next_cursor: null },
    });

    const items = await paginate(fetchPage, { itemSchema });

    expect(items).toEqual([{ id: 1 }]);
  });
});

describe("paginateOffset", () => {
  it("fetches pages until no next offset", async () => {
    const fetchPage = vi
      .fn()
      .mockResolvedValueOnce({
        items: [{ id: 1 }, { id: 2 }],
        nextOffset: 2,
      })
      .mockResolvedValueOnce({
        items: [{ id: 3 }],
        nextOffset: null,
      });

    const items = await paginateOffset(fetchPage, { limit: 2 });

    expect(items).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }]);
    expect(fetchPage).toHaveBeenCalledTimes(2);
    expect(fetchPage).toHaveBeenNthCalledWith(1, 0, 2);
    expect(fetchPage).toHaveBeenNthCalledWith(2, 2, 2);
  });

  it("stops when maxItems reached", async () => {
    const fetchPage = vi.fn().mockResolvedValue({
      items: [{ id: 1 }, { id: 2 }],
    });

    const items = await paginateOffset(fetchPage, { maxItems: 1, limit: 2 });

    expect(items).toEqual([{ id: 1 }]);
  });

  it("respects maxPages option", async () => {
    const fetchPage = vi
      .fn()
      .mockResolvedValueOnce({
        items: [{ id: 1 }, { id: 2 }],
        nextOffset: 2,
      })
      .mockResolvedValueOnce({
        items: [{ id: 3 }, { id: 4 }],
        nextOffset: 4,
      })
      .mockResolvedValueOnce({
        items: [{ id: 5 }],
        nextOffset: null,
      });

    const items = await paginateOffset(fetchPage, { maxPages: 2, limit: 2 });

    expect(fetchPage).toHaveBeenCalledTimes(2);
    expect(items).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }]);
  });

  it("starts from non-zero offset", async () => {
    const fetchPage = vi.fn().mockResolvedValueOnce({
      items: [{ id: 3 }, { id: 4 }],
      nextOffset: null,
    });

    const items = await paginateOffset(fetchPage, { offset: 10, limit: 2 });

    expect(fetchPage).toHaveBeenCalledWith(10, 2);
    expect(items).toEqual([{ id: 3 }, { id: 4 }]);
  });

  it("uses pageSize fallback when limit is not provided", async () => {
    const fetchPage = vi.fn().mockResolvedValueOnce({
      items: [{ id: 1 }],
      nextOffset: null,
    });

    await paginateOffset(fetchPage, { pageSize: 25 });

    expect(fetchPage).toHaveBeenCalledWith(0, 25);
  });

  it("uses default page size when neither limit nor pageSize provided", async () => {
    const fetchPage = vi.fn().mockResolvedValueOnce({
      items: [{ id: 1 }],
      nextOffset: null,
    });

    await paginateOffset(fetchPage);

    expect(fetchPage).toHaveBeenCalledWith(0, 50);
  });

  it("terminates when page items length is less than limit", async () => {
    const fetchPage = vi
      .fn()
      .mockResolvedValueOnce({
        items: [{ id: 1 }, { id: 2 }],
      })
      .mockResolvedValueOnce({
        items: [{ id: 3 }],
      });

    const items = await paginateOffset(fetchPage, { limit: 2 });

    expect(fetchPage).toHaveBeenCalledTimes(2);
    expect(items).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }]);
  });

  it("terminates when nextOffset is non-advancing", async () => {
    const fetchPage = vi
      .fn()
      .mockResolvedValueOnce({
        items: [{ id: 1 }, { id: 2 }],
        nextOffset: 2,
      })
      .mockResolvedValueOnce({
        items: [{ id: 3 }, { id: 4 }],
        nextOffset: 2,
      });

    const items = await paginateOffset(fetchPage, { limit: 2 });

    expect(fetchPage).toHaveBeenCalledTimes(2);
    expect(items).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }]);
  });
});

describe("paginateAsync", () => {
  it("yields items one at a time from multiple pages", async () => {
    const fetchPage = vi
      .fn()
      .mockResolvedValueOnce({
        items: [{ id: 1 }, { id: 2 }],
        nextCursor: "cursor-1",
      })
      .mockResolvedValueOnce({
        items: [{ id: 3 }],
        nextCursor: null,
      });

    const items: { id: number }[] = [];
    for await (const item of paginateAsync<{ id: number }>(fetchPage)) {
      items.push(item);
    }

    expect(items).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }]);
    expect(fetchPage).toHaveBeenCalledTimes(2);
  });

  it("stops early when consumer breaks", async () => {
    const fetchPage = vi
      .fn()
      .mockResolvedValueOnce({
        items: [{ id: 1 }, { id: 2 }, { id: 3 }],
        nextCursor: "cursor-1",
      })
      .mockResolvedValueOnce({
        items: [{ id: 4 }],
        nextCursor: null,
      });

    const items: { id: number }[] = [];
    for await (const item of paginateAsync<{ id: number }>(fetchPage)) {
      items.push(item);
      if (items.length === 2) {
        break;
      }
    }

    expect(items).toEqual([{ id: 1 }, { id: 2 }]);
    expect(fetchPage).toHaveBeenCalledTimes(1);
  });

  it("respects maxItems option", async () => {
    const fetchPage = vi
      .fn()
      .mockResolvedValueOnce({
        items: [{ id: 1 }, { id: 2 }, { id: 3 }],
        nextCursor: "cursor-1",
      })
      .mockResolvedValueOnce({
        items: [{ id: 4 }],
        nextCursor: null,
      });

    const items: { id: number }[] = [];
    for await (const item of paginateAsync<{ id: number }>(fetchPage, {
      maxItems: 2,
    })) {
      items.push(item);
    }

    expect(items).toEqual([{ id: 1 }, { id: 2 }]);
    expect(fetchPage).toHaveBeenCalledTimes(1);
  });

  it("respects maxPages option", async () => {
    const fetchPage = vi
      .fn()
      .mockResolvedValueOnce({
        items: [{ id: 1 }],
        nextCursor: "cursor-1",
      })
      .mockResolvedValueOnce({
        items: [{ id: 2 }],
        nextCursor: "cursor-2",
      })
      .mockResolvedValueOnce({
        items: [{ id: 3 }],
        nextCursor: null,
      });

    const items: { id: number }[] = [];
    for await (const item of paginateAsync<{ id: number }>(fetchPage, {
      maxPages: 2,
    })) {
      items.push(item);
    }

    expect(items).toEqual([{ id: 1 }, { id: 2 }]);
    expect(fetchPage).toHaveBeenCalledTimes(2);
  });

  it("stops when signal is aborted", async () => {
    const controller = new AbortController();
    const fetchPage = vi
      .fn()
      .mockResolvedValueOnce({
        items: [{ id: 1 }, { id: 2 }],
        nextCursor: "cursor-1",
      })
      .mockResolvedValueOnce({
        items: [{ id: 3 }],
        nextCursor: null,
      });

    const items: { id: number }[] = [];
    for await (const item of paginateAsync<{ id: number }>(fetchPage, {
      signal: controller.signal,
    })) {
      items.push(item);
      if (items.length === 2) {
        controller.abort();
      }
    }

    expect(items).toEqual([{ id: 1 }, { id: 2 }]);
    expect(fetchPage).toHaveBeenCalledTimes(1);
  });

  it("starts from provided cursor", async () => {
    const fetchPage = vi.fn().mockResolvedValueOnce({
      items: [{ id: 5 }],
      nextCursor: null,
    });

    const items: { id: number }[] = [];
    for await (const item of paginateAsync<{ id: number }>(fetchPage, {
      cursor: "start-cursor",
    })) {
      items.push(item);
    }

    expect(fetchPage).toHaveBeenCalledWith("start-cursor");
    expect(items).toEqual([{ id: 5 }]);
  });

  it("handles raw API responses by converting them via toPageResult", async () => {
    const fetchPage = vi
      .fn()
      .mockResolvedValueOnce({
        data: { items: [{ id: 1 }] },
        pagination: { next_cursor: "cursor-1" },
      })
      .mockResolvedValueOnce({
        data: { items: [{ id: 2 }] },
        pagination: { next_cursor: null },
      });

    const items: { id: number }[] = [];
    for await (const item of paginateAsync<{ id: number }>(fetchPage)) {
      items.push(item);
    }

    expect(items).toEqual([{ id: 1 }, { id: 2 }]);
  });

  it("validates items with itemSchema when provided", async () => {
    const itemSchema = z.object({ id: z.number() });
    const fetchPage = vi
      .fn()
      .mockResolvedValueOnce({
        items: [{ id: 1 }],
        nextCursor: "cursor-1",
      })
      .mockResolvedValueOnce({
        items: [{ id: 2 }],
        nextCursor: null,
      });

    const items: { id: number }[] = [];
    for await (const item of paginateAsync<{ id: number }>(fetchPage, {
      itemSchema,
    })) {
      items.push(item);
    }

    expect(items).toEqual([{ id: 1 }, { id: 2 }]);
    expect(fetchPage).toHaveBeenCalledTimes(2);
  });

  it("stops when signal is aborted before any fetch", async () => {
    const controller = new AbortController();
    controller.abort();

    const fetchPage = vi.fn();

    const items: { id: number }[] = [];
    for await (const item of paginateAsync<{ id: number }>(fetchPage, {
      signal: controller.signal,
    })) {
      items.push(item);
    }

    expect(items).toEqual([]);
    expect(fetchPage).not.toHaveBeenCalled();
  });
});

describe("paginateOffsetAsync", () => {
  it("yields items one at a time from multiple pages", async () => {
    const fetchPage = vi
      .fn()
      .mockResolvedValueOnce({
        items: [{ id: 1 }, { id: 2 }],
        nextOffset: 2,
      })
      .mockResolvedValueOnce({
        items: [{ id: 3 }],
        nextOffset: null,
      });

    const items: { id: number }[] = [];
    for await (const item of paginateOffsetAsync<{ id: number }>(fetchPage, {
      limit: 2,
    })) {
      items.push(item);
    }

    expect(items).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }]);
    expect(fetchPage).toHaveBeenCalledTimes(2);
    expect(fetchPage).toHaveBeenNthCalledWith(1, 0, 2);
    expect(fetchPage).toHaveBeenNthCalledWith(2, 2, 2);
  });

  it("stops early when consumer breaks", async () => {
    const fetchPage = vi
      .fn()
      .mockResolvedValueOnce({
        items: [{ id: 1 }, { id: 2 }, { id: 3 }],
        nextOffset: 3,
      })
      .mockResolvedValueOnce({
        items: [{ id: 4 }],
        nextOffset: null,
      });

    const items: { id: number }[] = [];
    for await (const item of paginateOffsetAsync<{ id: number }>(fetchPage, {
      limit: 3,
    })) {
      items.push(item);
      if (items.length === 2) {
        break;
      }
    }

    expect(items).toEqual([{ id: 1 }, { id: 2 }]);
    expect(fetchPage).toHaveBeenCalledTimes(1);
  });

  it("respects maxItems option", async () => {
    const fetchPage = vi.fn().mockResolvedValue({
      items: [{ id: 1 }, { id: 2 }],
      nextOffset: 2,
    });

    const items: { id: number }[] = [];
    for await (const item of paginateOffsetAsync<{ id: number }>(fetchPage, {
      maxItems: 1,
      limit: 2,
    })) {
      items.push(item);
    }

    expect(items).toEqual([{ id: 1 }]);
    expect(fetchPage).toHaveBeenCalledTimes(1);
  });

  it("respects maxPages option", async () => {
    const fetchPage = vi
      .fn()
      .mockResolvedValueOnce({
        items: [{ id: 1 }, { id: 2 }],
        nextOffset: 2,
      })
      .mockResolvedValueOnce({
        items: [{ id: 3 }, { id: 4 }],
        nextOffset: 4,
      })
      .mockResolvedValueOnce({
        items: [{ id: 5 }],
        nextOffset: null,
      });

    const items: { id: number }[] = [];
    for await (const item of paginateOffsetAsync<{ id: number }>(fetchPage, {
      maxPages: 2,
      limit: 2,
    })) {
      items.push(item);
    }

    expect(fetchPage).toHaveBeenCalledTimes(2);
    expect(items).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }]);
  });

  it("stops when signal is aborted", async () => {
    const controller = new AbortController();
    const fetchPage = vi
      .fn()
      .mockResolvedValueOnce({
        items: [{ id: 1 }, { id: 2 }],
        nextOffset: 2,
      })
      .mockResolvedValueOnce({
        items: [{ id: 3 }],
        nextOffset: null,
      });

    const items: { id: number }[] = [];
    for await (const item of paginateOffsetAsync<{ id: number }>(fetchPage, {
      signal: controller.signal,
      limit: 2,
    })) {
      items.push(item);
      if (items.length === 2) {
        controller.abort();
      }
    }

    expect(items).toEqual([{ id: 1 }, { id: 2 }]);
    expect(fetchPage).toHaveBeenCalledTimes(1);
  });

  it("starts from non-zero offset", async () => {
    const fetchPage = vi.fn().mockResolvedValueOnce({
      items: [{ id: 3 }, { id: 4 }],
      nextOffset: null,
    });

    const items: { id: number }[] = [];
    for await (const item of paginateOffsetAsync<{ id: number }>(fetchPage, {
      offset: 10,
      limit: 2,
    })) {
      items.push(item);
    }

    expect(fetchPage).toHaveBeenCalledWith(10, 2);
    expect(items).toEqual([{ id: 3 }, { id: 4 }]);
  });

  it("uses default page size when neither limit nor pageSize provided", async () => {
    const fetchPage = vi.fn().mockResolvedValueOnce({
      items: [{ id: 1 }],
      nextOffset: null,
    });

    const items: { id: number }[] = [];
    for await (const item of paginateOffsetAsync<{ id: number }>(fetchPage)) {
      items.push(item);
    }

    expect(fetchPage).toHaveBeenCalledWith(0, 50);
  });

  it("terminates when page items length is less than limit", async () => {
    const fetchPage = vi
      .fn()
      .mockResolvedValueOnce({
        items: [{ id: 1 }, { id: 2 }],
      })
      .mockResolvedValueOnce({
        items: [{ id: 3 }],
      });

    const items: { id: number }[] = [];
    for await (const item of paginateOffsetAsync<{ id: number }>(fetchPage, {
      limit: 2,
    })) {
      items.push(item);
    }

    expect(fetchPage).toHaveBeenCalledTimes(2);
    expect(items).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }]);
  });

  it("terminates when nextOffset is non-advancing", async () => {
    const fetchPage = vi
      .fn()
      .mockResolvedValueOnce({
        items: [{ id: 1 }, { id: 2 }],
        nextOffset: 2,
      })
      .mockResolvedValueOnce({
        items: [{ id: 3 }, { id: 4 }],
        nextOffset: 2,
      });

    const items: { id: number }[] = [];
    for await (const item of paginateOffsetAsync<{ id: number }>(fetchPage, {
      limit: 2,
    })) {
      items.push(item);
    }

    expect(fetchPage).toHaveBeenCalledTimes(2);
    expect(items).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }]);
  });

  it("handles raw API responses by converting them via toOffsetPageResult", async () => {
    const fetchPage = vi
      .fn()
      .mockResolvedValueOnce({
        data: { items: [{ id: 1 }] },
        pagination: { next_offset: 1 },
      })
      .mockResolvedValueOnce({
        data: { items: [{ id: 2 }] },
        pagination: { next_offset: null },
      });

    const items: { id: number }[] = [];
    for await (const item of paginateOffsetAsync<{ id: number }>(fetchPage, {
      limit: 1,
    })) {
      items.push(item);
    }

    expect(items).toEqual([{ id: 1 }, { id: 2 }]);
  });
});
