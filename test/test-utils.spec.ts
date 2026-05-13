import { describe, expect, it } from "vitest";

import { restoreGlobalProperty, withGlobalProperties } from "./test-utils";

class GlobalValueThenable implements PromiseLike<unknown> {
  private readonly key: string;

  constructor(key: string) {
    this.key = key;
  }

  // biome-ignore lint/suspicious/noThenProperty: This intentionally models a non-Promise thenable.
  then<TResult1 = unknown, TResult2 = never>(
    onfulfilled?: ((value: unknown) => PromiseLike<TResult1> | TResult1) | null,
    onrejected?: ((reason: unknown) => PromiseLike<TResult2> | TResult2) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve(Reflect.get(globalThis, this.key)).then(
      onfulfilled,
      onrejected,
    );
  }
}

describe("test utils", () => {
  it("restores global properties after a sync action", () => {
    const key = "__attio_sync_test_global__";
    const originalDescriptor = Object.getOwnPropertyDescriptor(globalThis, key);

    try {
      const result = withGlobalProperties({ [key]: "temporary" }, () =>
        Reflect.get(globalThis, key),
      );

      expect(result).toBe("temporary");
      if (originalDescriptor) {
        expect(Object.getOwnPropertyDescriptor(globalThis, key)).toEqual(
          originalDescriptor,
        );
      } else {
        expect(Reflect.has(globalThis, key)).toBe(false);
      }
    } finally {
      restoreGlobalProperty(key, originalDescriptor);
    }
  });

  it("restores global properties after an async action settles", async () => {
    const key = "__attio_async_test_global__";
    const originalDescriptor = Object.getOwnPropertyDescriptor(globalThis, key);

    try {
      const result = await withGlobalProperties(
        { [key]: "temporary" },
        async () => {
          const beforeAwait = Reflect.get(globalThis, key);
          await Promise.resolve();
          return {
            afterAwait: Reflect.get(globalThis, key),
            beforeAwait,
          };
        },
      );

      expect(result).toEqual({
        afterAwait: "temporary",
        beforeAwait: "temporary",
      });
      if (originalDescriptor) {
        expect(Object.getOwnPropertyDescriptor(globalThis, key)).toEqual(
          originalDescriptor,
        );
      } else {
        expect(Reflect.has(globalThis, key)).toBe(false);
      }
    } finally {
      restoreGlobalProperty(key, originalDescriptor);
    }
  });

  it("restores global properties after a custom thenable settles", async () => {
    const key = "__attio_thenable_test_global__";
    const originalDescriptor = Object.getOwnPropertyDescriptor(globalThis, key);

    try {
      const result = await withGlobalProperties(
        { [key]: "temporary" },
        () => new GlobalValueThenable(key),
      );

      expect(result).toBe("temporary");
      if (originalDescriptor) {
        expect(Object.getOwnPropertyDescriptor(globalThis, key)).toEqual(
          originalDescriptor,
        );
      } else {
        expect(Reflect.has(globalThis, key)).toBe(false);
      }
    } finally {
      restoreGlobalProperty(key, originalDescriptor);
    }
  });

  it("restores global properties when setup fails", () => {
    const key = "__attio_setup_failure_test_global__";
    const originalDescriptor = Object.getOwnPropertyDescriptor(globalThis, key);
    const originalUndefinedDescriptor = Object.getOwnPropertyDescriptor(
      globalThis,
      "undefined",
    );

    try {
      expect(() =>
        withGlobalProperties(
          { [key]: "temporary", undefined: "temporary" },
          () => Reflect.get(globalThis, key),
        ),
      ).toThrow(TypeError);

      if (originalDescriptor) {
        expect(Object.getOwnPropertyDescriptor(globalThis, key)).toEqual(
          originalDescriptor,
        );
      } else {
        expect(Reflect.has(globalThis, key)).toBe(false);
      }
      expect(Object.getOwnPropertyDescriptor(globalThis, "undefined")).toEqual(
        originalUndefinedDescriptor,
      );
    } finally {
      restoreGlobalProperty(key, originalDescriptor);
    }
  });
});
