import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { clearClientCache } from "../../src/attio/cache";
import { getAttioClient } from "../../src/attio/client";
import * as configModule from "../../src/attio/config";

const TEST_TOKEN = "attio_test_token_12345";

beforeEach(() => {
  clearClientCache();
});

afterEach(() => {
  vi.restoreAllMocks();
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

  it("validates the auth token once when creating a cached client", () => {
    const validateSpy = vi.spyOn(configModule, "validateAuthToken");
    const config = { authToken: TEST_TOKEN, cache: { key: "shared" } };

    getAttioClient(config);

    expect(validateSpy).toHaveBeenCalledTimes(1);
  });

  it("validates the auth token before returning a cached client", () => {
    const config = { authToken: TEST_TOKEN, cache: { key: "shared" } };

    getAttioClient(config);

    expect(() => getAttioClient({ cache: { key: "shared" } })).toThrow(
      /Missing Attio API key/i,
    );
  });
});
