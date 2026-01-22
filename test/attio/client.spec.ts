import { afterEach, describe, expect, it, vi } from "vitest";

import { createAttioClient } from "../../src/attio/client";

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

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
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
