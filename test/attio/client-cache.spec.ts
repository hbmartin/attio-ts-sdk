import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  clearClientCache,
  hashToken,
  setCachedClient,
} from "../../src/attio/cache";
import {
  createAttioClient,
  getAttioClient,
  resolveAttioClient,
} from "../../src/attio/client";
import * as configModule from "../../src/attio/config";

const TEST_TOKEN = "attio_test_token_12345";

beforeEach(() => {
  clearClientCache();
});

afterEach(() => {
  vi.resetAllMocks();
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

  it("creates a new client when cached entry is invalid", () => {
    const config = { authToken: TEST_TOKEN, cache: { key: "shared" } };
    const cacheKey = `shared:${hashToken(TEST_TOKEN)}`;
    const invalidClient = {
      request: () => Promise.resolve(undefined),
      interceptors: {
        error: { use: "not-a-function" },
        request: { use: () => undefined },
        response: { use: () => undefined },
      },
    };

    setCachedClient(cacheKey, invalidClient);

    const client = getAttioClient(config);
    expect(client).not.toBe(invalidClient);
    expect(getAttioClient(config)).toBe(client);
  });

  it("keeps separate cached clients for different auth tokens", () => {
    const first = getAttioClient({
      authToken: TEST_TOKEN,
      cache: { key: "shared" },
    });
    const second = getAttioClient({
      authToken: "attio_test_token_67890",
      cache: { key: "shared" },
    });

    expect(first).not.toBe(second);
  });

  it("creates new client when cache is disabled", () => {
    const config = {
      authToken: TEST_TOKEN,
      cache: { enabled: false, key: "shared" },
    };

    const first = getAttioClient(config);
    const second = getAttioClient(config);

    expect(first).not.toBe(second);
  });
});

describe("createAttioClient", () => {
  it("creates a client with default config", () => {
    const client = createAttioClient({ authToken: TEST_TOKEN });
    expect(client).toBeDefined();
    expect(client.request).toBeDefined();
  });

  it("creates a client with custom headers", () => {
    const client = createAttioClient({
      authToken: TEST_TOKEN,
      headers: { "X-Custom-Header": "value" },
    });
    expect(client).toBeDefined();
  });

  it("creates a client with retry config", () => {
    const client = createAttioClient({
      authToken: TEST_TOKEN,
      retry: { maxRetries: 5 },
    });
    expect(client).toBeDefined();
  });

  it("creates a client with custom baseUrl", () => {
    const client = createAttioClient({
      authToken: TEST_TOKEN,
      baseUrl: "https://custom.api.com",
    });
    const config = client.getConfig();
    expect(config.baseUrl).toBe("https://custom.api.com");
  });

  it("creates a client with throwOnError false", () => {
    const client = createAttioClient({
      authToken: TEST_TOKEN,
      throwOnError: false,
    });
    expect(client).toBeDefined();
  });

  it("creates a client with responseStyle headers", () => {
    const client = createAttioClient({
      authToken: TEST_TOKEN,
      responseStyle: "headers",
    });
    expect(client).toBeDefined();
  });
});

describe("resolveAttioClient", () => {
  it("returns provided client if present", () => {
    const mockClient = createAttioClient({ authToken: TEST_TOKEN });

    const result = resolveAttioClient({ client: mockClient });

    expect(result).toBe(mockClient);
  });

  it("creates new client from config when no client provided", () => {
    const result = resolveAttioClient({ config: { authToken: TEST_TOKEN } });

    expect(result).toBeDefined();
    expect(result.request).toBeDefined();
  });

  it("creates client with default config when called with empty object", () => {
    vi.spyOn(configModule, "resolveAuthToken").mockReturnValue(TEST_TOKEN);

    const result = resolveAttioClient({});

    expect(result).toBeDefined();
  });

  it("creates client when called with no arguments", () => {
    vi.spyOn(configModule, "resolveAuthToken").mockReturnValue(TEST_TOKEN);

    const result = resolveAttioClient();

    expect(result).toBeDefined();
    expect(result.request).toBeDefined();
  });
});
