import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearClientCache } from "../../src/attio/cache";
import { createAttioClient, getAttioClient } from "../../src/attio/client";
import * as configModule from "../../src/attio/config";
import { AttioEnvironmentError } from "../../src/attio/errors";
import type { AttioLogger } from "../../src/attio/hooks";

const TEST_TOKEN = "attio_test_token_12345";

interface FetchHarnessState {
  aborted: boolean;
  capturedSignal: AbortSignal | undefined;
}

interface FetchHarness {
  baseFetch: typeof fetch;
  getState: () => FetchHarnessState;
}

const createFetchHarness = (fallbackDelayMs: number): FetchHarness => {
  let aborted = false;
  let capturedSignal: AbortSignal | undefined;

  const baseFetch: typeof fetch = (_input, init) => {
    capturedSignal = init?.signal;

    return new Promise<Response>((resolve) => {
      const fallbackTimer = setTimeout(
        () => resolve(new Response("ok")),
        fallbackDelayMs,
      );

      if (!init?.signal) {
        clearTimeout(fallbackTimer);
        resolve(new Response("missing-signal"));
        return;
      }

      const onAbort = () => {
        aborted = true;
        clearTimeout(fallbackTimer);
        resolve(new Response("aborted"));
      };

      init.signal.addEventListener("abort", onAbort, { once: true });
    });
  };

  return {
    baseFetch,
    getState: () => ({ aborted, capturedSignal }),
  };
};

const getTimeoutFetch = (baseFetch: typeof fetch, timeoutMs: number) => {
  const client = createAttioClient({
    authToken: TEST_TOKEN,
    fetch: baseFetch,
    timeoutMs,
  });

  const fetchWithTimeout = client.getConfig().fetch;
  if (!fetchWithTimeout) {
    throw new AttioEnvironmentError("Fetch is not configured.");
  }

  return fetchWithTimeout;
};

beforeEach(() => {
  clearClientCache();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("wrapClient", () => {
  it("exposes HTTP methods that use retry logic", async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: "test" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const client = createAttioClient({
      authToken: TEST_TOKEN,
      fetch: mockFetch,
    });

    // Test that wrapped methods exist and are callable
    expect(client.get).toBeDefined();
    expect(client.post).toBeDefined();
    expect(client.put).toBeDefined();
    expect(client.patch).toBeDefined();
    expect(client.delete).toBeDefined();
    expect(client.head).toBeDefined();
    expect(client.options).toBeDefined();
    expect(client.connect).toBeDefined();
    expect(client.trace).toBeDefined();

    // Call a method to ensure it works through retry wrapper
    await client.get({ url: "/test" });
    expect(mockFetch).toHaveBeenCalled();
  });

  it("calls request through retry wrapper", async () => {
    let callCount = 0;
    const mockFetch = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve(
          new Response(JSON.stringify({ error: "rate limited" }), {
            status: 500,
          }),
        );
      }
      return Promise.resolve(
        new Response(JSON.stringify({ data: "success" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
    });

    const client = createAttioClient({
      authToken: TEST_TOKEN,
      fetch: mockFetch,
      retry: { maxRetries: 2, initialDelayMs: 1, maxDelayMs: 5 },
    });

    await client.request({ url: "/test", method: "GET" });
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});

describe("applyInterceptors", () => {
  it("normalizes errors through error interceptor", async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error("Network error"));

    const client = createAttioClient({
      authToken: TEST_TOKEN,
      fetch: mockFetch,
      throwOnError: true,
    });

    await expect(client.get({ url: "/test" })).rejects.toThrow();
  });

  it("invokes request and response hooks with expected payloads", async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: "ok" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    const onRequest = vi.fn();
    const onResponse = vi.fn();

    const client = createAttioClient({
      authToken: TEST_TOKEN,
      fetch: mockFetch,
      hooks: { onRequest, onResponse },
    });

    await client.get({ url: "/test" });

    expect(onRequest).toHaveBeenCalledTimes(1);
    const [[requestPayload]] = onRequest.mock.calls;
    expect(requestPayload).toHaveProperty("request");
    expect(requestPayload).toHaveProperty("options");
    expect(requestPayload.request).toBeInstanceOf(Request);
    expect(requestPayload.request.url).toContain("/test");

    expect(onResponse).toHaveBeenCalledTimes(1);
    const [[responsePayload]] = onResponse.mock.calls;
    expect(responsePayload).toHaveProperty("response");
    expect(responsePayload).toHaveProperty("request");
    expect(responsePayload.response).toBeInstanceOf(Response);
    expect(responsePayload.response.status).toBe(200);
  });

  it("invokes error hooks with error payload", async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error("Network error"));
    const onError = vi.fn();

    const client = createAttioClient({
      authToken: TEST_TOKEN,
      fetch: mockFetch,
      hooks: { onError },
      retry: { maxRetries: 0 },
      throwOnError: true,
    });

    await expect(client.get({ url: "/test" })).rejects.toThrow();
    expect(onError).toHaveBeenCalledTimes(1);
    const [[errorPayload]] = onError.mock.calls;
    expect(errorPayload).toHaveProperty("error");
    expect(errorPayload.error).toHaveProperty("message");
    expect(errorPayload.error.message).toContain("Network error");
  });
});

describe("resolveFetch", () => {
  it("aborts the combined signal on timeout when AbortSignal.any is unavailable", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("AbortSignal", undefined);

    const timeoutMs = 10;
    const fallbackDelayMs = 50;
    const { baseFetch, getState } = createFetchHarness(fallbackDelayMs);
    const fetchWithTimeout = getTimeoutFetch(baseFetch, timeoutMs);

    const externalController = new AbortController();

    const fetchPromise = fetchWithTimeout("https://example.com", {
      signal: externalController.signal,
    });

    try {
      await vi.advanceTimersByTimeAsync(timeoutMs);

      const { aborted, capturedSignal } = getState();
      expect(externalController.signal.aborted).toBe(false);
      expect(capturedSignal).toBeDefined();
      expect(capturedSignal).not.toBe(externalController.signal);
      expect(aborted).toBe(true);
    } finally {
      await vi.advanceTimersByTimeAsync(fallbackDelayMs);
      await fetchPromise;
    }
  });

  it("aborts the combined signal when the external signal aborts", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("AbortSignal", undefined);

    const timeoutMs = 100;
    const fallbackDelayMs = 50;
    const { baseFetch, getState } = createFetchHarness(fallbackDelayMs);
    const fetchWithTimeout = getTimeoutFetch(baseFetch, timeoutMs);

    const externalController = new AbortController();

    const fetchPromise = fetchWithTimeout("https://example.com", {
      signal: externalController.signal,
    });

    externalController.abort();

    const { aborted, capturedSignal } = getState();
    expect(capturedSignal).toBeDefined();
    expect(capturedSignal).not.toBe(externalController.signal);
    expect(aborted).toBe(true);

    await fetchPromise;
  });

  it("throws AttioEnvironmentError when fetch is unavailable", () => {
    const originalFetch = globalThis.fetch;
    vi.stubGlobal("fetch", undefined);

    try {
      expect(() =>
        createAttioClient({
          authToken: TEST_TOKEN,
          fetch: undefined,
        }),
      ).toThrow(AttioEnvironmentError);
    } finally {
      vi.stubGlobal("fetch", originalFetch);
    }
  });

  it("uses timeout with AbortSignal.any when available", async () => {
    vi.useFakeTimers();

    const timeoutMs = 10;
    const fallbackDelayMs = 50;
    const { baseFetch, getState } = createFetchHarness(fallbackDelayMs);
    const fetchWithTimeout = getTimeoutFetch(baseFetch, timeoutMs);

    const externalController = new AbortController();

    const fetchPromise = fetchWithTimeout("https://example.com", {
      signal: externalController.signal,
    });

    try {
      await vi.advanceTimersByTimeAsync(timeoutMs);

      const { capturedSignal } = getState();
      expect(capturedSignal).toBeDefined();
    } finally {
      await vi.advanceTimersByTimeAsync(fallbackDelayMs);
      await fetchPromise;
    }
  });

  it("handles timeout without external signal", async () => {
    vi.useFakeTimers();

    const timeoutMs = 10;
    const fallbackDelayMs = 50;
    const { baseFetch, getState } = createFetchHarness(fallbackDelayMs);
    const fetchWithTimeout = getTimeoutFetch(baseFetch, timeoutMs);

    const fetchPromise = fetchWithTimeout("https://example.com", {});

    try {
      await vi.advanceTimersByTimeAsync(timeoutMs);

      const { capturedSignal } = getState();
      expect(capturedSignal).toBeDefined();
    } finally {
      await vi.advanceTimersByTimeAsync(fallbackDelayMs);
      await fetchPromise;
    }
  });

  it("uses globalThis.fetch when no custom fetch is provided", async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: "ok" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", mockFetch);

    const client = createAttioClient({ authToken: TEST_TOKEN });
    await client.get({ url: "/test" });

    expect(mockFetch).toHaveBeenCalled();
  });

  it("combines fallback with pre-aborted signal", async () => {
    vi.stubGlobal("AbortSignal", undefined);

    const mockFetch = vi
      .fn()
      .mockResolvedValue(new Response("ok", { status: 200 }));

    const client = createAttioClient({
      authToken: TEST_TOKEN,
      fetch: mockFetch,
      timeoutMs: 5000,
    });

    const fetchFn = client.getConfig().fetch;
    if (!fetchFn) {
      throw new Error("fetch not configured");
    }

    const preAbortedController = new AbortController();
    preAbortedController.abort();

    await fetchFn("https://example.com", {
      signal: preAbortedController.signal,
    });

    expect(mockFetch).toHaveBeenCalled();
  });
});

describe("getAttioClient without auth token", () => {
  beforeEach(() => {
    vi.spyOn(configModule, "resolveAuthToken").mockReturnValue(undefined);
  });

  it("skips client cache when no auth token is resolved", () => {
    const first = getAttioClient({});
    const second = getAttioClient({});

    // Without auth token, no cacheKey is built, so each call creates a new client
    expect(first).not.toBe(second);
  });

  it("skips client cache when no auth token even with cache key configured", () => {
    const first = getAttioClient({ cache: { key: "shared" } });
    const second = getAttioClient({ cache: { key: "shared" } });

    expect(first).not.toBe(second);
  });
});

describe("logger hooks", () => {
  it("invokes debug logger on request and response", async () => {
    const debugFn = vi.fn();
    const logger: AttioLogger = { debug: debugFn };

    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: "ok" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const client = createAttioClient({
      authToken: TEST_TOKEN,
      fetch: mockFetch,
      logger,
    });

    await client.get({ url: "/test" });

    const requestCalls = debugFn.mock.calls.filter(
      ([msg]: [string]) => msg === "attio.request",
    );
    const responseCalls = debugFn.mock.calls.filter(
      ([msg]: [string]) => msg === "attio.response",
    );

    expect(requestCalls).toHaveLength(1);
    expect(requestCalls[0][1]).toHaveProperty("method");
    expect(requestCalls[0][1]).toHaveProperty("url");

    expect(responseCalls).toHaveLength(1);
    expect(responseCalls[0][1]).toHaveProperty("status", 200);
  });

  it("invokes error logger on error", async () => {
    const errorFn = vi.fn();
    const logger: AttioLogger = { error: errorFn };

    const mockFetch = vi.fn().mockRejectedValue(new Error("fail"));

    const client = createAttioClient({
      authToken: TEST_TOKEN,
      fetch: mockFetch,
      logger,
      retry: { maxRetries: 0 },
      throwOnError: true,
    });

    await expect(client.get({ url: "/test" })).rejects.toThrow();

    const errorCalls = errorFn.mock.calls.filter(
      ([msg]: [string]) => msg === "attio.error",
    );
    expect(errorCalls).toHaveLength(1);
    expect(errorCalls[0][1]).toHaveProperty("message");
  });

  it("composes logger hooks with custom hooks", async () => {
    const debugFn = vi.fn();
    const customOnRequest = vi.fn();
    const customOnResponse = vi.fn();
    const logger: AttioLogger = { debug: debugFn };

    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: "ok" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const client = createAttioClient({
      authToken: TEST_TOKEN,
      fetch: mockFetch,
      logger,
      hooks: { onRequest: customOnRequest, onResponse: customOnResponse },
    });

    await client.get({ url: "/test" });

    expect(debugFn).toHaveBeenCalled();
    expect(customOnRequest).toHaveBeenCalledTimes(1);
    expect(customOnResponse).toHaveBeenCalledTimes(1);
  });

  it("works with no logger or hooks configured", async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: "ok" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const client = createAttioClient({
      authToken: TEST_TOKEN,
      fetch: mockFetch,
    });

    await expect(client.get({ url: "/test" })).resolves.toBeDefined();
  });
});
