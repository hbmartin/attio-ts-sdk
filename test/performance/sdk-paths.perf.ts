import { describe, expect, it } from "vitest";
import { TtlCache } from "../../src/attio/cache";
import { paginateOffset } from "../../src/attio/pagination";
import { callWithRetry } from "../../src/attio/retry";

const measureAsync = async (run: () => Promise<void>): Promise<number> => {
  const start = performance.now();
  await run();
  return performance.now() - start;
};

const measureSync = (run: () => void): number => {
  const start = performance.now();
  run();
  return performance.now() - start;
};

describe("sdk performance budgets", () => {
  it("keeps offset pagination collection lightweight", async () => {
    const totalItems = 5000;
    const pageSize = 100;
    const durationMs = await measureAsync(async () => {
      const items = await paginateOffset(
        async (offset, limit) => ({
          items: Array.from(
            { length: Math.max(Math.min(limit, totalItems - offset), 0) },
            (_, index) => offset + index,
          ),
          nextOffset: offset + limit < totalItems ? offset + limit : null,
        }),
        { limit: pageSize, maxItems: totalItems },
      );

      expect(items).toHaveLength(totalItems);
    });

    expect(durationMs).toBeLessThan(500);
  });

  it("keeps successful retry wrapper overhead bounded", async () => {
    const attempts = Array.from({ length: 1000 }, (_, index) => index);
    const durationMs = await measureAsync(async () => {
      for (const attempt of attempts) {
        await callWithRetry(async () => attempt, { maxRetries: 0 });
      }
    });

    expect(durationMs).toBeLessThan(1000);
  });

  it("keeps metadata cache operations bounded", () => {
    const cache = new TtlCache<number, number>({
      maxEntries: 10_000,
      ttlMs: 60_000,
    });
    const entries = Array.from({ length: 10_000 }, (_, index) => index);
    const expectedSum = (entries.length * (entries.length - 1)) / 2;
    let observedSum = 0;
    const durationMs = measureSync(() => {
      for (const entry of entries) {
        cache.set(entry, entry);
      }
      for (const entry of entries) {
        observedSum += cache.get(entry) ?? 0;
      }
    });

    expect(observedSum).toBe(expectedSum);
    expect(cache.stats()).toEqual({
      entries: entries.length,
      hits: entries.length,
      misses: 0,
    });
    expect(durationMs).toBeLessThan(250);
  });
});
