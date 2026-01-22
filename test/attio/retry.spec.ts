import { afterEach, describe, expect, it, vi } from "vitest";
import { AttioRetryError } from "../../src/attio/errors.ts";
import {
  calculateRetryDelay,
  callWithRetry,
  DEFAULT_RETRY_CONFIG,
  isRetryableError,
  isRetryableStatus,
  type RetryConfig,
  sleep,
} from "../../src/attio/retry.ts";

const config: RetryConfig = {
  maxRetries: 3,
  initialDelayMs: 500,
  maxDelayMs: 5000,
  retryableStatusCodes: [408, 429, 500],
  respectRetryAfter: true,
};

afterEach(() => {
  vi.useRealTimers();
});

describe("retry", () => {
  describe("sleep", () => {
    it("resolves after specified milliseconds", async () => {
      vi.useFakeTimers();
      const promise = sleep(100);
      vi.advanceTimersByTime(100);
      await expect(promise).resolves.toBeUndefined();
    });
  });

  describe("calculateRetryDelay", () => {
    it("uses Retry-After when provided", () => {
      const delay = calculateRetryDelay(0, config, 2000);
      expect(delay).toBe(2000);
    });

    it("caps Retry-After to maxDelayMs", () => {
      const delay = calculateRetryDelay(0, config, 10_000);
      expect(delay).toBe(5000);
    });

    it("uses exponential backoff when no Retry-After", () => {
      const delay = calculateRetryDelay(0, config, undefined);
      expect(delay).toBeGreaterThanOrEqual(375);
      expect(delay).toBeLessThanOrEqual(625);
    });

    it("ignores Retry-After when respectRetryAfter is false", () => {
      const configNoRespect = { ...config, respectRetryAfter: false };
      const delay = calculateRetryDelay(0, configNoRespect, 2000);
      expect(delay).not.toBe(2000);
    });

    it("ignores zero or negative Retry-After", () => {
      const delay1 = calculateRetryDelay(0, config, 0);
      const delay2 = calculateRetryDelay(0, config, -100);
      expect(delay1).not.toBe(0);
      expect(delay2).not.toBe(-100);
    });
  });

  describe("isRetryableStatus", () => {
    it("treats undefined as retryable", () => {
      expect(isRetryableStatus(undefined, config)).toBe(true);
    });

    it("returns true for retryable status codes", () => {
      expect(isRetryableStatus(429, config)).toBe(true);
      expect(isRetryableStatus(500, config)).toBe(true);
    });

    it("returns false for non-retryable status codes", () => {
      expect(isRetryableStatus(400, config)).toBe(false);
      expect(isRetryableStatus(404, config)).toBe(false);
    });
  });

  describe("isRetryableError", () => {
    it("treats network errors as retryable", () => {
      const error = { isNetworkError: true };
      expect(isRetryableError(error, config)).toBe(true);
    });

    it("checks status for API errors", () => {
      expect(isRetryableError({ status: 429 }, config)).toBe(true);
      expect(isRetryableError({ status: 400 }, config)).toBe(false);
    });

    it("treats undefined errors as retryable", () => {
      expect(isRetryableError(undefined, config)).toBe(true);
    });
  });

  describe("callWithRetry", () => {
    it("returns result on first success", async () => {
      const fn = vi.fn().mockResolvedValue("success");
      const result = await callWithRetry(fn);
      expect(result).toBe("success");
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it("retries on retryable error and succeeds", async () => {
      vi.useFakeTimers();
      const fn = vi
        .fn()
        .mockRejectedValueOnce({ status: 500 })
        .mockResolvedValue("success");

      const promise = callWithRetry(fn, { maxRetries: 2, initialDelayMs: 10 });
      await vi.advanceTimersByTimeAsync(100);

      await expect(promise).resolves.toBe("success");
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it("throws AttioRetryError after max retries exceeded", async () => {
      const error = { status: 500 };
      const fn = vi.fn().mockRejectedValue(error);

      // Use real timers with very short delays to avoid async timing issues
      await expect(
        callWithRetry(fn, { maxRetries: 2, initialDelayMs: 1, maxDelayMs: 5 }),
      ).rejects.toThrow(AttioRetryError);

      try {
        await callWithRetry(fn, {
          maxRetries: 2,
          initialDelayMs: 1,
          maxDelayMs: 5,
        });
      } catch (thrownError) {
        expect(thrownError).toBeInstanceOf(AttioRetryError);
        expect((thrownError as AttioRetryError).code).toBe("RETRY_EXHAUSTED");
        expect((thrownError as AttioRetryError).cause).toEqual(error);
      }
      // 3 attempts from first call + 3 attempts from second call = 6 total
      expect(fn).toHaveBeenCalledTimes(6);
    });

    it("throws immediately for non-retryable errors", async () => {
      const error = { status: 400 };
      const fn = vi.fn().mockRejectedValue(error);

      await expect(callWithRetry(fn)).rejects.toEqual(error);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it("uses default config when none provided", async () => {
      const fn = vi.fn().mockResolvedValue("result");
      await callWithRetry(fn);
      expect(fn).toHaveBeenCalled();
    });

    it("uses retryAfterMs from error", async () => {
      vi.useFakeTimers();
      const fn = vi
        .fn()
        .mockRejectedValueOnce({ status: 429, retryAfterMs: 50 })
        .mockResolvedValue("success");

      const promise = callWithRetry(fn, { maxRetries: 2 });
      await vi.advanceTimersByTimeAsync(100);

      await expect(promise).resolves.toBe("success");
    });
  });

  describe("DEFAULT_RETRY_CONFIG", () => {
    it("has expected default values", () => {
      expect(DEFAULT_RETRY_CONFIG.maxRetries).toBe(3);
      expect(DEFAULT_RETRY_CONFIG.initialDelayMs).toBe(500);
      expect(DEFAULT_RETRY_CONFIG.maxDelayMs).toBe(5000);
      expect(DEFAULT_RETRY_CONFIG.retryableStatusCodes).toContain(429);
      expect(DEFAULT_RETRY_CONFIG.respectRetryAfter).toBe(true);
    });
  });
});
