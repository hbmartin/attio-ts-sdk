import type {
  AttioClientHooks,
  AttioLogger,
  LogContext,
  LogValue,
} from "./hooks";

const DEFAULT_REDACTION_TEXT = "[REDACTED]";
const URL_PARSE_BASE = "https://attio.local";
const ABSOLUTE_URL_REGEX = /^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//;
const NON_ALPHANUMERIC_SEQUENCE_REGEX = /[^a-z0-9]+/;
const NON_ALPHANUMERIC_GLOBAL_REGEX = /[^a-z0-9]/g;

const DEFAULT_SENSITIVE_KEY_PATTERNS = [
  "authorization",
  "api_key",
  "api-key",
  "apikey",
  "token",
  "secret",
  "password",
  "cookie",
  "set-cookie",
] as const;

const DEFAULT_CORRELATION_ID_HEADER = "x-attio-correlation-id";
const DEFAULT_CORRELATION_ID_CONTEXT_KEY = "correlationId";

interface AttioLogRedactionConfig {
  enabled?: boolean;
  replaceWith?: string;
  sensitiveKeyPatterns?: readonly string[];
}

interface AttioCorrelationIdConfig {
  enabled?: boolean;
  headerName?: string;
  contextKey?: string;
  create?: () => string;
}

interface AttioLoggingConfig {
  redaction?: AttioLogRedactionConfig;
  correlationId?: AttioCorrelationIdConfig;
}

interface CorrelationIdManager {
  contextKey: string;
  headerName: string;
  isEnabled: boolean;
  enrichRequest: (request: Request) => Request;
  readFromRequest: (request?: Request) => string | undefined;
}

interface StructuredLoggerHooksInput {
  logger?: AttioLogger;
  correlationIds: CorrelationIdManager;
  config?: AttioLoggingConfig;
}

interface RedactionRuntimeConfig {
  enabled: boolean;
  replaceWith: string;
  sensitiveKeyPatterns: readonly string[];
}

const normalizeHeaderName = (headerName: string): string =>
  headerName.trim().toLowerCase();

const createDefaultCorrelationId = (): string => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 10)}`;
};

const resolveRedactionConfig = (
  config?: AttioLoggingConfig,
): RedactionRuntimeConfig => ({
  enabled: config?.redaction?.enabled ?? true,
  replaceWith: config?.redaction?.replaceWith ?? DEFAULT_REDACTION_TEXT,
  sensitiveKeyPatterns:
    config?.redaction?.sensitiveKeyPatterns ?? DEFAULT_SENSITIVE_KEY_PATTERNS,
});

const collapseAlphaNumeric = (value: string): string =>
  value.replace(NON_ALPHANUMERIC_GLOBAL_REGEX, "");

const keyContainsSensitivePattern = (
  key: string,
  config: RedactionRuntimeConfig,
): boolean => {
  const normalizedKey = key.toLowerCase();
  const normalizedSegments = normalizedKey
    .split(NON_ALPHANUMERIC_SEQUENCE_REGEX)
    .filter(Boolean);
  const collapsedKey = collapseAlphaNumeric(normalizedKey);

  return config.sensitiveKeyPatterns.some((pattern) => {
    const normalizedPattern = pattern.toLowerCase();
    if (normalizedKey === normalizedPattern) {
      return true;
    }

    if (normalizedSegments.includes(normalizedPattern)) {
      return true;
    }

    const collapsedPattern = collapseAlphaNumeric(normalizedPattern);
    if (!collapsedPattern) {
      return false;
    }

    return collapsedKey.endsWith(collapsedPattern);
  });
};

const redactUrl = (
  urlValue: string,
  config: RedactionRuntimeConfig,
): string => {
  const canParseAsAbsolute = ABSOLUTE_URL_REGEX.test(urlValue);

  let parsed: URL;
  try {
    parsed = canParseAsAbsolute
      ? new URL(urlValue)
      : new URL(urlValue, URL_PARSE_BASE);
  } catch {
    return urlValue;
  }

  const params = new URLSearchParams(parsed.search);
  for (const [key] of params.entries()) {
    if (keyContainsSensitivePattern(key, config)) {
      params.set(key, config.replaceWith);
    }
  }
  parsed.search = params.toString();

  if (canParseAsAbsolute) {
    return parsed.toString();
  }

  return `${parsed.pathname}${parsed.search}${parsed.hash}`;
};

const headersToObject = (headers: Headers): Record<string, string> =>
  Object.fromEntries(headers.entries());

const isRecord = (v: unknown): v is Record<string, LogValue> =>
  v !== null && typeof v === "object" && !Array.isArray(v);

const redactValue = (
  value: LogValue,
  config: RedactionRuntimeConfig,
  key?: string,
): LogValue => {
  if (!config.enabled) {
    return value;
  }

  if (key && keyContainsSensitivePattern(key, config)) {
    return config.replaceWith;
  }

  if (typeof value === "string" && key?.toLowerCase() === "url") {
    return redactUrl(value, config);
  }

  if (Array.isArray(value)) {
    return value.map((entry) => redactValue(entry, config));
  }

  if (isRecord(value)) {
    const redacted: Record<string, LogValue> = {};
    for (const [entryKey, entryValue] of Object.entries(value)) {
      redacted[entryKey] = redactValue(entryValue, config, entryKey);
    }
    return redacted;
  }

  return value;
};

const redactLogContext = (
  context: LogContext,
  config?: AttioLoggingConfig,
): LogContext => {
  const redactionConfig = resolveRedactionConfig(config);
  return redactValue(context, redactionConfig) as LogContext;
};

const addCorrelationToContext = (
  context: LogContext,
  correlationIds: CorrelationIdManager,
  correlationId: string | undefined,
): LogContext => {
  if (!(correlationId && correlationIds.isEnabled)) {
    return context;
  }
  return {
    ...context,
    [correlationIds.contextKey]: correlationId,
  };
};

const createCorrelationIdManager = (
  config?: AttioLoggingConfig,
): CorrelationIdManager => {
  const enabled = config?.correlationId?.enabled ?? true;
  const headerName = normalizeHeaderName(
    config?.correlationId?.headerName ?? DEFAULT_CORRELATION_ID_HEADER,
  );
  const contextKey =
    config?.correlationId?.contextKey ?? DEFAULT_CORRELATION_ID_CONTEXT_KEY;
  const createCorrelationId =
    config?.correlationId?.create ?? createDefaultCorrelationId;
  const idByRequest = new WeakMap<Request, string>();

  if (!enabled) {
    return {
      contextKey,
      headerName,
      isEnabled: false,
      enrichRequest: (request) => request,
      readFromRequest: () => undefined,
    };
  }

  const readFromRequest = (request?: Request): string | undefined => {
    if (!request) {
      return;
    }
    const existingFromMap = idByRequest.get(request);
    if (existingFromMap) {
      return existingFromMap;
    }
    const existingFromHeader = request.headers.get(headerName) ?? undefined;
    if (existingFromHeader) {
      idByRequest.set(request, existingFromHeader);
      return existingFromHeader;
    }
    return;
  };

  const enrichRequest = (request: Request): Request => {
    const existing = readFromRequest(request);
    if (existing) {
      return request;
    }

    const correlationId = createCorrelationId();
    const nextHeaders = new Headers(request.headers);
    nextHeaders.set(headerName, correlationId);
    const enrichedRequest = new Request(request, { headers: nextHeaders });
    idByRequest.set(request, correlationId);
    idByRequest.set(enrichedRequest, correlationId);
    return enrichedRequest;
  };

  return {
    contextKey,
    headerName,
    isEnabled: true,
    enrichRequest,
    readFromRequest,
  };
};

const createStructuredLoggerHooks = ({
  logger,
  correlationIds,
  config,
}: StructuredLoggerHooksInput): AttioClientHooks => {
  if (!logger) {
    return {};
  }

  return {
    onRequest: logger.debug
      ? ({ request, correlationId }) => {
          const context = addCorrelationToContext(
            {
              method: request.method,
              url: request.url,
              headers: headersToObject(request.headers),
            },
            correlationIds,
            correlationId ?? correlationIds.readFromRequest(request),
          );
          logger.debug?.("attio.request", redactLogContext(context, config));
        }
      : undefined,
    onResponse: logger.debug
      ? ({ request, response, correlationId }) => {
          const context = addCorrelationToContext(
            {
              method: request.method,
              url: request.url,
              status: response.status,
              ok: response.ok,
            },
            correlationIds,
            correlationId ?? correlationIds.readFromRequest(request),
          );
          logger.debug?.("attio.response", redactLogContext(context, config));
        }
      : undefined,
    onError: logger.error
      ? ({ error, request, response, correlationId }) => {
          const context = addCorrelationToContext(
            {
              message: error.message,
              code: error.code,
              status: error.status,
              requestId: error.requestId,
              url: request?.url,
              responseStatus: response?.status,
            },
            correlationIds,
            correlationId ?? correlationIds.readFromRequest(request),
          );
          logger.error?.("attio.error", redactLogContext(context, config));
        }
      : undefined,
  };
};

export {
  DEFAULT_CORRELATION_ID_CONTEXT_KEY,
  DEFAULT_CORRELATION_ID_HEADER,
  createCorrelationIdManager,
  createStructuredLoggerHooks,
  redactLogContext,
};
export type {
  AttioCorrelationIdConfig,
  AttioLogRedactionConfig,
  AttioLoggingConfig,
  CorrelationIdManager,
  StructuredLoggerHooksInput,
};
