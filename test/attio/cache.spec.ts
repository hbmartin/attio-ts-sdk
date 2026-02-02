import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import {
  clearClientCache,
  clearMetadataCacheRegistry,
  createAttioCacheManager,
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

    it("returns transformed data from zod validators", () => {
      const ClientSchemaWithTransform = z
        .object({ id: z.string() })
        .transform((value) => ({
          ...value,
          normalizedId: value.id.toUpperCase(),
        }));

      setCachedClient("key1", { id: "test-client" });

      expect(getCachedClient("key1", ClientSchemaWithTransform)).toStrictEqual({
        id: "test-client",
        normalizedId: "TEST-CLIENT",
      });
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

describe("metadata cache manager", () => {
  afterEach(() => {
    clearMetadataCacheRegistry();
  });

  it("stores and retrieves metadata entries", () => {
    const manager = createAttioCacheManager("meta-key");
    const cache = manager.metadata.get("attributes");

    cache?.set("companies:attrs", [{ api_slug: "name" }]);
    expect(cache?.get("companies:attrs")).toEqual([{ api_slug: "name" }]);
  });

  it("clears metadata entries", () => {
    const manager = createAttioCacheManager("meta-key");
    const cache = manager.metadata.get("options");

    cache?.set("companies:stage", [{ title: "Active" }]);
    manager.clear();

    expect(cache?.get("companies:stage")).toBeUndefined();
  });

  it("disables metadata caching when configured", () => {
    const manager = createAttioCacheManager("meta-key", { enabled: false });
    expect(manager.metadata.get("statuses")).toBeUndefined();
  });

  it("disables metadata caching via nested metadata config", () => {
    const manager = createAttioCacheManager("meta-key-nested", {
      metadata: { enabled: false },
    });
    expect(manager.metadata.get("attributes")).toBeUndefined();
  });

  it("returns fresh manager when metadata is disabled even with same key", () => {
    const enabledManager = createAttioCacheManager("shared-key", {
      enabled: true,
    });
    const enabledCache = enabledManager.metadata.get("attributes");
    expect(enabledCache).toBeDefined();

    const disabledManager = createAttioCacheManager("shared-key", {
      enabled: false,
    });
    expect(disabledManager.metadata.get("attributes")).toBeUndefined();
  });

  it("uses custom maxEntries when provided", () => {
    const manager = createAttioCacheManager("custom-max", {
      metadata: {
        enabled: true,
        maxEntries: { attributes: 5, options: 10, statuses: 15 },
      },
    });
    const cache = manager.metadata.get("attributes");
    expect(cache).toBeDefined();
  });

  it("supports enabled: true configuration explicitly", () => {
    const manager = createAttioCacheManager("explicit-enabled", {
      enabled: true,
      metadata: { enabled: true, ttlMs: 60_000 },
    });
    const cache = manager.metadata.get("options");
    expect(cache).toBeDefined();
  });

  it("clear method clears metadata caches", () => {
    const manager = createAttioCacheManager("clear-test");
    const cache = manager.metadata.get("attributes");
    cache?.set("test-key", [{ id: 1 }]);
    expect(cache?.get("test-key")).toEqual([{ id: 1 }]);

    manager.clear();
    expect(cache?.get("test-key")).toBeUndefined();
  });

  it("clear method works even when no caches exist", () => {
    const manager = createAttioCacheManager("empty-clear-test");
    expect(() => manager.clear()).not.toThrow();
  });

  it("clear function is callable multiple times", () => {
    const manager = createAttioCacheManager("multi-clear-test");
    const cache = manager.metadata.get("options");
    cache?.set("key", [{ value: 1 }]);

    manager.clear();
    manager.clear();
    expect(cache?.get("key")).toBeUndefined();
  });
});
