import { describe, expect, it, vi } from "vitest";

import {
  AttioApiError,
  AttioBatchError,
  AttioConfigError,
  AttioEnvironmentError,
  AttioError,
  AttioNetworkError,
  AttioResponseError,
  AttioRetryError,
  normalizeAttioError,
} from "../../src/attio/errors";

vi.mock("../../src/attio/error-enhancer", () => ({
  enhanceAttioError: vi.fn((error) => error),
}));

describe("AttioError", () => {
  it("creates an error with message", () => {
    const error = new AttioError("Something went wrong");
    expect(error.message).toBe("Something went wrong");
    expect(error.name).toBe("AttioError");
  });

  it("accepts details", () => {
    const error = new AttioError("Error", {
      code: "INVALID_REQUEST",
      type: "validation_error",
      status: 400,
      data: { field: "email" },
    });

    expect(error.code).toBe("INVALID_REQUEST");
    expect(error.type).toBe("validation_error");
    expect(error.status).toBe(400);
    expect(error.data).toEqual({ field: "email" });
  });

  it("extends Error", () => {
    const error = new AttioError("Test");
    expect(error).toBeInstanceOf(Error);
  });
});

describe("AttioApiError", () => {
  it("creates an API error with isApiError flag", () => {
    const error = new AttioApiError("API error");
    expect(error.message).toBe("API error");
    expect(error.name).toBe("AttioApiError");
    expect(error.isApiError).toBe(true);
  });

  it("extends AttioError", () => {
    const error = new AttioApiError("Test");
    expect(error).toBeInstanceOf(AttioError);
  });
});

describe("AttioNetworkError", () => {
  it("creates a network error with isNetworkError flag", () => {
    const error = new AttioNetworkError("Network error");
    expect(error.message).toBe("Network error");
    expect(error.name).toBe("AttioNetworkError");
    expect(error.isNetworkError).toBe(true);
  });

  it("extends AttioError", () => {
    const error = new AttioNetworkError("Test");
    expect(error).toBeInstanceOf(AttioError);
  });
});

describe("normalizeAttioError", () => {
  it("creates AttioApiError when response is provided", () => {
    const response = new Response(null, { status: 404 });
    const error = normalizeAttioError({ message: "Not found" }, { response });

    expect(error).toBeInstanceOf(AttioApiError);
    expect(error.message).toBe("Not found");
    expect(error.status).toBe(404);
    expect(error.response).toBe(response);
  });

  it("creates AttioNetworkError when no response provided", () => {
    const error = normalizeAttioError({ message: "Connection failed" });

    expect(error).toBeInstanceOf(AttioNetworkError);
    expect(error.message).toBe("Connection failed");
  });

  it("extracts message from string error", () => {
    const error = normalizeAttioError("Simple string error");
    expect(error.message).toBe("Simple string error");
  });

  it("uses response statusText as fallback message", () => {
    const response = new Response(null, {
      status: 500,
      statusText: "Internal Server Error",
    });
    const error = normalizeAttioError({}, { response });

    expect(error.message).toBe("Internal Server Error");
  });

  it("uses default message when none available", () => {
    const error = normalizeAttioError(null);
    expect(error.message).toBe("Request failed.");
  });

  it("extracts request-id header", () => {
    const response = new Response(null, {
      status: 400,
      headers: { "x-request-id": "req-123" },
    });
    const error = normalizeAttioError({ message: "Bad request" }, { response });

    expect((error as AttioApiError).requestId).toBe("req-123");
  });

  it("extracts x-attio-request-id header", () => {
    const response = new Response(null, {
      status: 400,
      headers: { "x-attio-request-id": "attio-req-456" },
    });
    const error = normalizeAttioError({ message: "Bad request" }, { response });

    expect((error as AttioApiError).requestId).toBe("attio-req-456");
  });

  it("parses Retry-After header as seconds", () => {
    const response = new Response(null, {
      status: 429,
      headers: { "Retry-After": "30" },
    });
    const error = normalizeAttioError(
      { message: "Rate limited" },
      { response },
    );

    expect((error as AttioApiError).retryAfterMs).toBe(30_000);
  });

  it("parses Retry-After header as date", () => {
    const futureDate = new Date(Date.now() + 60_000);
    const response = new Response(null, {
      status: 429,
      headers: { "Retry-After": futureDate.toUTCString() },
    });
    const error = normalizeAttioError(
      { message: "Rate limited" },
      { response },
    );

    expect((error as AttioApiError).retryAfterMs).toBeGreaterThan(0);
    expect((error as AttioApiError).retryAfterMs).toBeLessThanOrEqual(60_000);
  });

  it("handles invalid Retry-After header", () => {
    const response = new Response(null, {
      status: 429,
      headers: { "Retry-After": "invalid" },
    });
    const error = normalizeAttioError(
      { message: "Rate limited" },
      { response },
    );

    expect((error as AttioApiError).retryAfterMs).toBeUndefined();
  });

  it("handles negative Retry-After", () => {
    const response = new Response(null, {
      status: 429,
      headers: { "Retry-After": "-10" },
    });
    const error = normalizeAttioError(
      { message: "Rate limited" },
      { response },
    );

    expect((error as AttioApiError).retryAfterMs).toBe(0);
  });

  it("extracts code and type from error payload", () => {
    const response = new Response(null, { status: 400 });
    const error = normalizeAttioError(
      {
        message: "Validation failed",
        code: "INVALID_FIELD",
        type: "validation_error",
      },
      { response },
    );

    expect(error.code).toBe("INVALID_FIELD");
    expect(error.type).toBe("validation_error");
  });

  it("extracts status_code from payload", () => {
    const error = normalizeAttioError({
      message: "Error",
      status_code: 422,
    });

    expect(error.status).toBe(422);
  });

  it("extracts status from payload when status_code not present", () => {
    const error = normalizeAttioError({
      message: "Error",
      status: 403,
    });

    expect(error.status).toBe(403);
  });

  it("attaches request to error when provided", () => {
    const request = new Request("https://api.attio.com/v2/objects");
    const error = normalizeAttioError({ message: "Error" }, { request });

    expect(error.request).toBe(request);
  });

  it("attaches data to API error", () => {
    const response = new Response(null, { status: 400 });
    const payload = { message: "Error", extra: "data" };
    const error = normalizeAttioError(payload, { response });

    expect((error as AttioApiError).data).toEqual(payload);
  });

  it("handles non-object errors", () => {
    const error = normalizeAttioError(undefined);
    expect(error.message).toBe("Request failed.");
  });

  it("ignores non-string code and type fields", () => {
    const error = normalizeAttioError({ message: "test", code: 42, type: 99 });
    expect(error.code).toBeUndefined();
    expect(error.type).toBeUndefined();
  });

  it("returns undefined for getHeaderValue when header is not present", () => {
    const response = new Response(null, { status: 400 });
    const error = normalizeAttioError({ message: "test" }, { response });
    // No x-request-id or x-attio-request-id headers set
    expect((error as AttioApiError).requestId).toBeUndefined();
  });
});

describe("AttioBatchError", () => {
  it("creates a batch error with default code", () => {
    const error = new AttioBatchError("batch failed");
    expect(error.name).toBe("AttioBatchError");
    expect(error.code).toBe("BATCH_ERROR");
    expect(error.message).toBe("batch failed");
    expect(error).toBeInstanceOf(AttioError);
  });

  it("preserves custom code when provided", () => {
    const error = new AttioBatchError("batch failed", {
      code: "CUSTOM_BATCH",
    });
    expect(error.code).toBe("CUSTOM_BATCH");
  });
});

describe("AttioConfigError", () => {
  it("creates a config error with default code", () => {
    const error = new AttioConfigError("invalid config");
    expect(error.name).toBe("AttioConfigError");
    expect(error.code).toBe("CONFIG_ERROR");
    expect(error.message).toBe("invalid config");
    expect(error).toBeInstanceOf(AttioError);
  });

  it("preserves custom code when provided", () => {
    const error = new AttioConfigError("invalid config", {
      code: "CUSTOM_CONFIG",
    });
    expect(error.code).toBe("CUSTOM_CONFIG");
  });
});

describe("AttioEnvironmentError", () => {
  it("creates an environment error with default code", () => {
    const error = new AttioEnvironmentError("missing env");
    expect(error.name).toBe("AttioEnvironmentError");
    expect(error.code).toBe("ENVIRONMENT_ERROR");
    expect(error).toBeInstanceOf(AttioError);
  });
});

describe("AttioResponseError", () => {
  it("creates a response error with default code", () => {
    const error = new AttioResponseError("bad response");
    expect(error.name).toBe("AttioResponseError");
    expect(error.code).toBe("RESPONSE_ERROR");
    expect(error).toBeInstanceOf(AttioError);
  });
});

describe("AttioRetryError", () => {
  it("creates a retry error with default code", () => {
    const error = new AttioRetryError("retry exhausted");
    expect(error.name).toBe("AttioRetryError");
    expect(error.code).toBe("RETRY_ERROR");
    expect(error).toBeInstanceOf(AttioError);
  });
});

describe("AttioError cause", () => {
  it("passes cause option to Error constructor", () => {
    const cause = new Error("root cause");
    const error = new AttioError("wrapper", { cause });
    expect(error.cause).toBe(cause);
  });

  it("does not set cause when not provided", () => {
    const error = new AttioError("no cause");
    expect(error.cause).toBeUndefined();
  });
});
