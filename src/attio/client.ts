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
import { AttioEnvironmentError, normalizeAttioError } from "./errors";
import { callWithRetry, type RetryConfig } from "./retry";

type AttioClient = Client;

interface AttioClientInput {
  client?: AttioClient;
  config?: AttioClientConfig;
}

interface AttioRequestOptions extends RequestOptions {
  retry?: Partial<RetryConfig>;
}

interface CreateAttioClientParams {
  config?: AttioClientConfig;
  authToken: string;
}

const combineSignalsWithAny = (
  initSignal: AbortSignal,
  controllerSignal: AbortSignal,
): AbortSignal =>
  (
    AbortSignal as typeof AbortSignal & {
      any: (signals: AbortSignal[]) => AbortSignal;
    }
  ).any([initSignal, controllerSignal]);

interface SignalCombinationResult {
  combinedSignal: AbortSignal;
  abortCombined?: () => void;
}

const combineSignalsWithFallback = (
  initSignal: AbortSignal,
  controllerSignal: AbortSignal,
): SignalCombinationResult => {
  const combinedController = new AbortController();

  if (initSignal.aborted) {
    combinedController.abort();
    return { combinedSignal: combinedController.signal };
  }

  const abortCombined = () => combinedController.abort();
  initSignal.addEventListener("abort", abortCombined, { once: true });
  controllerSignal.addEventListener("abort", abortCombined, { once: true });

  return { combinedSignal: combinedController.signal, abortCombined };
};

const resolveFetch = (config?: AttioClientConfig): typeof fetch => {
  const baseFetch = config?.fetch ?? globalThis.fetch;
  if (!baseFetch) {
    throw new AttioEnvironmentError(
      "Fetch is not available in this environment.",
      { code: "FETCH_UNAVAILABLE" },
    );
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
      const supportsSignalAny =
        typeof AbortSignal !== "undefined" && "any" in AbortSignal;
      if (supportsSignalAny) {
        combinedSignal = combineSignalsWithAny(init.signal, controller.signal);
      } else {
        ({ combinedSignal, abortCombined } = combineSignalsWithFallback(
          init.signal,
          controller.signal,
        ));
      }
    }

    try {
      return await baseFetch(input, { ...init, signal: combinedSignal });
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
  if (config.cache?.key) {
    return `${config.cache.key}:${hashToken(authToken)}`;
  }
  return;
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
  const requestWithRetry: AttioClient["request"] = (
    options: AttioRequestOptions,
  ) => {
    const { retry: retryOverride, ...rest } = options;
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

interface CleanedConfigResult {
  cleanConfig: AttioClientConfig;
  headers: AttioClientConfig["headers"];
  retry: AttioClientConfig["retry"];
  timeoutMs: AttioClientConfig["timeoutMs"];
}

const extractAndCleanConfig = (
  config: AttioClientConfig,
): CleanedConfigResult => {
  const {
    apiKey: _apiKey,
    accessToken: _accessToken,
    authToken: _authToken,
    cache: _cache,
    retry,
    timeoutMs,
    headers,
    ...cleanConfig
  } = config;
  return { cleanConfig, headers, retry, timeoutMs };
};

const createAttioClientWithAuthToken = ({
  config = {},
  authToken,
}: CreateAttioClientParams): AttioClient => {
  const baseUrl = resolveBaseUrl(config);
  const responseStyle = resolveResponseStyle(config);
  const throwOnError = resolveThrowOnError(config);

  const { cleanConfig, headers, retry, timeoutMs } =
    extractAndCleanConfig(config);
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

const createAttioClient = (config: AttioClientConfig = {}): AttioClient => {
  const authToken = validateAuthToken(resolveAuthToken(config));
  return createAttioClientWithAuthToken({ config, authToken });
};

const getAttioClient = (config: AttioClientConfig = {}): AttioClient => {
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

const resolveAttioClient = (input: AttioClientInput = {}): AttioClient =>
  input.client ?? getAttioClient(input.config ?? {});

export type { AttioClient, AttioClientInput, AttioRequestOptions };
export { createAttioClient, getAttioClient, resolveAttioClient };
