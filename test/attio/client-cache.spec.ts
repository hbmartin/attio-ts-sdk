import { beforeEach, describe, expect, it } from "vitest";

import { clearClientCache } from "../../src/attio/cache";
import { getAttioClient } from "../../src/attio/client";

const TEST_TOKEN = "attio_test_token_12345";

beforeEach(() => {
  clearClientCache();
});

describe("getAttioClient cache", () => {
  it("bypasses the cache when no cache key is provided", () => {
    const first = getAttioClient({ authToken: TEST_TOKEN });
    const second = getAttioClient({ authToken: TEST_TOKEN });

    expect(first).not.toBe(second);
  });

  it("reuses the cached client when a cache key is provided", () => {
    const config = { authToken: TEST_TOKEN, cache: { key: "shared" } };

    const first = getAttioClient(config);
    const second = getAttioClient(config);

    expect(first).toBe(second);
  });
});
