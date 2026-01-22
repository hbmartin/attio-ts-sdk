import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createAttioClient, resolveAttioClient } from "../../src/attio/client";
import { clearClientCache } from "../../src/attio/cache";

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
    throw new Error("Fetch is not configured.");
  }

  return fetchWithTimeout;
};

beforeEach(() => {
  clearClientCache();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
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
});
