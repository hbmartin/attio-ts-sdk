import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import {
  clearClientCache,
  createTtlCache,
  getCachedClient,
  hashToken,
  setCachedClient,
  TtlCache,
} from "../../src/attio/cache";

describe("TtlCache", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("stores and retrieves values", () => {
    const cache = new TtlCache<string, number>({ ttlMs: 1000 });

    cache.set("key1", 42);
    expect(cache.get("key1")).toBe(42);
  });

  it("returns undefined for missing keys", () => {
    const cache = new TtlCache<string, number>({ ttlMs: 1000 });

    expect(cache.get("nonexistent")).toBeUndefined();
  });

  it("expires entries after TTL", () => {
    const cache = new TtlCache<string, number>({ ttlMs: 1000 });

    cache.set("key1", 42);
    expect(cache.get("key1")).toBe(42);

    vi.advanceTimersByTime(1001);
    expect(cache.get("key1")).toBeUndefined();
  });

  it("updates existing entries", () => {
    const cache = new TtlCache<string, number>({ ttlMs: 1000 });

    cache.set("key1", 42);
    cache.set("key1", 100);
    expect(cache.get("key1")).toBe(100);
  });

  it("deletes entries", () => {
    const cache = new TtlCache<string, number>({ ttlMs: 1000 });

    cache.set("key1", 42);
    cache.delete("key1");
    expect(cache.get("key1")).toBeUndefined();
  });

  it("clears all entries", () => {
    const cache = new TtlCache<string, number>({ ttlMs: 1000 });

    cache.set("key1", 42);
    cache.set("key2", 100);
    cache.clear();
    expect(cache.get("key1")).toBeUndefined();
    expect(cache.get("key2")).toBeUndefined();
  });

  it("respects maxEntries limit", () => {
    const cache = new TtlCache<string, number>({ ttlMs: 1000, maxEntries: 2 });

    cache.set("key1", 1);
    cache.set("key2", 2);
    cache.set("key3", 3);

    expect(cache.get("key1")).toBeUndefined();
    expect(cache.get("key2")).toBe(2);
    expect(cache.get("key3")).toBe(3);
  });

  it("does not evict when updating existing key at max capacity", () => {
    const cache = new TtlCache<string, number>({ ttlMs: 1000, maxEntries: 2 });

    cache.set("key1", 1);
    cache.set("key2", 2);
    cache.set("key1", 100);

    expect(cache.get("key1")).toBe(100);
    expect(cache.get("key2")).toBe(2);
  });
});

describe("createTtlCache", () => {
  it("creates a TtlCache instance", () => {
    const cache = createTtlCache<string, number>({ ttlMs: 1000 });
    expect(cache).toBeInstanceOf(TtlCache);
  });
});

describe("client cache functions", () => {
  afterEach(() => {
    clearClientCache();
  });

  describe("setCachedClient and getCachedClient", () => {
    const ClientSchema = z.object({ id: z.string() });

    it("stores and retrieves clients", () => {
      const client = { id: "test-client" };
      setCachedClient("key1", client);

      expect(getCachedClient("key1", ClientSchema)).toStrictEqual(client);
    });

    it("returns undefined for missing clients", () => {
      expect(getCachedClient("nonexistent", ClientSchema)).toBeUndefined();
    });

    it("returns undefined for invalid cached clients", () => {
      setCachedClient("key1", { id: 123 });

      expect(getCachedClient("key1", ClientSchema)).toBeUndefined();
    });

    it("accepts function validators", () => {
      const parseClient = (value: unknown) => {
        const result = ClientSchema.safeParse(value);
        if (!result.success) {
          throw new Error("Invalid client");
        }
        return result.data;
      };

      const client = { id: "test-client" };
      setCachedClient("key1", client);

      expect(getCachedClient("key1", parseClient)).toStrictEqual(client);
    });

    it("returns undefined when function validators throw", () => {
      const parseClient = (_value: unknown) => {
        throw new Error("Invalid client");
      };

      setCachedClient("key1", { id: "test-client" });

      expect(getCachedClient("key1", parseClient)).toBeUndefined();
    });
  });

  describe("clearClientCache", () => {
    it("removes all cached clients", () => {
      const ClientSchema = z.object({ id: z.number() });

      setCachedClient("key1", { id: 1 });
      setCachedClient("key2", { id: 2 });

      clearClientCache();

      expect(getCachedClient("key1", ClientSchema)).toBeUndefined();
      expect(getCachedClient("key2", ClientSchema)).toBeUndefined();
    });
  });
});

describe("hashToken", () => {
  it("produces consistent hashes", () => {
    const hash1 = hashToken("test-token");
    const hash2 = hashToken("test-token");
    expect(hash1).toBe(hash2);
  });

  it("produces different hashes for different tokens", () => {
    const hash1 = hashToken("token-1");
    const hash2 = hashToken("token-2");
    expect(hash1).not.toBe(hash2);
  });

  it("returns a base36 string", () => {
    const hash = hashToken("test-token");
    expect(hash).toMatch(/^[0-9a-z]+$/);
  });

  it("handles empty string", () => {
    const hash = hashToken("");
    expect(typeof hash).toBe("string");
    expect(hash.length).toBeGreaterThan(0);
  });
});
