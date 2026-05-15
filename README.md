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
- **Filter helpers** - typed comparison, logical, path, and list-entry filters
- **Request cancellation** - `AbortSignal` support for client, query, and pagination calls
- **Runtime Validation** - Every request and response validated with Zod v4 schemas
- **Tree-Shakeable** - Import only what you need
- **TypeScript First** - Complete type definitions generated from OpenAPI spec

You still have full access to the generated, spec‑accurate endpoints.

## Table of Contents

- [Installing](#installing)
- [Getting Your API Key](#getting-your-api-key)
- [Usage](#usage)
  - [Quick Start](#quick-start)
  - [Recommended Pattern](#recommended-pattern)
  - [Attio SDK](#attio-sdk)
  - [Attio Convenience Layer](#attio-convenience-layer)
  - [Filter Helpers](#filter-helpers)
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
  - [Files](#files)
  - [Listing and Viewing Person Notes](#listing-and-viewing-person-notes)
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
import { createAttioSdk, filters } from 'attio-ts-sdk';

const sdk = createAttioSdk({ apiKey: process.env.ATTIO_API_KEY });
```

`createAttioSdk` accepts the same flat client config as `createAttioClient`. You can also pass `{ config: { apiKey } }` or an existing `{ client }`.

The returned `sdk` object exposes these namespaces:

| Namespace | Methods |
| --- | --- |
| `sdk.objects` | `list`, `get`, `create`, `update` |
| `sdk.records` | `create`, `update`, `upsert`, `get`, `getMany`, `delete`, `query` |
| `sdk.lists` | `list`, `get`, `queryEntries`, `addEntry`, `updateEntry`, `removeEntry` |
| `sdk.notes` | `list`, `get`, `create`, `delete` |
| `sdk.tasks` | `list`, `get`, `create`, `update`, `delete` |
| `sdk.files` | `list`, `listForPerson`, `get`, `download`, `getDownloadUrl` |
| `sdk.search` | `records` |
| `sdk.workspaceMembers` | `list`, `get` |
| `sdk.metadata` | `listAttributes`, `findAttribute`, `getAttribute`, `getAttributeOptions`, `getAttributeStatuses`, `listAllowedValues`, `schema` |

The underlying `AttioClient` is also available as `sdk.client` when you need to drop down to the generated endpoints.

```typescript
const companies = await sdk.records.query({
  object: 'companies',
  filter: filters.contains('name', 'Acme'),
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

### Filter Helpers

The `filters` namespace builds typed Attio filters for convenience helpers and generated endpoint bodies. Use it for equality, string matching, comparisons, ranges, logical groups, record-reference paths, and list-entry relationships.

```typescript
import { filters } from 'attio-ts-sdk';

const revenueFilter = filters.and(
  filters.gte('annual_revenue', 50000),
  filters.lt('annual_revenue', 100000),
  filters.in('stage', ['active', 'pending']),
);

const rangeFilter = filters.between('annual_revenue', 50000, 100000);

const primaryContactFilter = filters.path(
  [['companies', 'primary_contact']],
  { email: { $contains: '@acme.com' } },
);

const listEntryFilter = filters.and(
  filters.parentRecordId({
    list: 'hiring-pipeline',
    object: 'people',
    recordId: 'rec_123',
  }),
  filters.listStatus({ attribute: 'stage', status: 'Interview' }),
);
```

`filters.between` is inclusive at the start and exclusive at the end. The `parentRecordId`, `parentRecordContains`, and `listStatus` helpers cover common list-entry relationship filters without hand-building path objects.

### Value Helpers

The `value` namespace provides factory functions that build correctly shaped field-value arrays for record creation and updates. Each helper validates its input with Zod before returning, so typos and bad data fail fast at the call site rather than in the API response.

```typescript
import { value } from 'attio-ts-sdk';
```

| Helper | Signature | Description |
| --- | --- | --- |
| `value.string` | `(value: string) => ValueInput[]` | Non-empty string field. |
| `value.text` | `(value: string) => ValueInput[]` | Alias for raw text fields. |
| `value.number` | `(value: number) => ValueInput[]` | Finite numeric field. |
| `value.boolean` | `(value: boolean) => ValueInput[]` | Boolean field. |
| `value.domain` | `(value: string) => ValueInput[]` | Domain field (non-empty string). |
| `value.email` | `(value: string) => ValueInput[]` | Email field (validated format). |
| `value.phone` | `(value: string, countryCode?: string) => ValueInput[]` | Phone field, with optional ISO country code. |
| `value.personalName` | `(input: ValuePersonalNameInput) => ValueInput[]` | Personal name values. |
| `value.status` | `(value: string) => ValueInput[]` | Status by title or ID. |
| `value.select` | `(value: string) => ValueInput[]` | Select option by title or ID. |
| `value.recordReference` | `(input: ValueRecordReferenceInput) => ValueInput[]` | Record-reference value. |
| `value.location` | `(input: ValueLocationInput) => ValueInput[]` | Location value with missing fields filled as `null`. |
| `value.currency` | `(value: number, currencyCode?: string) => ValueInput[]` | Currency field. `currencyCode` is an optional ISO 4217 code (e.g. `"USD"`). |

```typescript
const values = {
  name: value.string('Acme Corp'),
  domains: value.domain('acme.com'),
  contact_email: value.email('hello@acme.com'),
  phone_numbers: value.phone('+15551234567'),
  status: value.status('Customer'),
  employee_count: value.number(150),
  is_customer: value.boolean(true),
  annual_revenue: value.currency(50000, 'USD'),
  headquarters: value.location({ locality: 'San Francisco', countryCode: 'US' }),
};

await sdk.records.create({ object: 'companies', values });
```

For metadata-aware writes, create a schema and use `buildValues`. It accepts
attribute titles or `api_slug`s, rejects non-writable attributes, validates
select/status values against metadata, and serializes native JavaScript values:

```typescript
const schema = await createSchema({
  client,
  target: 'objects',
  identifier: 'companies',
});

const values = await schema.buildValues({
  Name: 'Acme Corp',
  Website: 'acme.com',
  Stage: 'Customer',
  owner_company: {
    targetObject: 'companies',
    targetRecordId: 'rec_123',
  },
});

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

Common value readers are exported for response shapes you usually do not want to parse by hand:

```typescript
import {
  getFirstEmail,
  getFirstPhone,
  getRecordReferenceIds,
  getSelectTitles,
} from 'attio-ts-sdk';

const email = getFirstEmail(person, 'email_addresses');
const phone = getFirstPhone(person, 'phone_numbers');
const segmentTitles = getSelectTitles(company, 'segments');
const companyIds = getRecordReferenceIds(person, 'company');
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

Branded identifier factories and schemas are exported for validating IDs from forms, URLs, and job payloads before you call the SDK:

```typescript
import { createListId, listIdSchema, recordIdSchema } from 'attio-ts-sdk';

const salesListId = createListId('sales-pipeline');
const listId = listIdSchema.parse(formData.get('listId'));
const recordId = recordIdSchema.parse(params.recordId);
```

Identifier schemas are exported for records (`recordIdSchema`, `recordObjectIdSchema`, `matchingAttributeSchema`), lists (`listIdSchema`, `entryIdSchema`, `parentObjectIdSchema`, `parentRecordIdSchema`), objects (`objectSlugSchema`, `objectApiSlugSchema`, `objectNounSchema`), notes, tasks, and workspace members.

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

Pass an `AbortSignal` when request or pagination work needs to be cancellable:

```typescript
import { queryRecords } from 'attio-ts-sdk';

const controller = new AbortController();

const recordsPromise = queryRecords({
  client,
  object: 'companies',
  paginate: true,
  signal: controller.signal,
});

setTimeout(() => controller.abort(), 0);

// Abort before awaiting so pending request or pagination work can be cancelled.
const records = await recordsPromise;
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
import { createAttioClient, createRecord, isAttioError } from 'attio-ts-sdk';

const client = createAttioClient({ apiKey: process.env.ATTIO_API_KEY });

try {
  await createRecord({
    client,
    object: 'companies',
    values: { stage: [{ value: 'Prospectt' }] },
  });
} catch (err) {
  if (isAttioError(err)) {
    console.log(err.status, err.code, err.requestId, err.suggestions);
  } else {
    // Re-throw if it's not an error we specifically handle
    throw err;
  }
}
```

Stable helpers are available when `instanceof` is unreliable across bundled or test environments:

```typescript
import {
  getAttioErrorStatus,
  isAttioNotFound,
  isRetryableAttioError,
} from 'attio-ts-sdk';

if (isAttioNotFound(err)) return undefined;
if (isRetryableAttioError(err)) console.log(getAttioErrorStatus(err));
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

The SDK provides multiple approaches to pagination, from simple convenience options to low-level helpers for full control.

#### Using `queryRecords` with auto-pagination (recommended)

The simplest way to paginate record queries is using the `paginate` option on `queryRecords`:

```typescript
import { createAttioClient, filters, queryRecords } from 'attio-ts-sdk';

const client = createAttioClient({ apiKey: process.env.ATTIO_API_KEY });

// Collect all pages automatically into an array
const allCompanies = await queryRecords({
  client,
  object: 'companies',
  filter: filters.contains('name', 'Acme'),
  sorts: [{ attribute: 'created_at', direction: 'desc' }],
  paginate: true,
  maxItems: 10000,  // Optional: limit total items
});

// Stream records one at a time (memory-efficient for large datasets)
for await (const company of queryRecords({
  client,
  object: 'companies',
  paginate: 'stream',
})) {
  console.log(company.id);
}
```

The same pattern works with `queryListEntries` / `sdk.lists.queryEntries`.

#### Fetching many records by ID

Use `getManyRecords` or `sdk.records.getMany` when you already have record IDs. The helper chunks `$in` queries, runs them with bounded concurrency, and can preserve input order.

```typescript
const companies = await sdk.records.getMany({
  object: 'companies',
  recordIds: ['rec_1', 'rec_2', 'rec_3'],
  preserveOrder: true,
  notFound: 'throw',
});
```

#### Using low-level pagination helpers

For more control or when working directly with generated endpoints, use `paginateOffset` (offset-based) or `paginate` (cursor-based):

| Strategy | Helper | Endpoints |
| --- | --- | --- |
| **Offset-based** | `paginateOffset` | Record queries (`postV2ObjectsByObjectRecordsQuery`), list entry queries (`postV2ListsByListEntriesQuery`), notes (`getV2Notes`), tasks (`getV2Tasks`) |
| **Cursor-based** | `paginate` | Meetings (`getV2Meetings`), webhooks, and most `GET` list endpoints |

Both helpers automatically extract items and pagination metadata from raw API responses.

#### Paginating record queries with `paginateOffset`

```typescript
import {
  createAttioClient,
  filters,
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
      filter: filters.contains('name', 'Acme'),
      sorts: [{ attribute: 'created_at', direction: 'desc' }],
    },
  });
});
```

#### Paginating list entry queries with `paginateOffset`

```typescript
import { filters, paginateOffset, postV2ListsByListEntriesQuery } from 'attio-ts-sdk';

const allEntries = await paginateOffset(async (offset, limit) => {
  return postV2ListsByListEntriesQuery({
    client,
    path: { list: 'sales-pipeline' },
    body: {
      offset,
      limit,
      filter: filters.listStatus({ attribute: 'stage', status: 'negotiation' }),
    },
  });
});
```

#### Type-safe response validation with itemSchema

The convenience functions `queryListEntries` and `queryRecords` support an optional `itemSchema` parameter for type-safe validation of API responses. The schema validates raw items before normalization.

```typescript
import { z } from 'zod';
import { queryListEntries, createListId } from 'attio-ts-sdk';

// Define a schema that matches your expected item structure
const entrySchema = z.object({
  id: z.object({ entry_id: z.string() }),
  values: z.object({
    stage: z.array(z.object({ status: z.string() })),
    deal_value: z.array(z.object({ currency_value: z.number() })).optional(),
  }),
});

type SalesEntry = z.infer<typeof entrySchema>;

// Create a typed ListId using the factory function
const salesListId = createListId('sales-pipeline');

// TypeScript infers the return type from itemSchema
const entries = await queryListEntries<SalesEntry>({
  client,
  list: salesListId,
  itemSchema: entrySchema,
  paginate: true,
});

// entries is SalesEntry[] with full type safety
for (const entry of entries) {
  console.log(entry.values.stage[0].status);
}
```

When using streaming pagination, the same type safety applies:

```typescript
const stream = queryListEntries<SalesEntry>({
  client,
  list: salesListId,
  itemSchema: entrySchema,
  paginate: 'stream',
});

for await (const entry of stream) {
  console.log(entry.values.stage[0].status);
}
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
import {
  createAttioClient,
  findAttribute,
  getAttributeOptions,
  listAllowedValues,
} from 'attio-ts-sdk';

const client = createAttioClient({ apiKey: process.env.ATTIO_API_KEY });

const options = await getAttributeOptions({
  client,
  target: 'objects',
  identifier: 'companies',
  attribute: 'stage',
});

const statusAttribute = await findAttribute({
  client,
  target: 'objects',
  identifier: 'companies',
  type: 'status',
  title: 'Stage',
});

const allowedValues = await listAllowedValues({
  client,
  target: 'objects',
  identifier: 'companies',
  attribute: 'stage',
});
// [{ id, title, archived }]
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
import {
  createAttioSdk,
  createNoteParentObjectId,
  createNoteParentRecordId,
} from 'attio-ts-sdk';

const sdk = createAttioSdk({ apiKey: process.env.ATTIO_API_KEY });
const companyObject = createNoteParentObjectId('companies');
const companyRecordId = createNoteParentRecordId('abc-123');

// Create a note on a record.
const note = await sdk.notes.create({
  parentObject: companyObject,
  parentRecordId: companyRecordId,
  title: 'Meeting Notes',
  format: 'markdown',
  content: 'Discussed Q4 roadmap...',
});

// Create a task.
const task = await sdk.tasks.create({
  data: {
    content: 'Follow up on proposal',
    format: 'plaintext',
    deadline_at: '2024-12-31T17:00:00Z',
    is_completed: false,
    linked_records: [{ target_object: 'companies', target_record_id: 'abc-123' }],
    assignees: [],
  },
});

// Mark task as complete.
await sdk.tasks.update({
  taskId: task.id.task_id,
  data: { is_completed: true },
});
```

### Files

Use `sdk.files` to list file entries linked to a record, fetch file metadata, and download native Attio files. Generic file listing requires the object slug or ID plus the record ID. `listForPerson` removes the object boilerplate for person records.

```typescript
import {
  createAttioSdk,
  createFileId,
  createFileObjectId,
  createFileRecordId,
} from 'attio-ts-sdk';

const sdk = createAttioSdk({ apiKey: process.env.ATTIO_API_KEY });

const companyFiles = await sdk.files.list({
  object: createFileObjectId('companies'),
  recordId: createFileRecordId('bf071e1f-6035-429d-b874-d83ea64ea13b'),
  storageProvider: 'google-drive',
  paginate: true,
  limit: 100,
});

const personFiles = await sdk.files.listForPerson({
  personId: createFileRecordId('2f96e5cc-8aab-4db5-9074-5c5d510d4f38'),
  paginate: 'stream',
});

for await (const file of personFiles) {
  console.log(file.file_type, file.id.file_id);
}

const firstFile = companyFiles[0];
if (firstFile) {
  const fileId = createFileId(firstFile.id.file_id);
  const metadata = await sdk.files.get({ fileId });
  const bytes = await sdk.files.download({ fileId });
  const signedUrl = await sdk.files.getDownloadUrl({ fileId });

  console.log(metadata.file_type, bytes.byteLength, signedUrl);
}
```

Pass `parseAs: 'blob'`, `parseAs: 'stream'`, or `parseAs: 'text'` to `sdk.files.download` when you need a different response type. File create, upload, and delete operations remain available through generated endpoints such as `postV2Files`, `postV2FilesUpload`, and `deleteV2FilesByFileId`.

The integration token needs `file:read`, `object_configuration:read`, and `record_permission:read` scopes for file reads.

### Listing and Viewing Person Notes

Use `sdk.notes.list` with a branded `parentObject` for `people` and the person's branded record ID to list notes attached to a specific person. Set `paginate: true` to collect every page, or `paginate: 'stream'` to iterate notes lazily.

```typescript
import {
  createAttioSdk,
  createNoteParentObjectId,
  createNoteParentRecordId,
} from 'attio-ts-sdk';

const sdk = createAttioSdk({ apiKey: process.env.ATTIO_API_KEY });
const personObject = createNoteParentObjectId('people');
const personRecordId = createNoteParentRecordId('person-record-id');

const personNotes = await sdk.notes.list({
  parentObject: personObject,
  parentRecordId: personRecordId,
  paginate: true,
  limit: 50,
});

const firstNote = personNotes[0];
if (firstNote) {
  const note = await sdk.notes.get({ noteId: firstNote.id.note_id });

  console.log(note.title);
  console.log(note.content_markdown ?? note.content_plaintext);
}
```

The integration token needs `note:read`, `object_configuration:read`, and `record_permission:read` scopes for these reads.

The task wrapper exposes the generated list filters as camelCase inputs:

```typescript
const openTasksForPerson = await sdk.tasks.list({
  linkedRecord: { object: 'people', recordId: personRecordId },
  assignee: 'owner@example.com',
  isCompleted: false,
  sort: 'created_at:desc',
  paginate: true,
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
- [attio-mcp-server](https://github.com/kesslerio/attio-mcp-server) - an MCP server for using Attio from AI assistants

## Development

### Tools

- **[Hey API](https://heyapi.dev/)**: OpenAPI client and Zod schema generation
- **Biome**: lint and format with a single tool
- **Vitest**: fast tests with coverage and thresholds
- **tsdown**: dual ESM/CJS builds for Node
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

## License

[MIT](LICENSE) © [Harold Martin](https://www.linkedin.com/in/harold-martin-98526971/)
