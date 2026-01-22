import {
  createClient,
  mergeHeaders,
  type Client,
  type RequestOptions,
} from '../generated/client';
import {
  resolveAuthToken,
  resolveBaseUrl,
  resolveResponseStyle,
  resolveThrowOnError,
  validateAuthToken,
  type AttioClientConfig,
} from './config';
import { getCachedClient, hashToken, setCachedClient } from './cache';
import { callWithRetry, type RetryConfig } from './retry';
import { normalizeAttioError } from './errors';

export type AttioClient = Client;

export interface AttioClientInput {
  client?: AttioClient;
  config?: AttioClientConfig;
}

export interface AttioRequestOptions extends RequestOptions {
  retry?: Partial<RetryConfig>;
}

const resolveFetch = (config?: AttioClientConfig): typeof fetch => {
  const baseFetch = config?.fetch ?? globalThis.fetch;
  if (!baseFetch) {
    throw new Error('Fetch is not available in this environment.');
  }

  if (!config?.timeoutMs) {
    return baseFetch;
  }

  return async (input, init) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), config.timeoutMs);

    const combinedSignal = init?.signal
      ? typeof AbortSignal !== 'undefined' && 'any' in AbortSignal
        ? (AbortSignal as typeof AbortSignal & { any: (signals: AbortSignal[]) => AbortSignal }).any([
            init.signal,
            controller.signal,
          ])
        : init.signal
      : controller.signal;

    try {
      return await baseFetch(input, {
        ...init,
        signal: combinedSignal,
      });
    } finally {
      clearTimeout(timeoutId);
    }
  };
};

const buildClientCacheKey = (config: AttioClientConfig, token: string): string => {
  if (config.cache?.key) return config.cache.key;
  const baseUrl = resolveBaseUrl(config);
  const responseStyle = resolveResponseStyle(config);
  const throwOnError = resolveThrowOnError(config);
  return `${baseUrl}|${hashToken(token)}|${responseStyle}|${throwOnError}`;
};

const applyInterceptors = (client: AttioClient): void => {
  client.interceptors.error.use((error, response, request, options) =>
    normalizeAttioError(error, { response, request, options }),
  );
};

const wrapClient = (
  base: AttioClient,
  retry?: Partial<RetryConfig>,
): AttioClient => {
  const requestWithRetry: AttioClient['request'] = async (options) => {
    const { retry: retryOverride, ...rest } = options as AttioRequestOptions;
    return callWithRetry(
      () => base.request(rest),
      {
        ...retry,
        ...retryOverride,
      },
    );
  };

  const makeMethod = (method: string) => (options: RequestOptions) =>
    requestWithRetry({ ...options, method: method as RequestOptions['method'] });

  return {
    ...base,
    request: requestWithRetry,
    connect: makeMethod('CONNECT'),
    delete: makeMethod('DELETE'),
    get: makeMethod('GET'),
    head: makeMethod('HEAD'),
    options: makeMethod('OPTIONS'),
    patch: makeMethod('PATCH'),
    post: makeMethod('POST'),
    put: makeMethod('PUT'),
    trace: makeMethod('TRACE'),
  } as AttioClient;
};

export const createAttioClient = (config: AttioClientConfig = {}): AttioClient => {
  const authToken = validateAuthToken(resolveAuthToken(config));
  const baseUrl = resolveBaseUrl(config);
  const responseStyle = resolveResponseStyle(config);
  const throwOnError = resolveThrowOnError(config);

  const headers = config.headers;
  const retry = config.retry;
  const timeoutMs = config.timeoutMs;
  const cleanConfig: AttioClientConfig = { ...config };
  delete cleanConfig.apiKey;
  delete cleanConfig.accessToken;
  delete cleanConfig.authToken;
  delete cleanConfig.cache;
  delete cleanConfig.retry;
  delete cleanConfig.timeoutMs;
  delete cleanConfig.headers;

  const mergedHeaders = mergeHeaders(
    { Accept: 'application/json' },
    headers,
  );

  const base = createClient({
    ...cleanConfig,
    baseUrl,
    auth: authToken,
    headers: mergedHeaders,
    fetch: resolveFetch({ ...config, timeoutMs }),
    responseStyle,
    throwOnError,
  });

  applyInterceptors(base);

  return wrapClient(base, retry);
};

export const getAttioClient = (config: AttioClientConfig = {}): AttioClient => {
  const cacheEnabled = config.cache?.enabled ?? true;
  const authToken = validateAuthToken(resolveAuthToken(config));

  if (cacheEnabled) {
    const cacheKey = buildClientCacheKey(config, authToken);
    const cached = getCachedClient<AttioClient>(cacheKey);
    if (cached) {
      return cached;
    }

    const client = createAttioClient(config);
    setCachedClient(cacheKey, client);
    return client;
  }

  return createAttioClient(config);
};

export const resolveAttioClient = (input: AttioClientInput = {}): AttioClient => {
  return input.client ?? getAttioClient(input.config ?? {});
};
