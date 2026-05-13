interface GlobalPropertySnapshot {
  key: string;
  descriptor: PropertyDescriptor | undefined;
}

const snapshotGlobalProperties = (
  properties: Record<string, unknown>,
): GlobalPropertySnapshot[] =>
  Object.keys(properties).map((key) => ({
    descriptor: Object.getOwnPropertyDescriptor(globalThis, key),
    key,
  }));

const restoreGlobalProperty = (
  key: string,
  descriptor: PropertyDescriptor | undefined,
): void => {
  if (descriptor) {
    Object.defineProperty(globalThis, key, descriptor);
    return;
  }

  Reflect.deleteProperty(globalThis, key);
};

const restoreGlobalProperties = (snapshots: GlobalPropertySnapshot[]): void => {
  for (const { key, descriptor } of snapshots) {
    restoreGlobalProperty(key, descriptor);
  }
};

const defineGlobalProperties = (properties: Record<string, unknown>): void => {
  for (const [key, value] of Object.entries(properties)) {
    Object.defineProperty(globalThis, key, {
      configurable: true,
      value,
      writable: true,
    });
  }
};

const hasCallableThen = (value: unknown): boolean => {
  if (value === null) {
    return false;
  }

  const valueType = typeof value;
  if (valueType !== "object" && valueType !== "function") {
    return false;
  }

  return typeof Reflect.get(value, "then") === "function";
};

function withGlobalProperties<T>(
  properties: Record<string, unknown>,
  action: () => PromiseLike<T>,
): Promise<T>;
function withGlobalProperties<T>(
  properties: Record<string, unknown>,
  action: () => T,
): T;
function withGlobalProperties<T>(
  properties: Record<string, unknown>,
  action: () => T | PromiseLike<T>,
): unknown {
  const snapshots = snapshotGlobalProperties(properties);

  try {
    defineGlobalProperties(properties);

    const result = action();
    if (hasCallableThen(result)) {
      return Promise.resolve(result).finally(() => {
        restoreGlobalProperties(snapshots);
      });
    }

    restoreGlobalProperties(snapshots);
    return result;
  } catch (error) {
    restoreGlobalProperties(snapshots);
    throw error;
  }
}

export { restoreGlobalProperty, withGlobalProperties };
