# Logging Guide

This SDK now includes structured request logging with built-in redaction and correlation IDs.

## What changed

- `AttioClientConfig` supports a new `logging` section.
- Request interceptors now attach a correlation ID header by default: `x-attio-correlation-id`.
- Hook payloads (`onRequest`, `onResponse`, `onError`) now include `correlationId`.
- Logger-based events (`attio.request`, `attio.response`, `attio.error`) redact sensitive values by default.

## Quick start

```ts
import { createAttioClient } from "attio-ts-sdk";

const client = createAttioClient({
  apiKey: process.env.ATTIO_API_KEY,
  logger: {
    debug: (message, context) => console.debug(message, context),
    error: (message, context) => console.error(message, context),
  },
});
```

You will receive structured events:

- `attio.request`
- `attio.response`
- `attio.error`

Each includes a `correlationId` so request/response/error logs can be joined reliably.

## Redaction controls

```ts
const client = createAttioClient({
  apiKey: process.env.ATTIO_API_KEY,
  logger,
  logging: {
    redaction: {
      enabled: true,
      replaceWith: "[MASKED]",
      sensitiveKeyPatterns: [
        "authorization",
        "token",
        "api_key",
        "secret",
        "password",
      ],
    },
  },
});
```

Redaction applies to nested log context and URL query parameters whose keys match sensitive patterns.

## Correlation ID controls

```ts
const client = createAttioClient({
  apiKey: process.env.ATTIO_API_KEY,
  logger,
  logging: {
    correlationId: {
      enabled: true,
      headerName: "x-correlation-id",
      contextKey: "traceId",
      create: () => crypto.randomUUID(),
    },
  },
});
```

## Hook integration

```ts
const client = createAttioClient({
  apiKey: process.env.ATTIO_API_KEY,
  hooks: {
    onRequest: ({ request, correlationId }) => {
      console.log("request", request.url, correlationId);
    },
    onResponse: ({ response, correlationId }) => {
      console.log("response", response.status, correlationId);
    },
    onError: ({ error, correlationId }) => {
      console.error("error", error.message, correlationId);
    },
  },
});
```

## Recommended downstream pattern

- Send `correlationId` to your centralized logger and tracing backend.
- Keep redaction enabled in all production environments.
- Use a custom `contextKey` only if it aligns to your observability schema.
- If your platform already generates trace IDs, pass them via a custom `create` function.
