import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import {
  type CacheAdapterParams,
  clearClientCache,
  clearMetadataCacheRegistry,
  createAttioCacheManager,
  createTtlCache,
  createTtlCacheAdapter,
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

  it("returns anonymous hash for undefined token", () => {
    const hash = hashToken(undefined);
    expect(hash).toBe("anon_");
  });
});

describe("createTtlCacheAdapter", () => {
  it("wraps a TtlCache with the CacheAdapter interface", () => {
    const adapter = createTtlCacheAdapter({
      scope: "attributes",
      ttlMs: 5000,
      maxEntries: 10,
    });

    adapter.set("key1", [{ id: 1 }]);
    expect(adapter.get("key1")).toEqual([{ id: 1 }]);

    adapter.delete("key1");
    expect(adapter.get("key1")).toBeUndefined();

    adapter.set("key2", [{ id: 2 }]);
    adapter.clear();
    expect(adapter.get("key2")).toBeUndefined();
  });
});

describe("getCachedClient edge cases", () => {
  afterEach(() => {
    clearClientCache();
  });

  it("returns undefined when validator throws", () => {
    const throwingSchema = z.string().transform(() => {
      throw new Error("parse explosion");
    });

    setCachedClient("key-throws", "valid-string");

    expect(getCachedClient("key-throws", throwingSchema)).toBeUndefined();
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

  it("disabled metadata manager clear is callable", () => {
    const manager = createAttioCacheManager("disabled-clear", {
      enabled: false,
    });
    expect(() => manager.metadata.clear()).not.toThrow();
    expect(() => manager.clear()).not.toThrow();
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

  it("reuses the same manager from registry for identical config", () => {
    const first = createAttioCacheManager("registry-reuse", {
      metadata: { ttlMs: 30_000 },
    });
    const second = createAttioCacheManager("registry-reuse", {
      metadata: { ttlMs: 30_000 },
    });

    const firstCache = first.metadata.get("attributes");
    firstCache?.set("shared-key", [{ shared: true }]);

    const secondCache = second.metadata.get("attributes");
    expect(secondCache?.get("shared-key")).toEqual([{ shared: true }]);
  });

  it("creates separate managers for different config fingerprints", () => {
    const first = createAttioCacheManager("fingerprint-test", {
      metadata: { ttlMs: 10_000 },
    });
    const second = createAttioCacheManager("fingerprint-test", {
      metadata: { ttlMs: 60_000 },
    });

    const firstCache = first.metadata.get("attributes");
    firstCache?.set("key", [{ a: 1 }]);

    const secondCache = second.metadata.get("attributes");
    expect(secondCache?.get("key")).toBeUndefined();
  });

  it("bypasses registry when custom adapter is provided", () => {
    const createCalls: CacheAdapterParams[] = [];
    const customAdapter = {
      create: (params: CacheAdapterParams) => {
        createCalls.push(params);
        return createTtlCacheAdapter(params);
      },
    };

    const first = createAttioCacheManager("custom-adapter-test", {
      metadata: { adapter: customAdapter },
    });
    const second = createAttioCacheManager("custom-adapter-test", {
      metadata: { adapter: customAdapter },
    });

    first.metadata.get("attributes");
    second.metadata.get("attributes");

    // Each manager creates its own adapter since custom adapters bypass registry
    expect(createCalls).toHaveLength(2);
  });

  it("resolves maxEntries as a number for all scopes", () => {
    const manager = createAttioCacheManager("numeric-max", {
      metadata: { maxEntries: 42 },
    });

    const attrCache = manager.metadata.get("attributes");
    const optCache = manager.metadata.get("options");
    const statusCache = manager.metadata.get("statuses");

    expect(attrCache).toBeDefined();
    expect(optCache).toBeDefined();
    expect(statusCache).toBeDefined();
  });

  it("returns same cache adapter on repeated scope access", () => {
    const manager = createAttioCacheManager("scope-reuse");
    const first = manager.metadata.get("attributes");
    const second = manager.metadata.get("attributes");

    expect(first).toBe(second);
  });

  it("uses default maxEntries when metadata maxEntries is an empty object", () => {
    const manager = createAttioCacheManager("empty-max-obj", {
      metadata: { maxEntries: {} },
    });
    const cache = manager.metadata.get("attributes");
    expect(cache).toBeDefined();
  });

  it("creates manager with default config when no cache config is provided", () => {
    const manager = createAttioCacheManager("no-config-key");
    const cache = manager.metadata.get("statuses");
    expect(cache).toBeDefined();

    cache?.set("test-key", [{ value: 1 }]);
    expect(cache?.get("test-key")).toEqual([{ value: 1 }]);
  });

  it("uses default fingerprint when metadata config is undefined", () => {
    // Two calls with undefined metadata config should share a registry entry
    const first = createAttioCacheManager("default-fingerprint");
    const second = createAttioCacheManager("default-fingerprint");

    const firstCache = first.metadata.get("attributes");
    firstCache?.set("shared", [{ data: true }]);

    const secondCache = second.metadata.get("attributes");
    expect(secondCache?.get("shared")).toEqual([{ data: true }]);
  });

  it("clearMetadataCacheRegistry clears all registered managers", () => {
    const manager = createAttioCacheManager("registry-clear-test");
    const cache = manager.metadata.get("attributes");
    cache?.set("key", [{ data: 1 }]);

    clearMetadataCacheRegistry();

    // After clearing the registry, creating a new manager with the same key
    // should not share data with the old one
    const newManager = createAttioCacheManager("registry-clear-test");
    const newCache = newManager.metadata.get("attributes");
    expect(newCache?.get("key")).toBeUndefined();
  });
});
