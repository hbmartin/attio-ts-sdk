import { z } from "zod";
import {
  type Client,
  createClient,
  mergeHeaders,
  type RequestOptions,
  type ResponseStyle,
} from "../generated/client";
import {
  type AttioCacheManager,
  createAttioCacheManager,
  getCachedClient,
  hashToken,
  setCachedClient,
} from "./cache";
import {
  type AttioClientConfig,
  resolveAuthToken,
  resolveBaseUrl,
  resolveResponseStyle,
  resolveThrowOnError,
} from "./config";
import { AttioEnvironmentError, normalizeAttioError } from "./errors";
import type { AttioClientHooks, AttioLogger } from "./hooks";
import { callWithRetry, type RetryConfig } from "./retry";

interface AttioClient extends Client {
  cache: AttioCacheManager;
}

interface AttioClientInput {
  client?: AttioClient;
  config?: AttioClientConfig;
}

interface AttioRequestOptions<
  TData = unknown,
  TResponseStyle extends ResponseStyle = "fields",
  ThrowOnError extends boolean = boolean,
  Url extends string = string,
> extends RequestOptions<TData, TResponseStyle, ThrowOnError, Url> {}

interface CreateAttioClientParams {
  config?: AttioClientConfig;
  authToken?: string;
}

const interceptorUseSchema = z
  .object({
    use: z.function(),
  })
  .passthrough();

const attioClientShapeSchema = z
  .object({
    request: z.function(),
    cache: z
      .object({
        metadata: z
          .object({
            get: z.function(),
            clear: z.function(),
          })
          .passthrough(),
        clear: z.function(),
      })
      .passthrough(),
    interceptors: z
      .object({
        error: interceptorUseSchema,
        request: interceptorUseSchema,
        response: interceptorUseSchema,
      })
      .passthrough(),
  })
  .passthrough();

const AttioClientSchema: z.ZodType<AttioClient> = z
  .any()
  .refine((value) => attioClientShapeSchema.safeParse(value).success, {
    message: "Invalid cached Attio client.",
  });

interface CombineSignalsParams {
  requestSignal: AbortSignal;
  timeoutSignal: AbortSignal;
}

const combineSignalsWithAny = ({
  requestSignal,
  timeoutSignal,
}: CombineSignalsParams): AbortSignal =>
  AbortSignal.any([requestSignal, timeoutSignal]);

interface SignalCombinationResult {
  combinedSignal: AbortSignal;
  abortCombined?: () => void;
}

// Fallback for environments without AbortSignal.any (pre-Node 20, older browsers).
// Creates a proxy controller that aborts when either source signal fires.
const combineSignalsWithFallback = ({
  requestSignal,
  timeoutSignal,
}: CombineSignalsParams): SignalCombinationResult => {
  const combinedController = new AbortController();

  if (requestSignal.aborted) {
    combinedController.abort();
    return { combinedSignal: combinedController.signal };
  }

  const abortCombined = () => combinedController.abort();
  requestSignal.addEventListener("abort", abortCombined, { once: true });
  timeoutSignal.addEventListener("abort", abortCombined, { once: true });

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
      const signals = {
        requestSignal: init.signal,
        timeoutSignal: controller.signal,
      };
      const supportsSignalAny =
        typeof AbortSignal !== "undefined" && "any" in AbortSignal;
      if (supportsSignalAny) {
        combinedSignal = combineSignalsWithAny(signals);
      } else {
        ({ combinedSignal, abortCombined } =
          combineSignalsWithFallback(signals));
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
  authToken?: string;
}

interface MetadataCacheKeyParams {
  config: AttioClientConfig;
  authToken?: string;
  baseUrl: string;
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

const buildMetadataCacheKey = ({
  config,
  authToken,
  baseUrl,
}: MetadataCacheKeyParams): string =>
  `${config.cache?.key ?? "attio"}:${hashToken(authToken)}:${baseUrl}`;

const composeHook = <T>(
  first?: (payload: T) => void,
  second?: (payload: T) => void,
): ((payload: T) => void) | undefined => {
  if (!first) {
    return second;
  }
  if (!second) {
    return first;
  }
  return (payload) => {
    first(payload);
    second(payload);
  };
};

const createLoggerHooks = (logger?: AttioLogger): AttioClientHooks => {
  if (!logger) {
    return {};
  }

  const { debug, error: logError } = logger;

  return {
    onRequest: debug
      ? ({ request }) =>
          debug("attio.request", {
            method: request.method,
            url: request.url,
          })
      : undefined,
    onResponse: debug
      ? ({ response, request }) =>
          debug("attio.response", {
            method: request.method,
            url: request.url,
            status: response.status,
          })
      : undefined,
    onError: logError
      ? ({ error, request, response }) =>
          logError("attio.error", {
            message: error.message,
            code: error.code,
            status: error.status,
            requestId: error.requestId,
            url: request?.url,
            responseStatus: response?.status,
          })
      : undefined,
  };
};

const resolveClientHooks = (config?: AttioClientConfig): AttioClientHooks => {
  const loggerHooks = createLoggerHooks(config?.logger);
  const customHooks = config?.hooks ?? {};

  return {
    onRequest: composeHook(loggerHooks.onRequest, customHooks.onRequest),
    onResponse: composeHook(loggerHooks.onResponse, customHooks.onResponse),
    onError: composeHook(loggerHooks.onError, customHooks.onError),
  };
};

const applyInterceptors = (client: Client, hooks: AttioClientHooks): void => {
  if (hooks.onRequest) {
    client.interceptors.request.use((request, options) => {
      hooks.onRequest?.({ request, options });
      return request;
    });
  }

  if (hooks.onResponse) {
    client.interceptors.response.use((response, request, options) => {
      hooks.onResponse?.({ response, request, options });
      return response;
    });
  }

  client.interceptors.error.use((error, response, request, options) => {
    const normalized = normalizeAttioError(error, {
      response,
      request,
      options,
    });
    hooks.onError?.({ error: normalized, response, request, options });
    return normalized;
  });
};

type HttpMethod = NonNullable<RequestOptions["method"]>;
type RequestWithMethodOptions<
  TData,
  TResponseStyle extends ResponseStyle,
  ThrowOnError extends boolean,
> = Omit<RequestOptions<TData, TResponseStyle, ThrowOnError>, "method"> &
  Pick<Required<RequestOptions<TData, TResponseStyle, ThrowOnError>>, "method">;

const wrapClient = (base: Client, retry?: Partial<RetryConfig>): Client => {
  const requestWithRetry: Client["request"] = <
    TData = unknown,
    TError = unknown,
    ThrowOnError extends boolean = false,
    TResponseStyle extends ResponseStyle = "fields",
  >(
    options: RequestWithMethodOptions<TData, TResponseStyle, ThrowOnError>,
  ) => {
    const { retry: retryOverride, ...rest } = options;
    return callWithRetry(
      () => base.request<TData, TError, ThrowOnError, TResponseStyle>(rest),
      {
        ...retry,
        ...retryOverride,
      },
    );
  };

  const makeMethod =
    (method: HttpMethod): Client["get"] =>
    (options) =>
      requestWithRetry({
        ...options,
        method,
      });

  const client: Client = {
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
  };

  return client;
};

type CleanClientConfig = Omit<
  AttioClientConfig,
  | "apiKey"
  | "accessToken"
  | "authToken"
  | "cache"
  | "retry"
  | "timeoutMs"
  | "headers"
>;

interface CleanedConfigResult {
  cleanConfig: CleanClientConfig;
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
  const hooks = resolveClientHooks(config);

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

  applyInterceptors(base, hooks);

  const wrapped = wrapClient(base, retry);
  const metadataCacheKey = buildMetadataCacheKey({
    config,
    authToken,
    baseUrl,
  });
  const cache = createAttioCacheManager(metadataCacheKey, config.cache);

  const client: AttioClient = Object.assign(wrapped, { cache });
  return client;
};

const createAttioClient = (config: AttioClientConfig = {}): AttioClient => {
  const authToken = resolveAuthToken(config);
  return createAttioClientWithAuthToken({ config, authToken });
};

const getAttioClient = (config: AttioClientConfig = {}): AttioClient => {
  const cacheEnabled = config.cache?.enabled ?? true;
  const authToken = resolveAuthToken(config);
  const cacheKey = authToken
    ? buildClientCacheKey({ config, authToken })
    : undefined;

  if (cacheEnabled && cacheKey) {
    const cached = getCachedClient<AttioClient>(cacheKey, AttioClientSchema);
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
