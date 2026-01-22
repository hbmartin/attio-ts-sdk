import { describe, expect, it } from "vitest";

import { runBatch } from "../../src/attio/batch";
import { AttioBatchError } from "../../src/attio/errors";

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
