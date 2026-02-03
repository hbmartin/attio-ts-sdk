import { describe, expect, it } from "vitest";

import type { BatchItem } from "../../src/attio/batch";
import { runBatch } from "../../src/attio/batch";
import { AttioBatchError } from "../../src/attio/errors";

describe("runBatch", () => {
  it("returns an empty result array for empty items", async () => {
    const results = await runBatch([], { concurrency: 3, stopOnError: true });
    expect(results).toEqual([]);
  });

  it("uses default concurrency of 4 when not specified", async () => {
    const concurrencyLog: number[] = [];
    let currentActive = 0;

    const items: BatchItem<string>[] = Array.from({ length: 8 }, (_, i) => ({
      label: `item-${i}`,
      run: async () => {
        currentActive += 1;
        concurrencyLog.push(currentActive);
        await new Promise((resolve) => setTimeout(resolve, 10));
        currentActive -= 1;
        return `result-${i}`;
      },
    }));

    const results = await runBatch(items);

    expect(results).toHaveLength(8);
    expect(Math.max(...concurrencyLog)).toBeLessThanOrEqual(4);
    for (const result of results) {
      expect(result.status).toBe("fulfilled");
    }
  });

  it("clamps concurrency to at least 1", async () => {
    const items: BatchItem<string>[] = [
      { label: "only", run: async () => "done" },
    ];

    const results = await runBatch(items, { concurrency: 0 });

    expect(results).toEqual([
      { status: "fulfilled", value: "done", label: "only" },
    ]);
  });

  it("runs items sequentially with concurrency 1", async () => {
    const executionOrder: string[] = [];

    const items: BatchItem<string>[] = [
      {
        label: "first",
        run: async () => {
          executionOrder.push("first-start");
          await new Promise((resolve) => setTimeout(resolve, 5));
          executionOrder.push("first-end");
          return "a";
        },
      },
      {
        label: "second",
        run: async () => {
          executionOrder.push("second-start");
          await new Promise((resolve) => setTimeout(resolve, 5));
          executionOrder.push("second-end");
          return "b";
        },
      },
    ];

    await runBatch(items, { concurrency: 1 });

    expect(executionOrder).toEqual([
      "first-start",
      "first-end",
      "second-start",
      "second-end",
    ]);
  });

  it("does not pass signal when stopOnError is false", async () => {
    let receivedSignal: AbortSignal | undefined;

    const items: BatchItem<string>[] = [
      {
        run: async (params) => {
          receivedSignal = params?.signal;
          return "ok";
        },
      },
    ];

    await runBatch(items, { stopOnError: false });

    expect(receivedSignal).toBeUndefined();
  });

  it("handles items without labels", async () => {
    const items: BatchItem<string>[] = [
      { run: async () => "no-label" },
      { run: async () => "also-no-label" },
    ];

    const results = await runBatch(items);

    expect(results).toEqual([
      { status: "fulfilled", value: "no-label", label: undefined },
      { status: "fulfilled", value: "also-no-label", label: undefined },
    ]);
  });

  it("rejects only once when multiple items fail with stopOnError", async () => {
    let rejectCount = 0;
    const originalCatch = Promise.prototype.catch;

    const items: BatchItem<string>[] = [
      {
        label: "fail-1",
        run: async () => {
          throw new AttioBatchError("first");
        },
      },
      {
        label: "fail-2",
        run: async () => {
          throw new AttioBatchError("second");
        },
      },
    ];

    try {
      await runBatch(items, { concurrency: 2, stopOnError: true });
    } catch {
      rejectCount += 1;
    }

    expect(rejectCount).toBe(1);
    Promise.prototype.catch = originalCatch;
  });

  it("aborts in-flight tasks and prevents new launches when stopOnError is true", async () => {
    const startedLabels: string[] = [];
    const startedSignals: AbortSignal[] = [];
    let abortObserved = false;

    const items = [
      {
        label: "fail-fast",
        run: async ({ signal } = {}) => {
          startedLabels.push("fail-fast");
          if (signal) {
            startedSignals.push(signal);
          }
          throw new AttioBatchError("boom");
        },
      },
      {
        label: "wait-for-abort",
        run: ({ signal } = {}) =>
          new Promise<string>((resolve) => {
            startedLabels.push("wait-for-abort");
            if (!signal) {
              resolve("missing-signal");
              return;
            }
            startedSignals.push(signal);
            if (signal.aborted) {
              abortObserved = true;
              resolve("aborted");
              return;
            }
            const onAbort = () => {
              abortObserved = true;
              signal.removeEventListener("abort", onAbort);
              resolve("aborted");
            };
            signal.addEventListener("abort", onAbort);
          }),
      },
      {
        label: "should-not-start",
        run: async ({ signal } = {}) => {
          startedLabels.push("should-not-start");
          if (signal) {
            startedSignals.push(signal);
          }
          return "never";
        },
      },
    ];

    const error = await runBatch(items, {
      concurrency: 2,
      stopOnError: true,
    }).catch((reason) => reason);

    expect(error).toBeInstanceOf(AttioBatchError);
    if (error instanceof AttioBatchError) {
      expect(error.message).toBe("boom");
    }

    expect(startedLabels).toEqual(["fail-fast", "wait-for-abort"]);
    expect(startedSignals).toHaveLength(2);
    expect(startedSignals.every((signal) => signal.aborted)).toBe(true);
    expect(abortObserved).toBe(true);
  });

  it("collects all results when stopOnError is false", async () => {
    const items = [
      {
        label: "first",
        run: async () => "a",
      },
      {
        label: "second",
        run: async () => {
          throw new AttioBatchError("nope");
        },
      },
      {
        label: "third",
        run: async () => "c",
      },
    ];

    const results = await runBatch(items, { concurrency: 2 });

    expect(results).toEqual([
      { status: "fulfilled", value: "a", label: "first" },
      {
        status: "rejected",
        reason: expect.any(AttioBatchError),
        label: "second",
      },
      { status: "fulfilled", value: "c", label: "third" },
    ]);
    expect(results[1].reason).toBeInstanceOf(AttioBatchError);
    if (results[1].reason instanceof AttioBatchError) {
      expect(results[1].reason.message).toBe("nope");
    }
  });
});
