export namespace BatchItem {
  export interface RunParams {
    signal?: AbortSignal;
  }
}

export interface BatchItem<T> {
  run: (params?: BatchItem.RunParams) => Promise<T>;
  label?: string;
}

export interface BatchResult<T> {
  status: "fulfilled" | "rejected";
  value?: T;
  reason?: unknown;
  label?: string;
}

export interface BatchOptions {
  concurrency?: number;
  stopOnError?: boolean;
}

/**
 * Returns an empty results array when called with no items.
 */
export const runBatch = async <T>(
  items: BatchItem<T>[],
  options: BatchOptions = {},
): Promise<BatchResult<T>[]> => {
  if (items.length === 0) {
    return [];
  }
  const concurrency = Math.max(1, options.concurrency ?? 4);
  const results: BatchResult<T>[] = [];
  let index = 0;
  let active = 0;
  let stopped = false;
  const abortController = options.stopOnError
    ? new AbortController()
    : undefined;

  const isCancelled = (): boolean => abortController?.signal.aborted ?? stopped;

  return new Promise((resolve, reject) => {
    const launchNext = () => {
      if (isCancelled()) {
        return;
      }
      if (index >= items.length && active === 0) {
        resolve(results);
        return;
      }

      while (active < concurrency && index < items.length) {
        const currentIndex = index;
        const item = items[currentIndex];
        index += 1;
        active += 1;

        item
          .run(abortController ? { signal: abortController.signal } : undefined)
          .then((value) => {
            if (isCancelled()) {
              return;
            }
            results[currentIndex] = {
              status: "fulfilled",
              value,
              label: item.label,
            };
          })
          .catch((reason) => {
            if (options.stopOnError) {
              if (!stopped) {
                stopped = true;
                if (abortController && !abortController.signal.aborted) {
                  abortController.abort();
                }
                reject(reason);
              }
              return;
            }
            if (isCancelled()) {
              return;
            }
            results[currentIndex] = {
              status: "rejected",
              reason,
              label: item.label,
            };
          })
          .finally(() => {
            active -= 1;
            if (isCancelled()) {
              return;
            }
            launchNext();
          });
      }
    };

    launchNext();
  });
};
