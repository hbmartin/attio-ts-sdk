import { z } from "zod";
import { AttioError, AttioRetryError } from "./errors";

interface RetryConfig {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  retryableStatusCodes: number[];
  respectRetryAfter: boolean;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  initialDelayMs: 500,
  maxDelayMs: 5000,
  retryableStatusCodes: [408, 429, 500, 502, 503, 504],
  respectRetryAfter: true,
};

const RetryErrorSchema = z.object({
  status: z.number().optional(),
  isNetworkError: z.boolean().optional(),
  retryAfterMs: z.number().optional(),
});

type RetryErrorInfo = z.infer<typeof RetryErrorSchema>;

const extractRetryErrorInfo = (error: unknown): RetryErrorInfo | undefined => {
  if (error instanceof AttioError) {
    return {
      status: error.status,
      isNetworkError: error.isNetworkError,
      retryAfterMs: error.retryAfterMs,
    };
  }

  const result = RetryErrorSchema.safeParse(error);
  if (!result.success) {
    return;
  }
  return result.data;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const calculateRetryDelay = (
  attempt: number,
  config: RetryConfig,
  retryAfterMs?: number,
): number => {
  if (config.respectRetryAfter && retryAfterMs && retryAfterMs > 0) {
    return Math.min(retryAfterMs, config.maxDelayMs);
  }

  const base = config.initialDelayMs * 2 ** attempt;
  const jitter = 0.75 + Math.random() * 0.5;
  return Math.min(base * jitter, config.maxDelayMs);
};

const isRetryableStatus = (
  status: number | undefined,
  config: RetryConfig,
): boolean => {
  if (status === undefined) {
    return true;
  }
  return config.retryableStatusCodes.includes(status);
};

const isRetryableError = (error: unknown, config: RetryConfig): boolean => {
  const info = extractRetryErrorInfo(error);
  if (info?.isNetworkError) {
    return true;
  }
  return isRetryableStatus(info?.status, config);
};

const getRetryAfterMs = (error: unknown): number | undefined =>
  extractRetryErrorInfo(error)?.retryAfterMs;

const callWithRetry = async <T>(
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

  throw new AttioRetryError("Retry attempts exhausted.", {
    code: "RETRY_EXHAUSTED",
  });
};

export type { RetryConfig };
export {
  DEFAULT_RETRY_CONFIG,
  sleep,
  calculateRetryDelay,
  isRetryableStatus,
  isRetryableError,
  callWithRetry,
};
