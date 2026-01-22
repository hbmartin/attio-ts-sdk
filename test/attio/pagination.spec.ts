import { describe, expect, it, vi } from "vitest";

import { paginate, toPageResult } from "../../src/attio/pagination";

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
});
