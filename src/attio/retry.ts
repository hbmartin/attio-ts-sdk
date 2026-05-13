import { z } from "zod";
import type { RequestResult, ResponseStyle } from "../generated/client";
import { AttioError, AttioRetryError } from "./errors";

type RetryHttpMethod =
  | "CONNECT"
  | "DELETE"
  | "GET"
  | "HEAD"
  | "OPTIONS"
  | "PATCH"
  | "POST"
  | "PUT"
  | "TRACE";

interface RetryRequestContext {
  method?: RetryHttpMethod;
  headers?: unknown;
}

interface RetryConfig {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  retryableStatusCodes: number[];
  retryableMethods: RetryHttpMethod[];
  respectRetryAfter: boolean;
  retryUnsafeRequests: boolean;
  idempotencyHeaderNames: string[];
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  initialDelayMs: 500,
  maxDelayMs: 5000,
  retryableStatusCodes: [408, 429, 500, 502, 503, 504],
  retryableMethods: ["GET", "HEAD", "OPTIONS"],
  respectRetryAfter: true,
  retryUnsafeRequests: false,
  idempotencyHeaderNames: ["Idempotency-Key", "X-Idempotency-Key"],
};

const RetryErrorSchema = z.object({
  status: z.number().optional(),
  isNetworkError: z.boolean().optional(),
  retryAfterMs: z.number().optional(),
});

const retryHttpMethodSchema = z.enum([
  "CONNECT",
  "DELETE",
  "GET",
  "HEAD",
  "OPTIONS",
  "PATCH",
  "POST",
  "PUT",
  "TRACE",
]);

const headerTupleSchema = z.tuple([z.string(), z.unknown()]);
const headerRecordSchema = z.record(z.string(), z.unknown());

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

const getHeaderEntries = (headers: unknown): [string, unknown][] => {
  if (headers === undefined) {
    return [];
  }

  if (headers instanceof Headers) {
    const entries: [string, string][] = [];
    headers.forEach((value, key) => {
      entries.push([key, value]);
    });
    return entries;
  }

  const tupleResult = z.array(headerTupleSchema).safeParse(headers);
  if (tupleResult.success) {
    return tupleResult.data;
  }

  const recordResult = headerRecordSchema.safeParse(headers);
  if (recordResult.success) {
    return Object.entries(recordResult.data);
  }

  return [];
};

const hasIdempotencyHeader = (
  headers: unknown,
  headerNames: readonly string[],
): boolean => {
  const normalizedNames = new Set(
    headerNames.map((headerName) => headerName.toLowerCase()),
  );

  return getHeaderEntries(headers).some(([key, value]) => {
    if (!normalizedNames.has(key.toLowerCase())) {
      return false;
    }
    return value !== undefined && value !== null && String(value).length > 0;
  });
};

const isRetryableRequest = (
  context: RetryRequestContext | undefined,
  config: RetryConfig,
): boolean => {
  if (config.retryUnsafeRequests) {
    return true;
  }

  if (!context?.method) {
    return true;
  }

  const methodResult = retryHttpMethodSchema.safeParse(context.method);
  if (
    methodResult.success &&
    config.retryableMethods.includes(methodResult.data)
  ) {
    return true;
  }

  return hasIdempotencyHeader(context.headers, config.idempotencyHeaderNames);
};

function callWithRetry<T>(
  fn: () => Promise<T>,
  config?: Partial<RetryConfig>,
  context?: RetryRequestContext,
): Promise<T>;
function callWithRetry<
  TData,
  TError,
  ThrowOnError extends boolean,
  TResponseStyle extends ResponseStyle,
>(
  fn: () => RequestResult<TData, TError, ThrowOnError, TResponseStyle>,
  config?: Partial<RetryConfig>,
  context?: RetryRequestContext,
): RequestResult<TData, TError, ThrowOnError, TResponseStyle>;
async function callWithRetry<T>(
  fn: () => Promise<T>,
  config?: Partial<RetryConfig>,
  context?: RetryRequestContext,
): Promise<T> {
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
        !(
          isRetryableError(error, retryConfig) &&
          isRetryableRequest(context, retryConfig)
        )
      ) {
        throw error;
      }

      if (attempt >= retryConfig.maxRetries) {
        throw new AttioRetryError("Retry attempts exhausted.", {
          code: "RETRY_EXHAUSTED",
          cause: error,
        });
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
}

export type { RetryConfig, RetryHttpMethod, RetryRequestContext };
export {
  calculateRetryDelay,
  callWithRetry,
  DEFAULT_RETRY_CONFIG,
  hasIdempotencyHeader,
  isRetryableError,
  isRetryableRequest,
  isRetryableStatus,
  sleep,
};
