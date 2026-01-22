import { describe, expect, it } from "vitest";

import { runBatch } from "../../src/attio/batch";

describe("runBatch", () => {
  it("returns an empty result array for empty items", async () => {
    const results = await runBatch([], { concurrency: 3, stopOnError: true });
    expect(results).toEqual([]);
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
          throw new Error("boom");
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

    await expect(
      runBatch(items, { concurrency: 2, stopOnError: true }),
    ).rejects.toThrow("boom");

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
          throw new Error("nope");
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
      { status: "rejected", reason: expect.any(Error), label: "second" },
      { status: "fulfilled", value: "c", label: "third" },
    ]);
    expect(results[1].reason).toBeInstanceOf(Error);
    if (results[1].reason instanceof Error) {
      expect(results[1].reason.message).toBe("nope");
    }
  });
});
