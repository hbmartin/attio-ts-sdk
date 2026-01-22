import type { AttioError } from "./errors";

export interface RetryConfig {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  retryableStatusCodes: number[];
  respectRetryAfter: boolean;
}

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  initialDelayMs: 500,
  maxDelayMs: 5000,
  retryableStatusCodes: [408, 429, 500, 502, 503, 504],
  respectRetryAfter: true,
};

export const sleep = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

export const calculateRetryDelay = (
  attempt: number,
  config: RetryConfig,
  retryAfterMs?: number,
): number => {
  if (config.respectRetryAfter && retryAfterMs && retryAfterMs > 0) {
    return Math.min(retryAfterMs, config.maxDelayMs);
  }

  const base = config.initialDelayMs * Math.pow(2, attempt);
  const jitter = 0.75 + Math.random() * 0.5;
  return Math.min(base * jitter, config.maxDelayMs);
};

export const isRetryableStatus = (
  status: number | undefined,
  config: RetryConfig,
): boolean => {
  if (status === undefined) return true;
  return config.retryableStatusCodes.includes(status);
};

export const isRetryableError = (
  error: AttioError | unknown,
  config: RetryConfig,
): boolean => {
  const typed = error as AttioError | undefined;
  if (typed?.isNetworkError) return true;
  return isRetryableStatus(typed?.status, config);
};

const getRetryAfterMs = (error: AttioError | unknown): number | undefined => {
  const typed = error as AttioError | undefined;
  if (typed?.retryAfterMs) return typed.retryAfterMs;
  return undefined;
};

export const callWithRetry = async <T>(
  fn: () => Promise<T>,
  config?: Partial<RetryConfig>,
): Promise<T> => {
  const retryConfig: RetryConfig = {
    ...DEFAULT_RETRY_CONFIG,
    ...config,
  };

  let attempt = 0;
  while (attempt <= retryConfig.maxRetries) {
    try {
      return await fn();
    } catch (error) {
      if (
        !isRetryableError(error, retryConfig) ||
        attempt >= retryConfig.maxRetries
      ) {
        throw error;
      }

      const delay = calculateRetryDelay(
        attempt,
        retryConfig,
        getRetryAfterMs(error),
      );
      await sleep(delay);
      attempt += 1;
    }
  }

  throw new Error("Retry attempts exhausted.");
};
