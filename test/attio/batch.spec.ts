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

  it("does not launch new items after stopOnError triggers from finally handler", async () => {
    const startedLabels: string[] = [];

    const items: BatchItem<string>[] = [
      {
        label: "fail-immediately",
        run: async () => {
          startedLabels.push("fail-immediately");
          throw new AttioBatchError("stop");
        },
      },
      {
        label: "slow-item",
        run: async () => {
          startedLabels.push("slow-item");
          await new Promise((resolve) => setTimeout(resolve, 10));
          return "slow";
        },
      },
      {
        label: "never-started-1",
        run: async () => {
          startedLabels.push("never-started-1");
          return "never";
        },
      },
      {
        label: "never-started-2",
        run: async () => {
          startedLabels.push("never-started-2");
          return "never";
        },
      },
    ];

    await runBatch(items, { concurrency: 2, stopOnError: true }).catch(
      () => undefined,
    );

    // Items 3 and 4 should never start because launchNext returns early
    // when isCancelled() is true after the first error
    expect(startedLabels).not.toContain("never-started-1");
    expect(startedLabels).not.toContain("never-started-2");
  });

  it("handles negative concurrency by clamping to 1", async () => {
    const items: BatchItem<string>[] = [
      { label: "a", run: async () => "a" },
      { label: "b", run: async () => "b" },
    ];

    const results = await runBatch(items, { concurrency: -5 });

    expect(results).toHaveLength(2);
    expect(results[0].status).toBe("fulfilled");
    expect(results[1].status).toBe("fulfilled");
  });

  it("passes an AbortSignal to items when stopOnError is true", async () => {
    let receivedSignal: AbortSignal | undefined;

    const items: BatchItem<string>[] = [
      {
        label: "checker",
        run: async (params) => {
          receivedSignal = params?.signal;
          return "ok";
        },
      },
    ];

    await runBatch(items, { stopOnError: true });

    expect(receivedSignal).toBeInstanceOf(AbortSignal);
    expect(receivedSignal?.aborted).toBe(false);
  });

  it("runs all items concurrently when concurrency exceeds item count", async () => {
    let maxConcurrent = 0;
    let currentConcurrent = 0;

    const items: BatchItem<string>[] = Array.from({ length: 3 }, (_, i) => ({
      label: `item-${i}`,
      run: async () => {
        currentConcurrent += 1;
        maxConcurrent = Math.max(maxConcurrent, currentConcurrent);
        await new Promise((resolve) => setTimeout(resolve, 10));
        currentConcurrent -= 1;
        return `result-${i}`;
      },
    }));

    await runBatch(items, { concurrency: 10 });

    expect(maxConcurrent).toBe(3);
  });

  it("preserves result order regardless of completion order", async () => {
    const items: BatchItem<string>[] = [
      {
        label: "slow",
        run: async () => {
          await new Promise((resolve) => setTimeout(resolve, 20));
          return "slow-result";
        },
      },
      {
        label: "fast",
        run: async () => "fast-result",
      },
    ];

    const results = await runBatch(items, { concurrency: 2 });

    expect(results[0]).toEqual({
      status: "fulfilled",
      value: "slow-result",
      label: "slow",
    });
    expect(results[1]).toEqual({
      status: "fulfilled",
      value: "fast-result",
      label: "fast",
    });
  });

  it("rejects with the first error when stopOnError is true", async () => {
    const items: BatchItem<string>[] = [
      {
        label: "first-fail",
        run: async () => {
          throw new Error("first-error");
        },
      },
      {
        label: "second-fail",
        run: async () => {
          await new Promise((resolve) => setTimeout(resolve, 10));
          throw new Error("second-error");
        },
      },
    ];

    await expect(
      runBatch(items, { concurrency: 2, stopOnError: true }),
    ).rejects.toThrow("first-error");
  });

  it("handles a single successful item", async () => {
    const items: BatchItem<number>[] = [{ label: "only", run: async () => 42 }];

    const results = await runBatch(items);

    expect(results).toEqual([
      { status: "fulfilled", value: 42, label: "only" },
    ]);
  });

  it("rejects for a single failing item with stopOnError true", async () => {
    const items: BatchItem<string>[] = [
      {
        label: "boom",
        run: async () => {
          throw new Error("solo-fail");
        },
      },
    ];

    await expect(runBatch(items, { stopOnError: true })).rejects.toThrow(
      "solo-fail",
    );
  });

  it("collects rejected result for a single failing item with stopOnError false", async () => {
    const error = new Error("solo-fail");
    const items: BatchItem<string>[] = [
      {
        label: "boom",
        run: async () => {
          throw error;
        },
      },
    ];

    const results = await runBatch(items, { stopOnError: false });

    expect(results).toEqual([
      { status: "rejected", reason: error, label: "boom" },
    ]);
  });

  it("collects all rejected results when every item fails with stopOnError false", async () => {
    const items: BatchItem<string>[] = [
      {
        label: "a",
        run: async () => {
          throw new Error("fail-a");
        },
      },
      {
        label: "b",
        run: async () => {
          throw new Error("fail-b");
        },
      },
      {
        label: "c",
        run: async () => {
          throw new Error("fail-c");
        },
      },
    ];

    const results = await runBatch(items, { stopOnError: false });

    expect(results).toHaveLength(3);
    for (const result of results) {
      expect(result.status).toBe("rejected");
      expect(result.reason).toBeInstanceOf(Error);
    }
    expect((results[0].reason as Error).message).toBe("fail-a");
    expect((results[1].reason as Error).message).toBe("fail-b");
    expect((results[2].reason as Error).message).toBe("fail-c");
  });

  it("ignores successful completions after stopOnError cancellation", async () => {
    const items: BatchItem<string>[] = [
      {
        label: "fail-first",
        run: async () => {
          throw new Error("trigger-stop");
        },
      },
      {
        label: "succeed-after-cancel",
        run: async () => {
          await new Promise((resolve) => setTimeout(resolve, 10));
          return "should-be-ignored";
        },
      },
    ];

    const error = await runBatch(items, {
      concurrency: 2,
      stopOnError: true,
    }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe("trigger-stop");
  });

  it("handles many concurrent failures with stopOnError", async () => {
    const items: BatchItem<string>[] = Array.from({ length: 10 }, (_, i) => ({
      label: `fail-${i}`,
      run: async () => {
        throw new Error(`error-${i}`);
      },
    }));

    const error = await runBatch(items, {
      concurrency: 10,
      stopOnError: true,
    }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(Error);
  });

  it("processes a large batch correctly", async () => {
    const count = 100;
    const items: BatchItem<number>[] = Array.from(
      { length: count },
      (_, i) => ({
        label: `item-${i}`,
        run: async () => i * 2,
      }),
    );

    const results = await runBatch(items, { concurrency: 8 });

    expect(results).toHaveLength(count);
    for (let i = 0; i < count; i++) {
      expect(results[i]).toEqual({
        status: "fulfilled",
        value: i * 2,
        label: `item-${i}`,
      });
    }
  });

  it("attaches labels to rejected results without stopOnError", async () => {
    const items: BatchItem<string>[] = [
      {
        label: "labeled-failure",
        run: async () => {
          throw new Error("with-label");
        },
      },
      {
        run: async () => {
          throw new Error("without-label");
        },
      },
    ];

    const results = await runBatch(items, { stopOnError: false });

    expect(results[0].label).toBe("labeled-failure");
    expect(results[1].label).toBeUndefined();
    expect(results[0].status).toBe("rejected");
    expect(results[1].status).toBe("rejected");
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
