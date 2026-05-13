import { describe, expect, it, vi } from "vitest";
import { AttioResponseError } from "../../src/attio/errors";
import type { AttioLogger } from "../../src/attio/hooks";
import {
  createCorrelationIdManager,
  createStructuredLoggerHooks,
  redactLogContext,
} from "../../src/attio/logging";
import { withGlobalProperties } from "../test-utils";

describe("logging", () => {
  describe("redactLogContext", () => {
    it("redacts sensitive keys recursively", () => {
      const redacted = redactLogContext({
        authorization: "Bearer secret-token",
        nested: {
          api_key: "abc123",
          safe: "value",
        },
        tokens: [{ refresh_token: "refresh" }],
      });

      expect(redacted).toEqual({
        authorization: "[REDACTED]",
        nested: {
          api_key: "[REDACTED]",
          safe: "value",
        },
        tokens: [{ refresh_token: "[REDACTED]" }],
      });
    });

    it("redacts sensitive URL query params", () => {
      const redacted = redactLogContext({
        url: "https://api.attio.com/v2/records?token=abc123&status=active",
      });

      expect(redacted).toEqual({
        url: "https://api.attio.com/v2/records?token=%5BREDACTED%5D&status=active",
      });
    });

    it("redacts sensitive params from relative URLs", () => {
      const redacted = redactLogContext({
        url: "/v2/records?api_key=abc123&status=active#section",
      });

      expect(redacted).toEqual({
        url: "/v2/records?api_key=%5BREDACTED%5D&status=active#section",
      });
    });

    it("leaves invalid URL strings unchanged", () => {
      const redacted = redactLogContext({
        url: "http://[::1",
      });

      expect(redacted).toEqual({
        url: "http://[::1",
      });
    });

    it("can disable redaction", () => {
      const context = {
        authorization: "Bearer visible",
        url: "https://api.attio.com/v2/records?token=visible",
      };

      expect(
        redactLogContext(context, { redaction: { enabled: false } }),
      ).toEqual(context);
    });

    it("ignores empty sensitive key patterns", () => {
      const redacted = redactLogContext(
        { authorization: "Bearer visible" },
        { redaction: { sensitiveKeyPatterns: [""] } },
      );

      expect(redacted).toEqual({ authorization: "Bearer visible" });
    });
  });

  describe("createCorrelationIdManager", () => {
    it("injects and retrieves correlation IDs from request headers", () => {
      const manager = createCorrelationIdManager({
        correlationId: {
          headerName: "x-correlation-id",
          create: () => "corr-123",
        },
      });

      const request = new Request("https://api.attio.com/v2/objects");
      const enrichedRequest = manager.enrichRequest(request);

      expect(enrichedRequest.headers.get("x-correlation-id")).toBe("corr-123");
      expect(manager.readFromRequest(enrichedRequest)).toBe("corr-123");
    });

    it("is a no-op when correlation IDs are disabled", () => {
      const manager = createCorrelationIdManager({
        correlationId: { enabled: false },
      });
      const request = new Request("https://api.attio.com/v2/objects");

      const enrichedRequest = manager.enrichRequest(request);

      expect(enrichedRequest).toBe(request);
      expect(manager.readFromRequest(enrichedRequest)).toBeUndefined();
    });

    it("returns undefined when reading without a request", () => {
      const manager = createCorrelationIdManager();

      expect(manager.readFromRequest()).toBeUndefined();
    });

    it("reads existing headers and does not clone already correlated requests", () => {
      const manager = createCorrelationIdManager({
        correlationId: { headerName: " X-Correlation-ID " },
      });
      const request = new Request("https://api.attio.com/v2/objects", {
        headers: { "x-correlation-id": "existing-corr-id" },
      });

      expect(manager.readFromRequest(request)).toBe("existing-corr-id");
      expect(manager.enrichRequest(request)).toBe(request);
    });

    it("falls back to timestamp correlation IDs when randomUUID is unavailable", () => {
      const nowSpy = vi.spyOn(Date, "now").mockReturnValue(36);
      const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0.5);

      try {
        const correlationId = withGlobalProperties({ crypto: {} }, () => {
          const manager = createCorrelationIdManager();
          const request = manager.enrichRequest(
            new Request("https://api.attio.com/v2/objects"),
          );
          return request.headers.get("x-attio-correlation-id");
        });

        expect(correlationId).toBe("10-i");
      } finally {
        nowSpy.mockRestore();
        randomSpy.mockRestore();
      }
    });
  });

  describe("createStructuredLoggerHooks", () => {
    it("returns no hooks when no logger is provided", () => {
      const hooks = createStructuredLoggerHooks({
        correlationIds: createCorrelationIdManager(),
      });

      expect(hooks).toEqual({});
    });

    it("logs redacted structured context with correlation ID", () => {
      const debug = vi.fn();
      const logger: AttioLogger = { debug };
      const correlationIds = createCorrelationIdManager({
        correlationId: {
          headerName: "x-correlation-id",
          contextKey: "traceId",
          create: () => "trace-123",
        },
      });
      const hooks = createStructuredLoggerHooks({
        logger,
        correlationIds,
      });

      const request = correlationIds.enrichRequest(
        new Request("https://api.attio.com/v2/objects?token=top-secret", {
          method: "GET",
          headers: {
            Authorization: "Bearer top-secret",
          },
        }),
      );

      hooks.onRequest?.({
        request,
        options: { url: "/v2/objects" },
        correlationId: correlationIds.readFromRequest(request),
      });

      expect(debug).toHaveBeenCalledTimes(1);
      expect(debug).toHaveBeenCalledWith(
        "attio.request",
        expect.objectContaining({
          method: "GET",
          traceId: "trace-123",
          url: expect.stringContaining("token=%5BREDACTED%5D"),
          headers: expect.objectContaining({
            authorization: "[REDACTED]",
          }),
        }),
      );
    });

    it("logs response context with correlation ID read from the request", () => {
      const debug = vi.fn();
      const logger: AttioLogger = { debug };
      const correlationIds = createCorrelationIdManager({
        correlationId: {
          create: () => "response-corr-id",
        },
      });
      const hooks = createStructuredLoggerHooks({
        logger,
        correlationIds,
      });
      const request = correlationIds.enrichRequest(
        new Request("https://api.attio.com/v2/objects", { method: "POST" }),
      );
      const response = new Response(null, { status: 201 });

      hooks.onResponse?.({
        request,
        response,
        options: { url: "/v2/objects" },
      });

      expect(debug).toHaveBeenCalledWith(
        "attio.response",
        expect.objectContaining({
          correlationId: "response-corr-id",
          method: "POST",
          ok: true,
          status: 201,
          url: "https://api.attio.com/v2/objects",
        }),
      );
    });

    it("does not add correlation context when correlation IDs are disabled", () => {
      const debug = vi.fn();
      const logger: AttioLogger = { debug };
      const correlationIds = createCorrelationIdManager({
        correlationId: { enabled: false },
      });
      const hooks = createStructuredLoggerHooks({
        logger,
        correlationIds,
      });

      hooks.onResponse?.({
        request: new Request("https://api.attio.com/v2/objects"),
        response: new Response(null, { status: 200 }),
        options: { url: "/v2/objects" },
      });

      expect(debug).toHaveBeenCalledWith(
        "attio.response",
        expect.not.objectContaining({
          correlationId: expect.any(String),
        }),
      );
    });

    it("logs error context with request and response details", () => {
      const errorLog = vi.fn();
      const logger: AttioLogger = { error: errorLog };
      const correlationIds = createCorrelationIdManager({
        correlationId: {
          contextKey: "traceId",
          create: () => "error-trace-id",
        },
      });
      const hooks = createStructuredLoggerHooks({
        logger,
        correlationIds,
      });
      const request = correlationIds.enrichRequest(
        new Request("https://api.attio.com/v2/records?token=hidden"),
      );
      const response = new Response(null, { status: 429 });
      const error = new AttioResponseError("Rate limited", {
        code: "RATE_LIMITED",
        status: 429,
      });
      error.requestId = "req-123";

      hooks.onError?.({
        error,
        request,
        response,
        options: { url: "/v2/records" },
      });

      expect(errorLog).toHaveBeenCalledWith(
        "attio.error",
        expect.objectContaining({
          code: "RATE_LIMITED",
          message: "Rate limited",
          requestId: "req-123",
          responseStatus: 429,
          status: 429,
          traceId: "error-trace-id",
          url: "https://api.attio.com/v2/records?token=%5BREDACTED%5D",
        }),
      );
    });
  });
});
