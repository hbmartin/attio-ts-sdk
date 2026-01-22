export interface TtlCacheEntry<T> {
  value: T;
  expiresAt: number;
}

export interface TtlCacheOptions {
  ttlMs: number;
  maxEntries?: number;
}

export class TtlCache<K, V> {
  private readonly ttlMs: number;
  private readonly maxEntries: number | undefined;
  private readonly store = new Map<K, TtlCacheEntry<V>>();

  constructor(options: TtlCacheOptions) {
    this.ttlMs = options.ttlMs;
    this.maxEntries = options.maxEntries;
  }

  get(key: K): V | undefined {
    const entry = this.store.get(key);
    if (!entry) return;
    if (Date.now() >= entry.expiresAt) {
      this.store.delete(key);
      return;
    }
    return entry.value;
  }

  set(key: K, value: V): void {
    if (this.maxEntries && this.store.size >= this.maxEntries) {
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

export const createTtlCache = <K, V>(options: TtlCacheOptions) =>
  new TtlCache<K, V>(options);

const clientCache = new Map<string, unknown>();

export const getCachedClient = <T>(key: string): T | undefined => {
  return clientCache.get(key) as T | undefined;
};

export const setCachedClient = <T>(key: string, client: T): void => {
  clientCache.set(key, client as unknown);
};

export const clearClientCache = (): void => {
  clientCache.clear();
};

export const hashToken = (value: string): string => {
  let hash = 5381;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 33) ^ value.charCodeAt(i);
  }
  return (hash >>> 0).toString(36);
};
