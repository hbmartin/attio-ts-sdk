import type { CacheAdapter, MetadataCacheScope } from "./cache";

interface CacheAdapterStats {
  entries: number;
  hits: number;
  misses: number;
}

interface MetadataCacheScopeStats extends CacheAdapterStats {
  enabled: boolean;
  initialized: boolean;
  scope: MetadataCacheScope;
}

interface MetadataCacheStats {
  attributes: MetadataCacheScopeStats;
  options: MetadataCacheScopeStats;
  statuses: MetadataCacheScopeStats;
}

interface AttioCacheStats {
  metadata: MetadataCacheStats;
}

const createTrackedCacheAdapter = <K, V>(
  adapter: CacheAdapter<K, V>,
): CacheAdapter<K, V> => {
  const knownKeys = new Set<K>();
  let hits = 0;
  let misses = 0;

  return {
    get: (key) => {
      const value = adapter.get(key);
      if (value === undefined) {
        misses += 1;
        knownKeys.delete(key);
        return;
      }

      hits += 1;
      knownKeys.add(key);
      return value;
    },
    set: (key, value) => {
      adapter.set(key, value);
      knownKeys.add(key);
    },
    delete: (key) => {
      adapter.delete(key);
      knownKeys.delete(key);
    },
    clear: () => {
      adapter.clear();
      knownKeys.clear();
    },
    stats: () => ({
      entries: knownKeys.size,
      hits,
      misses,
    }),
  };
};

const withCacheStats = <K, V>(
  adapter: CacheAdapter<K, V>,
): CacheAdapter<K, V> =>
  adapter.stats ? adapter : createTrackedCacheAdapter(adapter);

const createMetadataScopeStats = (
  scope: MetadataCacheScope,
  enabled: boolean,
  initialized: boolean,
  stats?: CacheAdapterStats,
): MetadataCacheScopeStats => ({
  scope,
  enabled,
  initialized,
  entries: stats?.entries ?? 0,
  hits: stats?.hits ?? 0,
  misses: stats?.misses ?? 0,
});

const createMetadataStats = (
  getStats: (scope: MetadataCacheScope) => MetadataCacheScopeStats,
): MetadataCacheStats => ({
  attributes: getStats("attributes"),
  options: getStats("options"),
  statuses: getStats("statuses"),
});

export type {
  AttioCacheStats,
  CacheAdapterStats,
  MetadataCacheScopeStats,
  MetadataCacheStats,
};
export { createMetadataScopeStats, createMetadataStats, withCacheStats };
