# Attio CRM TypeScript SDK

A modern, type-safe TypeScript SDK for the [Attio](https://attio.com) CRM API. Built with Zod v4 and a new Attio‑aware client layer that adds retries, error normalization, caching, and higher‑level helpers on top of the generated OpenAPI client.

- **Create an Attio client in one line** (`createAttioClient({ apiKey })`)
- **Retry & rate‑limit aware** (exponential backoff + `Retry-After`)
- **Normalized errors** (consistent shape + optional suggestions for select/status mismatches)
- **Record normalization** (handles inconsistent response shapes)
- **Metadata caching** (attributes, select options, statuses)
- **Pagination helpers** (`paginate` + cursor handling)

You still have full access to the generated, spec‑accurate endpoints.

## Features

- **Full Attio API Coverage** - People, companies, lists, notes, tasks, meetings, webhooks, and more
- **Runtime Validation** - Every request and response validated with Zod v4 schemas
- **Tiny Bundle** - Browser build under 3.5KB gzipped
- **Tree-Shakeable** - Import only what you need
- **Isomorphic** - Works in Node.js, Bun, Deno, and browsers
- **TypeScript First** - Complete type definitions generated from OpenAPI spec
- **Attio-Aware Client** - Retries, normalized errors, caching, helpers
- **Zero Config** - Sensible defaults, just add your API key

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

### Attio Convenience Layer

The Attio helpers wrap the generated endpoints with retries, error normalization,
record normalization, and opinionated defaults.

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

Errors are normalized to `AttioError` / `AttioApiError` / `AttioNetworkError`.

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
  const error = err as AttioError;
  console.log(error.status, error.code, error.requestId, error.suggestions);
}
```

### Pagination Helpers

```typescript
import { createAttioClient, paginate, getV2Meetings } from 'attio-ts-sdk';

const client = createAttioClient({ apiKey: process.env.ATTIO_API_KEY });


const meetings = await paginate(async (cursor) => {
  const result = await getV2Meetings({
    client,
    query: { cursor },
  });
  return result;
});
```

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

### Browser Usage

Use the standard entry point in browsers (requires a global `fetch`):

```typescript
import { createClient, getV2Self } from 'attio-ts-sdk';

const client = createClient({
  baseUrl: 'https://api.attio.com',
  headers: {
    Authorization: `Bearer ${apiKey}`,
  },
});

const { data: self } = await getV2Self({ client });
```

### Error Handling

```typescript
import { postV2ObjectsByObjectRecords } from 'attio-ts-sdk';

const result = await postV2ObjectsByObjectRecords({
  client,
  path: { object: 'companies' },
  body: { data: { values: { name: [{ value: 'Test' }] } } },
});

if (result.error) {
  console.error('API Error:', result.error);
} else {
  console.log('Created:', result.data);
}

// Or use throwOnError for exceptions
try {
  const { data } = await postV2ObjectsByObjectRecords({
    client,
    path: { object: 'companies' },
    body: { data: { values: { name: [{ value: 'Test' }] } } },
    throwOnError: true,
  });
} catch (error) {
  console.error('Request failed:', error);
}
```

## Development

### Tools

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
