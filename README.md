# Attio CRM TypeScript SDK

[![npm version](https://badge.fury.io/js/attio-ts-sdk.svg)](https://www.npmjs.com/package/attio-ts-sdk)
[![ci](https://github.com/hbmartin/attio-ts-sdk/actions/workflows/ci.yml/badge.svg)](https://github.com/hbmartin/attio-ts-sdk/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/hbmartin/attio-ts-sdk/graph/badge.svg?token=Po1nDYEr5f)](https://codecov.io/gh/hbmartin/attio-ts-sdk)
[![NPM License](https://img.shields.io/npm/l/attio-ts-sdk?color=blue)](https://github.com/hbmartin/attio-ts-sdk/blob/main/LICENSE)
[![Context7](https://img.shields.io/badge/[]-Context7-059669)](https://context7.com/hbmartin/attio-ts-sdk)
[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/hbmartin/attio-ts-sdk)

A modern, type-safe TypeScript SDK for the [Attio](https://attio.com) CRM API. Built with Zod v4 and a client layer that adds retries, error normalization, caching, and higher‑level helpers on top of the generated OpenAPI client.

- **Full Attio API Coverage** - People, companies, lists, notes, tasks, meetings, webhooks, and more
- **Create a client in one line** - `createAttioClient({ apiKey })`
- **Retry & rate‑limit aware** - exponential backoff + `Retry-After`
- **Normalized errors** - consistent shape + optional suggestions for select/status mismatches
- **Record normalization** - handles inconsistent response shapes
- **Metadata caching** - attributes, select options, statuses
- **Pagination helpers** - `paginate` + `paginateOffset` + cursor handling
- **Runtime Validation** - Every request and response validated with Zod v4 schemas
- **Tree-Shakeable** - Import only what you need
- **TypeScript First** - Complete type definitions generated from OpenAPI spec

You still have full access to the generated, spec‑accurate endpoints.

### See Also

- [attio-js](https://github.com/d-stoll/attio-js) - an alternative SDK generated with Speakeasy
- [attio-tui](https://github.com/hbmartin/attio-tui) - a TUI for using Attio built with the library

## Table of Contents

- [Installing](#installing)
- [Getting Your API Key](#getting-your-api-key)
- [Usage](#usage)
  - [Quick Start](#quick-start)
  - [Recommended Pattern](#recommended-pattern)
  - [Attio SDK](#attio-sdk)
  - [Attio Convenience Layer](#attio-convenience-layer)
  - [Value Helpers](#value-helpers)
  - [Record Value Accessors](#record-value-accessors)
  - [Schema Helpers](#schema-helpers)
  - [Client Configuration](#client-configuration)
  - [Error Handling](#error-handling)
  - [Pagination Helpers](#pagination-helpers)
  - [Caching](#caching)
  - [Debug Hooks](#debug-hooks)
  - [Metadata Helpers](#metadata-helpers)
  - [Working with Records](#working-with-records)
  - [Using Generated Endpoints Directly](#using-generated-endpoints-directly)
  - [Managing Lists](#managing-lists)
  - [Notes and Tasks](#notes-and-tasks)
  - [Webhooks](#webhooks)
- [Development](#development)

## Installing

```bash
# pnpm (recommended)
pnpm add attio-ts-sdk zod

# npm
npm install attio-ts-sdk zod

# yarn
yarn add attio-ts-sdk zod

# bun
bun add attio-ts-sdk zod
```

> **Note:** Zod v4 is a peer dependency - install it alongside the SDK.

## Getting Your API Key

1. Log in to your [Attio](https://attio.com) workspace.
2. Navigate to **Workspace Settings → Developers** (or visit `https://app.attio.com/settings/developers` directly).
3. Click **Create a new integration**, give it a name, and select the scopes your application needs.
4. Copy the generated API token and store it securely (e.g. in an environment variable).

```bash
export ATTIO_API_KEY="your-api-key-here"
```

The SDK reads the key from whatever you pass to `createAttioClient({ apiKey })` — it does **not** read environment variables automatically, so you control exactly how the secret is loaded.

## Usage

This SDK provides two layers:

1) **Attio helpers** (recommended): `createAttioClient`, `createRecord`, `queryRecords`, etc.
2) **Generated endpoints**: `getV2Objects`, `postV2ObjectsByObjectRecordsQuery`, etc.

### Quick Start

```typescript
import { createAttioClient, getV2Objects, postV2ObjectsByObjectRecordsQuery } from 'attio-ts-sdk';

// Configure the client with your API key
const client = createAttioClient({
  apiKey: process.env.ATTIO_API_KEY,
});

// List all objects in your workspace
const { data: objects } = await getV2Objects({ client });
console.log(objects);

// Query people records
const { data: people } = await postV2ObjectsByObjectRecordsQuery({
  client,
  path: { object: 'people' },
  body: {
    limit: 10,
    sorts: [{ attribute: 'created_at', direction: 'desc' }],
  },
});
```

### Recommended Pattern

Prefer the Attio convenience layer, throw on errors by default, and unwrap responses with helpers.
This keeps request code compact and consistent.

```typescript
import {
  assertOk,
  createAttioClient,
  createAttioSdk,
  getV2Objects,
  value,
} from 'attio-ts-sdk';

const client = createAttioClient({
  apiKey: process.env.ATTIO_API_KEY,
  responseStyle: 'data',
  throwOnError: true,
});

const sdk = createAttioSdk({ client });

const company = await sdk.records.create({
  object: 'companies',
  values: {
    name: value.string('Acme Corp'),
    domains: value.domain('acme.com'),
    annual_revenue: value.currency(50000, 'USD'),
  },
});

// Use assertOk with generated endpoints when you need raw access
const objects = assertOk(await getV2Objects({ client }));
console.log(objects);
```

### Attio SDK

`createAttioSdk` builds on top of the convenience layer and the generated endpoints to provide a single, namespaced object you can pass around your application. It binds the client once so you don't repeat `{ client }` on every call, and groups operations by resource.

```typescript
import { createAttioSdk } from 'attio-ts-sdk';

const sdk = createAttioSdk({ apiKey: process.env.ATTIO_API_KEY });
```

The returned `sdk` object exposes these namespaces:

| Namespace | Methods |
| --- | --- |
| `sdk.objects` | `list`, `get`, `create`, `update` |
| `sdk.records` | `create`, `update`, `upsert`, `get`, `delete`, `query` |
| `sdk.lists` | `list`, `get`, `queryEntries`, `addEntry`, `updateEntry`, `removeEntry` |
| `sdk.metadata` | `listAttributes`, `getAttribute`, `getAttributeOptions`, `getAttributeStatuses`, `schema` |

The underlying `AttioClient` is also available as `sdk.client` when you need to drop down to the generated endpoints.

```typescript
const companies = await sdk.records.query({
  object: 'companies',
  filter: { attribute: 'name', value: 'Acme' },
});

const attributes = await sdk.metadata.listAttributes({
  target: 'objects',
  identifier: 'companies',
});

// Use the generated endpoints when you need full spec access
const { data } = await getV2Objects({ client: sdk.client });
```

### Attio Convenience Layer

The standalone helper functions wrap the generated endpoints with retries, error normalization,
record normalization, and opinionated defaults. They are the same functions that `createAttioSdk` uses under the hood — use them directly when you prefer explicit `{ client }` threading.

```typescript
import { createAttioClient, createRecord, listLists, searchRecords } from 'attio-ts-sdk';

const client = createAttioClient({ apiKey: process.env.ATTIO_API_KEY });

const lists = await listLists({ client });

const company = await createRecord({
  client,
  object: 'companies',
  values: {
    name: [{ value: 'Acme Corp' }],
    domains: [{ domain: 'acme.com' }],
  },
});

const matches = await searchRecords({
  client,
  query: 'acme.com',
  objects: ['companies'],
});
```

### Value Helpers

The `value` namespace provides factory functions that build correctly shaped field-value arrays for record creation and updates. Each helper validates its input with Zod before returning, so typos and bad data fail fast at the call site rather than in the API response.

```typescript
import { value } from 'attio-ts-sdk';
```

| Helper | Signature | Description |
| --- | --- | --- |
| `value.string` | `(value: string) => ValueInput[]` | Non-empty string field. |
| `value.number` | `(value: number) => ValueInput[]` | Finite numeric field. |
| `value.boolean` | `(value: boolean) => ValueInput[]` | Boolean field. |
| `value.domain` | `(value: string) => ValueInput[]` | Domain field (non-empty string). |
| `value.email` | `(value: string) => ValueInput[]` | Email field (validated format). |
| `value.currency` | `(value: number, currencyCode?: string) => ValueInput[]` | Currency field. `currencyCode` is an optional ISO 4217 code (e.g. `"USD"`). |

```typescript
const values = {
  name: value.string('Acme Corp'),
  domains: value.domain('acme.com'),
  contact_email: value.email('hello@acme.com'),
  employee_count: value.number(150),
  is_customer: value.boolean(true),
  annual_revenue: value.currency(50000, 'USD'),
};

await sdk.records.create({ object: 'companies', values });
```

### Record Value Accessors

`getValue` and `getFirstValue` extract attribute values from a record object. Pass an optional Zod schema to get typed, validated results.

```typescript
import { getFirstValue, getValue } from 'attio-ts-sdk';

// Untyped — returns unknown
const name = getFirstValue(company, 'name');
const domains = getValue(company, 'domains');

// Typed — returns parsed values or throws on mismatch
import { z } from 'zod';

const nameSchema = z.object({ value: z.string() });
const typedName = getFirstValue(company, 'name', { schema: nameSchema });
//    ^? { value: string } | undefined
```

### Schema Helpers

Create a schema from cached metadata and use accessors to reduce raw string keys:

```typescript
import { createSchema } from 'attio-ts-sdk';

const schema = await createSchema({
  client,
  target: 'objects',
  identifier: 'companies',
});

const name = schema.getAccessorOrThrow('name').getFirstValue(company);
```

### Client Configuration

```typescript
import { createAttioClient } from 'attio-ts-sdk';

const client = createAttioClient({
  apiKey: process.env.ATTIO_API_KEY,
  baseUrl: 'https://api.attio.com',
  timeoutMs: 20_000,
  retry: { maxRetries: 4 },
  cache: { enabled: true },
});
```

### Error Handling

All errors thrown by the convenience layer and `createAttioSdk` are normalized into a hierarchy rooted at `AttioError`:

| Class | Default Code | When |
| --- | --- | --- |
| `AttioApiError` | *(from response)* | HTTP error responses (4xx / 5xx). Includes `response`, `requestId`, and optional `retryAfterMs`. |
| `AttioNetworkError` | *(from cause)* | Connection failures, DNS errors, timeouts. |
| `AttioRetryError` | `RETRY_ERROR` | All retry attempts exhausted. |
| `AttioResponseError` | `RESPONSE_ERROR` | Response body failed Zod validation. |
| `AttioConfigError` | `CONFIG_ERROR` | Invalid client configuration. |
| `AttioBatchError` | `BATCH_ERROR` | A batch operation partially or fully failed. |

Every `AttioError` carries these optional fields:

```typescript
error.status       // HTTP status code
error.code         // machine-readable error code
error.requestId    // Attio x-request-id header
error.retryAfterMs // parsed Retry-After (milliseconds)
error.suggestions  // fuzzy-match suggestions for value mismatches (see below)
```

#### Catching errors from the convenience layer

```typescript
import { createAttioClient, createRecord, AttioError } from 'attio-ts-sdk';

const client = createAttioClient({ apiKey: process.env.ATTIO_API_KEY });

try {
  await createRecord({
    client,
    object: 'companies',
    values: { stage: [{ value: 'Prospectt' }] },
  });
} catch (err) {
  if (err instanceof AttioError) {
    console.log(err.status, err.code, err.requestId, err.suggestions);
  } else {
    // Re-throw if it's not an error we specifically handle
    throw err;
  }
}
```

#### Smart suggestions for value mismatches

When an API error indicates a select option or status mismatch, the SDK automatically attaches a `suggestions` object with up to three fuzzy-matched alternatives:

```typescript
error.suggestions
// {
//   field: 'stage',
//   attempted: 'Prospectt',
//   bestMatch: 'Prospect',
//   matches: ['Prospect', 'Prospecting', 'Closed']
// }
```

#### Response helpers for generated endpoints

When using the generated endpoints directly, use `assertOk` or `toResult` to unwrap responses:

```typescript
import { assertOk, toResult, getV2Objects } from 'attio-ts-sdk';

// Throws on error, returns the data payload
const objects = assertOk(await getV2Objects({ client }));

// Returns a discriminated union { ok: true, value } | { ok: false, error }
const result = toResult(await getV2Objects({ client }));
if (result.ok) {
  console.log(result.value);
} else {
  console.error(result.error);
}
```

#### throwOnError mode

You can also opt into exceptions at the client level:

```typescript
const client = createAttioClient({
  apiKey: process.env.ATTIO_API_KEY,
  throwOnError: true,
});

// Generated endpoints now throw instead of returning { error }
const { data } = await postV2ObjectsByObjectRecords({
  client,
  path: { object: 'companies' },
  body: { data: { values: { name: [{ value: 'Test' }] } } },
});
```

### Pagination Helpers

The SDK provides two pagination strategies. Use the one that matches the endpoint:

| Strategy | Helper | Endpoints |
| --- | --- | --- |
| **Offset-based** | `paginateOffset` | Record queries (`postV2ObjectsByObjectRecordsQuery`), list entry queries (`postV2ListsByListEntriesQuery`) |
| **Cursor-based** | `paginate` | Meetings (`getV2Meetings`), notes (`getV2Notes`), tasks (`getV2Tasks`), webhooks, and most `GET` list endpoints |

Both helpers automatically extract items and pagination metadata from raw API responses — pass the generated endpoint call directly and the helper does the rest.

> **Note:** The convenience functions `queryRecords` / `sdk.records.query` and `queryListEntries` / `sdk.lists.queryEntries` return a single page of unwrapped results. To collect **all** pages, use the pagination helpers with the generated endpoints as shown below.

#### Paginating record queries (offset-based)

```typescript
import {
  createAttioClient,
  paginateOffset,
  postV2ObjectsByObjectRecordsQuery,
} from 'attio-ts-sdk';

const client = createAttioClient({ apiKey: process.env.ATTIO_API_KEY });

// Collect all companies matching a filter across every page
const allCompanies = await paginateOffset(async (offset, limit) => {
  return postV2ObjectsByObjectRecordsQuery({
    client,
    path: { object: 'companies' },
    body: {
      offset,
      limit,
      filter: { attribute: 'name', value: 'Acme' },
      sorts: [{ attribute: 'created_at', direction: 'desc' }],
    },
  });
});
```

#### Paginating list entry queries (offset-based)

```typescript
import { paginateOffset, postV2ListsByListEntriesQuery } from 'attio-ts-sdk';

const allEntries = await paginateOffset(async (offset, limit) => {
  return postV2ListsByListEntriesQuery({
    client,
    path: { list: 'sales-pipeline' },
    body: {
      offset,
      limit,
      filter: { attribute: 'stage', value: 'negotiation' },
    },
  });
});
```

#### Paginating cursor-based endpoints

```typescript
import { paginate, getV2Meetings } from 'attio-ts-sdk';

const allMeetings = await paginate(async (cursor) => {
  return getV2Meetings({ client, query: { cursor } });
});
```

#### Pagination options

Both helpers accept an options object to control limits:

```typescript
// Offset-based options
const records = await paginateOffset(fetchPage, {
  offset: 0,         // starting offset (default: 0)
  limit: 100,        // items per page (default: 50)
  maxPages: 5,       // stop after N pages
  maxItems: 200,     // stop after N total items
});

// Cursor-based options
const meetings = await paginate(fetchPage, {
  cursor: null,      // starting cursor (default: null)
  maxPages: 10,      // stop after N pages
  maxItems: 500,     // stop after N total items
});
```

### Caching

The SDK includes two levels of caching to reduce API calls and improve performance:

#### Metadata Caching

Attribute metadata (attributes, select options, and statuses) is automatically cached with a 5-minute TTL. This reduces redundant API calls when working with the same objects repeatedly.

```typescript
import { getAttributeOptions, getAttributeStatuses, listAttributes } from 'attio-ts-sdk';

// These calls are cached for 5 minutes
const options = await getAttributeOptions({
  client,
  target: 'objects',
  identifier: 'companies',
  attribute: 'stage',
});

// Subsequent calls with the same parameters return cached data
const optionsAgain = await getAttributeOptions({
  client,
  target: 'objects',
  identifier: 'companies',
  attribute: 'stage',
}); // Returns cached result, no API call
```

The metadata caches have the following defaults:
- **Attributes cache**: 200 entries max
- **Options cache**: 500 entries max
- **Statuses cache**: 500 entries max

When a cache reaches its limit, the oldest entry is evicted.

You can customize TTL, max entries, and adapters per client:

```typescript
const client = createAttioClient({
  apiKey: process.env.ATTIO_API_KEY,
  cache: {
    enabled: true,
    metadata: {
      ttlMs: 2 * 60 * 1000,
      maxEntries: { attributes: 300, options: 800, statuses: 800 },
      adapter: {
        create: ({ scope, ttlMs, maxEntries }) =>
          new YourCacheAdapter({ scope, ttlMs, maxEntries }),
      },
    },
  },
});

// Clear metadata caches for this client
client.cache.clear();
```

#### Client Instance Caching

You can cache `AttioClient` instances to reuse them across your application. This is useful when you want to avoid creating new client instances for repeated operations.

```typescript
import { getAttioClient } from 'attio-ts-sdk';

// With cache.key set, the client instance is cached and reused
const client = getAttioClient({
  apiKey: process.env.ATTIO_API_KEY,
  cache: { key: 'my-app' },
});

// Returns the same cached client instance
const sameClient = getAttioClient({
  apiKey: process.env.ATTIO_API_KEY,
  cache: { key: 'my-app' },
});

// Disable caching if needed
const freshClient = getAttioClient({
  apiKey: process.env.ATTIO_API_KEY,
  cache: { enabled: false },
});
```

### Debug Hooks

You can tap into request/response/error lifecycles for logging and tracing.

```typescript
const client = createAttioClient({
  apiKey: process.env.ATTIO_API_KEY,
  hooks: {
    onRequest: ({ request }) => console.log("request", request.method, request.url),
    onResponse: ({ response }) => console.log("response", response.status),
    onError: ({ error }) => console.error("error", error.message),
  },
});

// Or wire a logger (debug/info/warn/error)
const clientWithLogger = createAttioClient({
  apiKey: process.env.ATTIO_API_KEY,
  logger: console,
});
```

Note: `createAttioClient` always creates a new client instance. Use `getAttioClient` when you want caching behavior.

### Metadata Helpers

```typescript
import { createAttioClient, getAttributeOptions } from 'attio-ts-sdk';

const client = createAttioClient({ apiKey: process.env.ATTIO_API_KEY });

const options = await getAttributeOptions({
  client,
  target: 'objects',
  identifier: 'companies',
  attribute: 'stage',
});
```

### Working with Records

```typescript
import {
  createAttioClient,
  createRecord,
  upsertRecord,
  getRecord,
  deleteRecord,
} from 'attio-ts-sdk';

const client = createAttioClient({ apiKey: process.env.ATTIO_API_KEY });

// Create a new company
const newCompany = await createRecord({
  client,
  object: 'companies',
  values: {
    name: [{ value: 'Acme Corp' }],
    domains: [{ domain: 'acme.com' }],
  },
});

// Upsert a record (create or update based on matching attribute)
const upserted = await upsertRecord({
  client,
  object: 'companies',
  matchingAttribute: 'domains',
  values: {
    name: [{ value: 'Acme Corp' }],
    domains: [{ domain: 'acme.com' }],
    description: [{ value: 'Updated description' }],
  },
});

// Get a specific record
const company = await getRecord({
  client,
  object: 'companies',
  recordId: 'abc-123',
});

// Delete a record
await deleteRecord({
  client,
  object: 'companies',
  recordId: 'abc-123',
});
```

### Using Generated Endpoints Directly

You can always call the generated endpoints for full spec coverage:

```typescript
import { createAttioClient, getV2Objects } from 'attio-ts-sdk';

const client = createAttioClient({ apiKey: process.env.ATTIO_API_KEY });
const { data: objects } = await getV2Objects({ client });
```

### Managing Lists

```typescript
import {
  getV2Lists,
  postV2ListsByListEntriesQuery,
  postV2ListsByListEntries,
} from 'attio-ts-sdk';

// Get all lists
const { data: lists } = await getV2Lists({ client });

// Query entries in a list
const { data: entries } = await postV2ListsByListEntriesQuery({
  client,
  path: { list: 'sales-pipeline' },
  body: {
    filter: {
      attribute: 'stage',
      value: 'negotiation',
    },
  },
});

// Add a record to a list
const { data: entry } = await postV2ListsByListEntries({
  client,
  path: { list: 'sales-pipeline' },
  body: {
    data: {
      parent_record_id: 'company-record-id',
      entry_values: {
        stage: [{ status: 'prospecting' }],
        deal_value: [{ currency_value: 50000 }],
      },
    },
  },
});
```

### Notes and Tasks

```typescript
import { postV2Notes, postV2Tasks, patchV2TasksByTaskId } from 'attio-ts-sdk';

// Create a note on a record
const { data: note } = await postV2Notes({
  client,
  body: {
    data: {
      parent_object: 'companies',
      parent_record_id: 'abc-123',
      title: 'Meeting Notes',
      content: 'Discussed Q4 roadmap...',
    },
  },
});

// Create a task
const { data: task } = await postV2Tasks({
  client,
  body: {
    data: {
      content: 'Follow up on proposal',
      deadline_at: '2024-12-31T17:00:00Z',
      linked_records: [{ target_object: 'companies', target_record_id: 'abc-123' }],
    },
  },
});

// Mark task as complete
await patchV2TasksByTaskId({
  client,
  path: { task_id: task.data.id.task_id },
  body: { data: { is_completed: true } },
});
```

### Webhooks

```typescript
import { postV2Webhooks, getV2Webhooks } from 'attio-ts-sdk';

// Create a webhook
const { data: webhook } = await postV2Webhooks({
  client,
  body: {
    data: {
      target_url: 'https://your-app.com/webhooks/attio',
      subscriptions: [
        { event_type: 'record.created', filter: { object: 'companies' } },
        { event_type: 'record.updated', filter: { object: 'companies' } },
      ],
    },
  },
});

// List all webhooks
const { data: webhooks } = await getV2Webhooks({ client });
```

## See Also

- [attio-js](https://github.com/d-stoll/attio-js) - an alternative SDK generated with Speakeasy
- [attio-tui](https://github.com/hbmartin/attio-tui) - a TUI for using Attio built with this library

## Development

### Tools

- **[Hey API](https://heyapi.dev/)**: OpenAPI client and Zod schema generation
- **Biome**: lint and format with a single tool
- **Vitest**: fast tests with coverage and thresholds
- **tsdown**: ESM builds for Node
- **CI**: lint, typecheck, test, coverage, and size comments/badges
- **Deno-friendly**: `.ts` source imports for direct consumption
- **OIDC + Provenance**: publish to npm and JSR via manual CI release

### Setup

Install dependencies and run scripts:

```bash
git clone git@github.com:hbmartin/attio-ts-sdk.git
cd attio-ts-sdk
pnpm i
pnpm lint
pnpm test
pnpm build
```

### Releasing

- Merge the automated Release PR created by Release Please
- Manually run the "Release" workflow to publish to npm and JSR with provenance

## License

MIT © Harold Martin
