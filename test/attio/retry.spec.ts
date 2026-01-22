import { describe, expect, it } from "vitest";

import { calculateRetryDelay, isRetryableStatus } from "../../src/attio/retry";

const config = {
  maxRetries: 3,
  initialDelayMs: 500,
  maxDelayMs: 5000,
  retryableStatusCodes: [408, 429, 500],
  respectRetryAfter: true,
};

describe("retry", () => {
  it("uses Retry-After when provided", () => {
    const delay = calculateRetryDelay(0, config, 2000);
    expect(delay).toBe(2000);
  });

  it("relies on retryableStatusCodes and treats undefined as retryable", () => {
    expect(isRetryableStatus(undefined, config)).toBe(true);
    expect(isRetryableStatus(400, config)).toBe(false);
    expect(isRetryableStatus(429, config)).toBe(true);
  });
});
