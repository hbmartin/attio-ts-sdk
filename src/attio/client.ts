import {
  type Client,
  createClient,
  mergeHeaders,
  type RequestOptions,
} from "../generated/client";
import { getCachedClient, hashToken, setCachedClient } from "./cache";
import {
  type AttioClientConfig,
  resolveAuthToken,
  resolveBaseUrl,
  resolveResponseStyle,
  resolveThrowOnError,
  validateAuthToken,
} from "./config";
import { normalizeAttioError } from "./errors";
import { callWithRetry, type RetryConfig } from "./retry";

export type AttioClient = Client;

export interface AttioClientInput {
  client?: AttioClient;
  config?: AttioClientConfig;
}

export interface AttioRequestOptions extends RequestOptions {
  retry?: Partial<RetryConfig>;
}

interface CreateAttioClientParams {
  config?: AttioClientConfig;
  authToken: string;
}

const resolveFetch = (config?: AttioClientConfig): typeof fetch => {
  const baseFetch = config?.fetch ?? globalThis.fetch;
  if (!baseFetch) {
    throw new Error("Fetch is not available in this environment.");
  }

  if (!config?.timeoutMs) {
    return baseFetch;
  }

  return async (input, init) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), config.timeoutMs);

    let combinedSignal = controller.signal;
    let abortCombined: (() => void) | undefined;

    if (init?.signal) {
      if (typeof AbortSignal !== "undefined" && "any" in AbortSignal) {
        combinedSignal = (
          AbortSignal as typeof AbortSignal & {
            any: (signals: AbortSignal[]) => AbortSignal;
          }
        ).any([init.signal, controller.signal]);
      } else {
        const combinedController = new AbortController();
        combinedSignal = combinedController.signal;

        if (init.signal.aborted) {
          combinedController.abort();
        } else {
          abortCombined = () => combinedController.abort();
          init.signal.addEventListener("abort", abortCombined, { once: true });
          controller.signal.addEventListener("abort", abortCombined, {
            once: true,
          });
        }
      }
    }

    try {
      return await baseFetch(input, {
        ...init,
        signal: combinedSignal,
      });
    } finally {
      if (abortCombined) {
        init?.signal?.removeEventListener("abort", abortCombined);
        controller.signal.removeEventListener("abort", abortCombined);
      }
      clearTimeout(timeoutId);
    }
  };
};

interface ClientCacheKeyParams {
  config: AttioClientConfig;
  authToken: string;
}

const buildClientCacheKey = ({
  config,
  authToken,
}: ClientCacheKeyParams): string | undefined => {
  if (config.cache?.key) return `${config.cache.key}:${hashToken(authToken)}`;
  return undefined;
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
  const requestWithRetry: AttioClient["request"] = async (options) => {
    const { retry: retryOverride, ...rest } = options as AttioRequestOptions;
    return callWithRetry(() => base.request(rest), {
      ...retry,
      ...retryOverride,
    });
  };

  const makeMethod = (method: string) => (options: RequestOptions) =>
    requestWithRetry({
      ...options,
      method: method as RequestOptions["method"],
    });

  return {
    ...base,
    request: requestWithRetry,
    connect: makeMethod("CONNECT"),
    delete: makeMethod("DELETE"),
    get: makeMethod("GET"),
    head: makeMethod("HEAD"),
    options: makeMethod("OPTIONS"),
    patch: makeMethod("PATCH"),
    post: makeMethod("POST"),
    put: makeMethod("PUT"),
    trace: makeMethod("TRACE"),
  } as AttioClient;
};

const createAttioClientWithAuthToken = ({
  config = {},
  authToken,
}: CreateAttioClientParams): AttioClient => {
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

  const mergedHeaders = mergeHeaders({ Accept: "application/json" }, headers);

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

export const createAttioClient = (
  config: AttioClientConfig = {},
): AttioClient => {
  const authToken = validateAuthToken(resolveAuthToken(config));
  return createAttioClientWithAuthToken({ config, authToken });
};

export const getAttioClient = (config: AttioClientConfig = {}): AttioClient => {
  const cacheEnabled = config.cache?.enabled ?? true;
  const authToken = validateAuthToken(resolveAuthToken(config));
  const cacheKey = buildClientCacheKey({ config, authToken });

  if (cacheEnabled && cacheKey) {
    const cached = getCachedClient<AttioClient>(cacheKey);
    if (cached) {
      return cached;
    }

    const client = createAttioClientWithAuthToken({ config, authToken });
    setCachedClient(cacheKey, client);
    return client;
  }

  return createAttioClientWithAuthToken({ config, authToken });
};

export const resolveAttioClient = (
  input: AttioClientInput = {},
): AttioClient => {
  return input.client ?? getAttioClient(input.config ?? {});
};
