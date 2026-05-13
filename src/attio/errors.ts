// biome-ignore-all lint/security/noSecrets: false report
import { z } from "zod";
import { enhanceAttioError } from "./error-enhancer";

interface AttioErrorDetails {
  code?: string;
  type?: string;
  status?: number;
  message?: string;
  data?: unknown;
  errors?: unknown[];
  cause?: unknown;
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
  errors?: unknown[];
  isNetworkError?: boolean;
  isApiError?: boolean;
  suggestions?: unknown;

  constructor(message: string, details: AttioErrorDetails = {}) {
    super(message, details.cause ? { cause: details.cause } : undefined);
    this.name = "AttioError";
    this.status = details.status;
    this.code = details.code;
    this.type = details.type;
    this.data = details.data;
    this.errors = details.errors;
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

const attioErrorPayloadSchema = z
  .object({
    code: z.string().optional(),
    type: z.string().optional(),
    status: z.number().optional(),
    status_code: z.number().optional(),
    message: z.string().optional(),
  })
  .passthrough();

const attioErrorEnvelopeSchema = z
  .object({
    error: z.unknown().optional(),
    errors: z.array(z.unknown()).optional(),
  })
  .passthrough();

const extractNestedErrorPayload = (error: unknown): unknown => {
  const parsed = attioErrorEnvelopeSchema.safeParse(error);
  if (!parsed.success) {
    return error;
  }

  const nestedPayload = parsed.data.error ?? parsed.data.errors?.[0];
  if (nestedPayload === undefined) {
    return error;
  }

  const nestedResult = attioErrorPayloadSchema.safeParse(nestedPayload);
  return nestedResult.success ? nestedResult.data : error;
};

const extractNestedErrors = (error: unknown): unknown[] | undefined => {
  const parsed = attioErrorEnvelopeSchema.safeParse(error);
  if (!parsed.success) {
    return;
  }
  return parsed.data.errors;
};

const extractDetails = (error: unknown): AttioErrorDetails => {
  const payloadSource = extractNestedErrorPayload(error);
  const parsedPayload = attioErrorPayloadSchema.safeParse(payloadSource);
  if (!parsedPayload.success) {
    return {};
  }
  const payload = parsedPayload.data;
  return {
    code: payload.code,
    type: payload.type,
    status: extractStatusCode(payload),
    message: payload.message,
    data: error,
    errors: extractNestedErrors(error),
  };
};

const attioErrorInfoSchema = z
  .object({
    name: z.string().optional(),
    message: z.string().optional(),
    code: z.string().optional(),
    type: z.string().optional(),
    status: z.number().optional(),
    status_code: z.number().optional(),
    isApiError: z.boolean().optional(),
    isNetworkError: z.boolean().optional(),
    retryAfterMs: z.number().optional(),
    response: z
      .object({
        status: z.number().optional(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();

const attioErrorShapeSchema = attioErrorInfoSchema.extend({
  name: z.string(),
  message: z.string(),
});

type AttioErrorInfo = z.infer<typeof attioErrorInfoSchema>;
type AttioErrorShape = z.infer<typeof attioErrorShapeSchema>;

const RETRYABLE_ATTIO_STATUS_CODES = [408, 429, 500, 502, 503, 504];

const parseAttioErrorInfo = (error: unknown): AttioErrorInfo | undefined => {
  const parsed = attioErrorInfoSchema.safeParse(error);
  return parsed.success ? parsed.data : undefined;
};

const getAttioErrorStatus = (error: unknown): number | undefined => {
  if (error instanceof AttioError) {
    return error.response?.status ?? error.status;
  }

  const info = parseAttioErrorInfo(error);
  if (info?.response?.status ?? info?.status ?? info?.status_code) {
    return info?.response?.status ?? info?.status ?? info?.status_code;
  }

  return extractDetails(error).status;
};

const getAttioErrorCode = (error: unknown): string | undefined => {
  if (error instanceof AttioError) {
    return error.code;
  }

  const info = parseAttioErrorInfo(error);
  return info?.code ?? extractDetails(error).code;
};

const getAttioErrorType = (error: unknown): string | undefined => {
  if (error instanceof AttioError) {
    return error.type;
  }

  const info = parseAttioErrorInfo(error);
  return info?.type ?? extractDetails(error).type;
};

const getAttioErrorPayload = (error: unknown): unknown => {
  if (error instanceof AttioError) {
    return error.data;
  }
  return extractNestedErrorPayload(error);
};

const parseAttioErrorShape = (error: unknown): AttioErrorShape | undefined => {
  const parsed = attioErrorShapeSchema.safeParse(error);
  return parsed.success ? parsed.data : undefined;
};

const isAttioError = (error: unknown): error is AttioError => {
  if (error instanceof AttioError) {
    return true;
  }

  const info = parseAttioErrorShape(error);
  if (!info) {
    return false;
  }

  return Boolean(
    (info.name?.startsWith("Attio") && info.name.endsWith("Error")) ||
      info.isApiError ||
      info.isNetworkError,
  );
};

const isAttioAuthError = (error: unknown): boolean => {
  const status = getAttioErrorStatus(error);
  const type = getAttioErrorType(error);
  const code = getAttioErrorCode(error);
  return status === 401 || type === "auth_error" || code === "unauthorized";
};

const isAttioPermissionError = (error: unknown): boolean => {
  const status = getAttioErrorStatus(error);
  const code = getAttioErrorCode(error);
  return (
    status === 403 ||
    code === "forbidden" ||
    code === "permission_denied" ||
    code === "system_edit_unauthorized"
  );
};

const isAttioNotFound = (error: unknown): boolean =>
  getAttioErrorStatus(error) === 404 ||
  getAttioErrorCode(error) === "not_found";

const isAttioRateLimitError = (error: unknown): boolean => {
  const code = getAttioErrorCode(error);
  return (
    getAttioErrorStatus(error) === 429 ||
    code === "rate_limited" ||
    code === "rate_limit_exceeded"
  );
};

const isAttioValidationError = (error: unknown): boolean => {
  const status = getAttioErrorStatus(error);
  const type = getAttioErrorType(error);
  const code = getAttioErrorCode(error);
  return (
    status === 422 ||
    type === "validation_error" ||
    code === "validation_type" ||
    code === "invalid_request"
  );
};

const isRetryableAttioError = (error: unknown): boolean => {
  const info = parseAttioErrorInfo(error);
  if (info?.isNetworkError) {
    return true;
  }
  const status = getAttioErrorStatus(error);
  return status !== undefined && RETRYABLE_ATTIO_STATUS_CODES.includes(status);
};

const normalizeAttioError = (
  error: unknown,
  context: AttioErrorContext = {},
): AttioError => {
  const { response, request } = context;
  const details = extractDetails(error);
  const status = response?.status ?? details.status;
  const message =
    details.message ?? extractMessage(error, response?.statusText);
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

export type { AttioErrorContext, AttioErrorDetails };
export {
  AttioApiError,
  AttioBatchError,
  AttioConfigError,
  AttioEnvironmentError,
  AttioError,
  AttioNetworkError,
  AttioResponseError,
  AttioRetryError,
  getAttioErrorCode,
  getAttioErrorPayload,
  getAttioErrorStatus,
  getAttioErrorType,
  isAttioAuthError,
  isAttioError,
  isAttioNotFound,
  isAttioPermissionError,
  isAttioRateLimitError,
  isAttioValidationError,
  isRetryableAttioError,
  normalizeAttioError,
};
