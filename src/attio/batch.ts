export interface BatchItem<T> {
  run: () => Promise<T>;
  label?: string;
}

export interface BatchResult<T> {
  status: 'fulfilled' | 'rejected';
  value?: T;
  reason?: unknown;
  label?: string;
}

export interface BatchOptions {
  concurrency?: number;
  stopOnError?: boolean;
}

export const runBatch = async <T>(
  items: BatchItem<T>[],
  options: BatchOptions = {},
): Promise<BatchResult<T>[]> => {
  const concurrency = Math.max(1, options.concurrency ?? 4);
  const results: BatchResult<T>[] = [];
  let index = 0;
  let active = 0;
  let stopped = false;

  return new Promise((resolve, reject) => {
    const launchNext = () => {
      if (stopped) {
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
          .run()
          .then((value) => {
            results[currentIndex] = {
              status: 'fulfilled',
              value,
              label: item.label,
            };
          })
          .catch((reason) => {
            results[currentIndex] = {
              status: 'rejected',
              reason,
              label: item.label,
            };
            if (options.stopOnError) {
              stopped = true;
              reject(reason);
              return;
            }
          })
          .finally(() => {
            active -= 1;
            launchNext();
          });
      }
    };

    launchNext();
  });
};
