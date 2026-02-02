import type { ZodType } from "zod";

type MetadataCacheScope = "attributes" | "options" | "statuses";

interface CacheAdapter<K, V> {
  get(key: K): V | undefined;
  set(key: K, value: V): void;
  delete(key: K): void;
  clear(): void;
}

interface CacheAdapterParams {
  scope: MetadataCacheScope;
  ttlMs: number;
  maxEntries?: number;
}

interface CacheAdapterFactory<K, V> {
  create(params: CacheAdapterParams): CacheAdapter<K, V>;
}

interface MetadataCacheMaxEntries {
  attributes?: number;
  options?: number;
  statuses?: number;
}

interface MetadataCacheConfigEnabled {
  enabled?: true;
  ttlMs?: number;
  maxEntries?: number | MetadataCacheMaxEntries;
  adapter?: CacheAdapterFactory<string, unknown[]>;
}

interface MetadataCacheConfigDisabled {
  enabled: false;
}

type MetadataCacheConfig =
  | MetadataCacheConfigEnabled
  | MetadataCacheConfigDisabled;

interface AttioCacheConfigEnabled {
  enabled?: true;
  key?: string;
  metadata?: MetadataCacheConfig;
}

interface AttioCacheConfigDisabled {
  enabled: false;
  key?: string;
}

type AttioCacheConfig = AttioCacheConfigEnabled | AttioCacheConfigDisabled;

interface MetadataCacheManager {
  get(scope: MetadataCacheScope): CacheAdapter<string, unknown[]> | undefined;
  clear(): void;
}

interface AttioCacheManager {
  metadata: MetadataCacheManager;
  clear(): void;
}

const DEFAULT_METADATA_CACHE_TTL_MS = 5 * 60 * 1000;
const DEFAULT_METADATA_CACHE_MAX_ENTRIES: MetadataCacheMaxEntries = {
  attributes: 200,
  options: 500,
  statuses: 500,
};

interface TtlCacheEntry<T> {
  value: T;
  expiresAt: number;
}

interface TtlCacheOptions {
  ttlMs: number;
  maxEntries?: number;
}

class TtlCache<K, V> {
  private readonly ttlMs: number;
  private readonly maxEntries: number | undefined;
  private readonly store = new Map<K, TtlCacheEntry<V>>();

  constructor(options: TtlCacheOptions) {
    this.ttlMs = options.ttlMs;
    this.maxEntries = options.maxEntries;
  }

  get(key: K): V | undefined {
    const entry = this.store.get(key);
    if (!entry) {
      return;
    }
    if (Date.now() >= entry.expiresAt) {
      this.store.delete(key);
      return;
    }
    return entry.value;
  }

  set(key: K, value: V): void {
    if (
      this.maxEntries &&
      this.store.size >= this.maxEntries &&
      !this.store.has(key)
    ) {
      const oldestKey = this.store.keys().next().value as K | undefined;
      if (oldestKey !== undefined) {
        this.store.delete(oldestKey);
      }
    }

    this.store.set(key, {
      value,
      expiresAt: Date.now() + this.ttlMs,
    });
  }

  delete(key: K): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }
}

const createTtlCacheAdapter = (
  params: CacheAdapterParams,
): CacheAdapter<string, unknown[]> => {
  const cache = new TtlCache<string, unknown[]>({
    ttlMs: params.ttlMs,
    maxEntries: params.maxEntries,
  });

  return {
    get: (key) => cache.get(key),
    set: (key, value) => cache.set(key, value),
    delete: (key) => cache.delete(key),
    clear: () => cache.clear(),
  };
};

const clientCache = new Map<string, unknown>();

type ClientCacheValidator<T> = ZodType<T>;

const getCachedClient = <T>(
  key: string,
  validator: ClientCacheValidator<T>,
): T | undefined => {
  const cached = clientCache.get(key);
  if (cached === undefined) {
    return;
  }

  try {
    const result = validator.safeParse(cached);
    if (!result.success) {
      return;
    }
    return result.data;
  } catch {
    return;
  }
};

const setCachedClient = <T>(key: string, client: T): void => {
  clientCache.set(key, client);
};

const clearClientCache = (): void => {
  clientCache.clear();
};

const ANONYMOUS_HASH = "anon";

const hashToken = (value: string | undefined): string => {
  if (value === undefined) {
    return ANONYMOUS_HASH;
  }
  let hash = 5381;
  for (let i = 0; i < value.length; i += 1) {
    // biome-ignore lint/suspicious/noBitwiseOperators: XOR is required for djb2 hash algorithm
    hash = (hash * 33) ^ value.charCodeAt(i);
  }
  // biome-ignore lint/suspicious/noBitwiseOperators: unsigned right shift converts to 32-bit unsigned integer
  return (hash >>> 0).toString(36);
};

const createTtlCache = <K, V>(options: TtlCacheOptions) =>
  new TtlCache<K, V>(options);

const metadataCacheRegistry = new Map<string, MetadataCacheManager>();

const resolveMaxEntries = (
  maxEntries: number | MetadataCacheMaxEntries | undefined,
  scope: MetadataCacheScope,
): number | undefined => {
  if (typeof maxEntries === "number") {
    return maxEntries;
  }
  if (maxEntries && maxEntries[scope] !== undefined) {
    return maxEntries[scope];
  }
  return DEFAULT_METADATA_CACHE_MAX_ENTRIES[scope];
};

const isMetadataCacheDisabled = (
  config: MetadataCacheConfig,
): config is MetadataCacheConfigDisabled => config.enabled === false;

const createMetadataCacheManager = (
  config: MetadataCacheConfig = {},
): MetadataCacheManager => {
  if (isMetadataCacheDisabled(config)) {
    return {
      get: () => undefined,
      clear: () => undefined,
    };
  }

  const ttlMs = config.ttlMs ?? DEFAULT_METADATA_CACHE_TTL_MS;
  const adapterFactory = config.adapter ?? {
    create: (params: CacheAdapterParams) => createTtlCacheAdapter(params),
  };

  const caches = new Map<MetadataCacheScope, CacheAdapter<string, unknown[]>>();

  const get = (scope: MetadataCacheScope) => {
    const existing = caches.get(scope);
    if (existing) {
      return existing;
    }

    const adapter = adapterFactory.create({
      scope,
      ttlMs,
      maxEntries: resolveMaxEntries(config.maxEntries, scope),
    });
    caches.set(scope, adapter);
    return adapter;
  };

  const clear = () => {
    for (const adapter of caches.values()) {
      adapter.clear();
    }
    caches.clear();
  };

  return { get, clear };
};

const buildMetadataCacheFingerprint = (
  config: MetadataCacheConfigEnabled,
): string => {
  const ttl = config.ttlMs ?? "default";
  const max =
    typeof config.maxEntries === "number"
      ? config.maxEntries
      : JSON.stringify(config.maxEntries ?? "default");
  return `ttl:${ttl}|max:${max}`;
};

const getMetadataCacheManager = (
  key: string,
  config?: MetadataCacheConfig,
): MetadataCacheManager => {
  // Disabled configs bypass registry entirely - return fresh disabled manager
  if (config?.enabled === false) {
    return createMetadataCacheManager(config);
  }

  // Custom adapters bypass registry - can't fingerprint functions
  if (config?.adapter) {
    return createMetadataCacheManager(config);
  }

  // Build registry key with config fingerprint for enabled configs
  const fingerprint = config
    ? buildMetadataCacheFingerprint(config)
    : "default";
  const registryKey = `${key}|${fingerprint}`;

  const existing = metadataCacheRegistry.get(registryKey);
  if (existing) {
    return existing;
  }

  const manager = createMetadataCacheManager(config);
  metadataCacheRegistry.set(registryKey, manager);
  return manager;
};

const clearMetadataCacheRegistry = (): void => {
  for (const manager of metadataCacheRegistry.values()) {
    manager.clear();
  }
  metadataCacheRegistry.clear();
};

const isAttioCacheDisabled = (
  config: AttioCacheConfig | undefined,
): config is AttioCacheConfigDisabled => config?.enabled === false;

const resolveMetadataCacheConfig = (
  config?: AttioCacheConfig,
): MetadataCacheConfig => {
  if (isAttioCacheDisabled(config)) {
    return { enabled: false };
  }
  const metadataBase = config?.metadata;
  if (metadataBase?.enabled === false) {
    return { enabled: false };
  }
  return {
    enabled: true,
    ttlMs: metadataBase?.ttlMs,
    maxEntries: metadataBase?.maxEntries,
    adapter: metadataBase?.adapter,
  };
};

const createAttioCacheManager = (
  key: string,
  config?: AttioCacheConfig,
): AttioCacheManager => {
  const metadataConfig = resolveMetadataCacheConfig(config);
  const metadata = getMetadataCacheManager(key, metadataConfig);
  const clear = () => {
    metadata.clear();
  };
  return { metadata, clear };
};

export type {
  AttioCacheConfig,
  AttioCacheConfigDisabled,
  AttioCacheConfigEnabled,
  AttioCacheManager,
  CacheAdapter,
  CacheAdapterFactory,
  CacheAdapterParams,
  MetadataCacheConfig,
  MetadataCacheConfigDisabled,
  MetadataCacheConfigEnabled,
  MetadataCacheManager,
  MetadataCacheMaxEntries,
  MetadataCacheScope,
  TtlCacheEntry,
  TtlCacheOptions,
};
export {
  DEFAULT_METADATA_CACHE_MAX_ENTRIES,
  DEFAULT_METADATA_CACHE_TTL_MS,
  TtlCache,
  createTtlCache,
  createTtlCacheAdapter,
  createAttioCacheManager,
  clearMetadataCacheRegistry,
  getCachedClient,
  setCachedClient,
  clearClientCache,
  hashToken,
};
