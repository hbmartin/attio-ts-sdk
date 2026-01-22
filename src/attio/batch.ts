interface BatchItemRunParams {
  signal?: AbortSignal;
}

interface BatchItem<T> {
  run: (params?: BatchItemRunParams) => Promise<T>;
  label?: string;
}

interface BatchResult<T> {
  status: "fulfilled" | "rejected";
  value?: T;
  reason?: unknown;
  label?: string;
}

interface BatchOptions {
  concurrency?: number;
  stopOnError?: boolean;
}

interface BatchState<T> {
  results: BatchResult<T>[];
  index: number;
  active: number;
  stopped: boolean;
}

const handleSuccess = <T>(
  state: BatchState<T>,
  currentIndex: number,
  value: T,
  label?: string,
  isCancelled?: () => boolean,
): void => {
  if (isCancelled?.()) {
    return;
  }
  state.results[currentIndex] = {
    status: "fulfilled",
    value,
    label,
  };
};

const handleError = <T>(
  state: BatchState<T>,
  currentIndex: number,
  reason: unknown,
  label: string | undefined,
  options: BatchOptions,
  abortController: AbortController | undefined,
  isCancelled: () => boolean,
  reject: (reason: unknown) => void,
): void => {
  if (options.stopOnError) {
    if (!state.stopped) {
      state.stopped = true;
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
  state.results[currentIndex] = {
    status: "rejected",
    reason,
    label,
  };
};

interface LaunchNextParams<T> {
  items: BatchItem<T>[];
  state: BatchState<T>;
  concurrency: number;
  abortController: AbortController | undefined;
  options: BatchOptions;
  isCancelled: () => boolean;
  resolve: (value: BatchResult<T>[]) => void;
  reject: (reason: unknown) => void;
  launchNext: () => void;
}

const processNextItem = <T>(params: LaunchNextParams<T>): void => {
  const {
    items,
    state,
    abortController,
    options,
    isCancelled,
    reject,
    launchNext,
  } = params;
  const currentIndex = state.index;
  const item = items[currentIndex];
  state.index += 1;
  state.active += 1;

  item
    .run(abortController ? { signal: abortController.signal } : undefined)
    .then((value) => {
      handleSuccess(state, currentIndex, value, item.label, isCancelled);
    })
    .catch((reason) => {
      handleError(
        state,
        currentIndex,
        reason,
        item.label,
        options,
        abortController,
        isCancelled,
        reject,
      );
    })
    .finally(() => {
      state.active -= 1;
      if (!isCancelled()) {
        launchNext();
      }
    });
};

/**
 * Returns an empty results array when called with no items.
 */
const runBatch = <T>(
  items: BatchItem<T>[],
  options: BatchOptions = {},
): Promise<BatchResult<T>[]> => {
  if (items.length === 0) {
    return Promise.resolve([]);
  }
  const concurrency = Math.max(1, options.concurrency ?? 4);
  const state: BatchState<T> = {
    results: [],
    index: 0,
    active: 0,
    stopped: false,
  };
  const abortController = options.stopOnError
    ? new AbortController()
    : undefined;

  const isCancelled = (): boolean =>
    abortController?.signal.aborted ?? state.stopped;

  return new Promise((resolve, reject) => {
    const launchNext = (): void => {
      if (isCancelled()) {
        return;
      }
      if (state.index >= items.length && state.active === 0) {
        resolve(state.results);
        return;
      }

      while (state.active < concurrency && state.index < items.length) {
        processNextItem({
          items,
          state,
          concurrency,
          abortController,
          options,
          isCancelled,
          resolve,
          reject,
          launchNext,
        });
      }
    };

    launchNext();
  });
};

export type { BatchItemRunParams, BatchItem, BatchResult, BatchOptions };
export { runBatch };
