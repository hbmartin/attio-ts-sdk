import { describe, expect, it } from "vitest";

import { restoreGlobalProperty, withGlobalProperties } from "./test-utils";

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
});
