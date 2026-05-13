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

function withGlobalProperties<T>(
  properties: Record<string, unknown>,
  action: () => Promise<T>,
): Promise<T>;
function withGlobalProperties<T>(
  properties: Record<string, unknown>,
  action: () => T,
): T;
function withGlobalProperties<T>(
  properties: Record<string, unknown>,
  action: () => T | Promise<T>,
): T | Promise<T> {
  const snapshots = snapshotGlobalProperties(properties);
  defineGlobalProperties(properties);

  try {
    const result = action();
    if (result instanceof Promise) {
      return result.finally(() => {
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
