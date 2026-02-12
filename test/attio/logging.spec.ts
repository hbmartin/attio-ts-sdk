import { describe, expect, it, vi } from "vitest";
import type { AttioLogger } from "../../src/attio/hooks";
import {
  createCorrelationIdManager,
  createStructuredLoggerHooks,
  redactLogContext,
} from "../../src/attio/logging";

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
  });

  describe("createStructuredLoggerHooks", () => {
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
  });
});
