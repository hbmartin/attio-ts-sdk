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
  signal?: AbortSignal;
}

interface BatchState<T> {
  results: BatchResult<T>[];
  index: number;
  active: number;
  stopped: boolean;
}

interface RecordSuccessParams<T> {
  state: BatchState<T>;
  currentIndex: number;
  value: T;
  label?: string;
  isCancelled?: () => boolean;
}

const recordSuccess = <T>(params: RecordSuccessParams<T>): void => {
  const { state, currentIndex, value, label, isCancelled } = params;
  if (isCancelled?.()) {
    return;
  }
  state.results[currentIndex] = {
    status: "fulfilled",
    value,
    label,
  };
};

interface RecordFailureParams<T> {
  state: BatchState<T>;
  currentIndex: number;
  error: unknown;
  label: string | undefined;
  options: BatchOptions;
  abortController: AbortController | undefined;
  isCancelled: () => boolean;
  reject: (err: unknown) => void;
}

const recordFailure = <T>(params: RecordFailureParams<T>): void => {
  const {
    state,
    currentIndex,
    error,
    label,
    options,
    abortController,
    isCancelled,
    reject,
  } = params;
  if (options.stopOnError) {
    if (!state.stopped) {
      state.stopped = true;
      if (abortController && !abortController.signal.aborted) {
        abortController.abort(error);
      }
      reject(error);
    }
    return;
  }
  if (isCancelled()) {
    return;
  }
  state.results[currentIndex] = {
    status: "rejected",
    reason: error,
    label,
  };
};

interface LaunchNextItemParams<T> {
  items: BatchItem<T>[];
  state: BatchState<T>;
  concurrency: number;
  abortController: AbortController | undefined;
  options: BatchOptions;
  isCancelled: () => boolean;
  resolve: (value: BatchResult<T>[]) => void;
  reject: (reason: unknown) => void;
  launchNext: () => void;
  signal?: AbortSignal;
}

const launchNextItem = <T>(params: LaunchNextItemParams<T>): void => {
  const {
    items,
    state,
    abortController,
    options,
    isCancelled,
    reject,
    launchNext,
    signal,
  } = params;
  const currentIndex = state.index;
  const item = items[currentIndex];
  state.index += 1;
  state.active += 1;

  item
    .run(signal ? { signal } : undefined)
    .then((value) => {
      recordSuccess({
        state,
        currentIndex,
        value,
        label: item.label,
        isCancelled,
      });
    })
    .catch((error) => {
      recordFailure({
        state,
        currentIndex,
        error,
        label: item.label,
        options,
        abortController,
        isCancelled,
        reject,
      });
    })
    .finally(() => {
      state.active -= 1;
      if (!isCancelled()) {
        launchNext();
      }
    });
};

const createAbortError = (): Error => {
  const error = new Error("Batch operation was aborted.");
  error.name = "AbortError";
  return error;
};

const readAbortReason = (signal: AbortSignal): unknown =>
  signal.reason ?? createAbortError();

const combineAbortSignals = (
  first: AbortSignal | undefined,
  second: AbortSignal | undefined,
): AbortSignal | undefined => {
  if (!first) {
    return second;
  }
  if (!second) {
    return first;
  }

  const controller = new AbortController();
  const abortFrom = (signal: AbortSignal): void => {
    if (!controller.signal.aborted) {
      controller.abort(readAbortReason(signal));
    }
  };

  if (first.aborted) {
    abortFrom(first);
    return controller.signal;
  }
  if (second.aborted) {
    abortFrom(second);
    return controller.signal;
  }

  first.addEventListener("abort", () => abortFrom(first), { once: true });
  second.addEventListener("abort", () => abortFrom(second), { once: true });
  return controller.signal;
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
    results: new Array(items.length),
    index: 0,
    active: 0,
    stopped: false,
  };
  const abortController = options.stopOnError
    ? new AbortController()
    : undefined;
  const signal = combineAbortSignals(options.signal, abortController?.signal);

  const isCancelled = (): boolean => state.stopped || signal?.aborted === true;

  if (signal?.aborted) {
    return Promise.reject(readAbortReason(signal));
  }

  return new Promise((resolve, reject) => {
    if (signal) {
      const onAbort = (): void => {
        state.stopped = true;
        reject(readAbortReason(signal));
      };
      signal.addEventListener("abort", onAbort, { once: true });
    }

    const launchNext = (): void => {
      if (isCancelled()) {
        return;
      }
      if (state.index >= items.length && state.active === 0) {
        resolve(state.results);
        return;
      }

      while (state.active < concurrency && state.index < items.length) {
        launchNextItem({
          items,
          state,
          concurrency,
          abortController,
          options,
          isCancelled,
          resolve,
          reject,
          launchNext,
          signal,
        });
      }
    };

    launchNext();
  });
};

export type { BatchItem, BatchItemRunParams, BatchOptions, BatchResult };
export { runBatch };
