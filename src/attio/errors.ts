// biome-ignore-all lint/security/noSecrets: false report
import { enhanceAttioError } from "./error-enhancer";

interface AttioErrorDetails {
  code?: string;
  type?: string;
  status?: number;
  message?: string;
  data?: unknown;
}

interface AttioErrorContext {
  response?: Response;
  request?: Request;
  options?: unknown;
}

class AttioError extends Error {
  status?: number;
  code?: string;
  type?: string;
  requestId?: string;
  data?: unknown;
  response?: Response;
  request?: Request;
  retryAfterMs?: number;
  isNetworkError?: boolean;
  isApiError?: boolean;
  suggestions?: unknown;

  constructor(message: string, details: AttioErrorDetails = {}) {
    super(message);
    this.name = "AttioError";
    this.status = details.status;
    this.code = details.code;
    this.type = details.type;
    this.data = details.data;
  }
}

const applyDefaultCode = (
  details: AttioErrorDetails,
  code: string,
): AttioErrorDetails => ({
  ...details,
  code: details.code ?? code,
});

class AttioBatchError extends AttioError {
  constructor(message: string, details: AttioErrorDetails = {}) {
    super(message, applyDefaultCode(details, "BATCH_ERROR"));
    this.name = "AttioBatchError";
  }
}

class AttioConfigError extends AttioError {
  constructor(message: string, details: AttioErrorDetails = {}) {
    super(message, applyDefaultCode(details, "CONFIG_ERROR"));
    this.name = "AttioConfigError";
  }
}

class AttioEnvironmentError extends AttioError {
  constructor(message: string, details: AttioErrorDetails = {}) {
    super(message, applyDefaultCode(details, "ENVIRONMENT_ERROR"));
    this.name = "AttioEnvironmentError";
  }
}

class AttioResponseError extends AttioError {
  constructor(message: string, details: AttioErrorDetails = {}) {
    super(message, applyDefaultCode(details, "RESPONSE_ERROR"));
    this.name = "AttioResponseError";
  }
}

class AttioRetryError extends AttioError {
  constructor(message: string, details: AttioErrorDetails = {}) {
    super(message, applyDefaultCode(details, "RETRY_ERROR"));
    this.name = "AttioRetryError";
  }
}

class AttioApiError extends AttioError {
  constructor(message: string, details: AttioErrorDetails = {}) {
    super(message, details);
    this.name = "AttioApiError";
    this.isApiError = true;
  }
}

class AttioNetworkError extends AttioError {
  constructor(message: string, details: AttioErrorDetails = {}) {
    super(message, details);
    this.name = "AttioNetworkError";
    this.isNetworkError = true;
  }
}

const getHeaderValue = (
  response: Response | undefined,
  key: string,
): string | undefined => {
  if (!response) {
    return;
  }
  const value = response.headers.get(key);
  return value ?? undefined;
};

const parseRetryAfter = (response?: Response): number | undefined => {
  if (!response) {
    return;
  }
  const raw = response.headers.get("Retry-After");
  if (!raw) {
    return;
  }
  const seconds = Number(raw);
  if (Number.isFinite(seconds)) {
    return Math.max(0, seconds * 1000);
  }
  const dateMs = Date.parse(raw);
  if (!Number.isNaN(dateMs)) {
    return Math.max(0, dateMs - Date.now());
  }
  return;
};

const extractMessage = (error: unknown, fallback?: string): string => {
  if (typeof error === "string") {
    return error;
  }
  if (error && typeof error === "object") {
    const maybe = error as { message?: unknown };
    if (typeof maybe.message === "string") {
      return maybe.message;
    }
  }
  return fallback ?? "Request failed.";
};

const extractStatusCode = (
  payload: Record<string, unknown>,
): number | undefined => {
  if (typeof payload.status_code === "number") {
    return payload.status_code;
  }
  if (typeof payload.status === "number") {
    return payload.status;
  }
  return;
};

const extractDetails = (error: unknown): AttioErrorDetails => {
  if (!error || typeof error !== "object") {
    return {};
  }
  const payload = error as Record<string, unknown>;
  return {
    code: typeof payload.code === "string" ? payload.code : undefined,
    type: typeof payload.type === "string" ? payload.type : undefined,
    status: extractStatusCode(payload),
    message: typeof payload.message === "string" ? payload.message : undefined,
    data: payload,
  };
};

const normalizeAttioError = (
  error: unknown,
  context: AttioErrorContext = {},
): AttioError => {
  const { response, request } = context;
  const details = extractDetails(error);
  const status = response?.status ?? details.status;
  const message = extractMessage(
    error,
    response?.statusText ?? details.message,
  );
  const requestId =
    getHeaderValue(response, "x-request-id") ??
    getHeaderValue(response, "x-attio-request-id");

  if (response) {
    const apiError = new AttioApiError(message, {
      ...details,
      status,
    });
    apiError.requestId = requestId;
    apiError.response = response;
    apiError.request = request;
    apiError.data = details.data ?? error;
    apiError.retryAfterMs = parseRetryAfter(response);
    return enhanceAttioError(apiError);
  }

  const networkError = new AttioNetworkError(message, details);
  networkError.request = request;
  return networkError;
};

export type { AttioErrorDetails, AttioErrorContext };
export {
  AttioError,
  AttioApiError,
  AttioBatchError,
  AttioConfigError,
  AttioEnvironmentError,
  AttioNetworkError,
  AttioResponseError,
  AttioRetryError,
  normalizeAttioError,
};
