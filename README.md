# Attio CRM TypeScript SDK

A modern, type-safe TypeScript SDK for the [Attio](https://attio.com) CRM API. Built with Zod v4 for bulletproof runtime validation on both requests and responses.

## Features

- **Full Attio API Coverage** - People, companies, lists, notes, tasks, meetings, webhooks, and more
- **Runtime Validation** - Every request and response validated with Zod v4 schemas
- **Tiny Bundle** - Browser build under 3.5KB gzipped
- **Tree-Shakeable** - Import only what you need
- **Isomorphic** - Works in Node.js, Bun, Deno, and browsers
- **TypeScript First** - Complete type definitions generated from OpenAPI spec
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

### Quick Start

```typescript
import { createClient, getV2Objects, postV2ObjectsByObjectRecordsQuery } from 'attio-ts-sdk';

// Configure the client with your API key
const client = createClient({
  baseUrl: 'https://api.attio.com',
  headers: {
    Authorization: `Bearer ${process.env.ATTIO_API_KEY}`,
  },
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

### Working with Records

```typescript
import {
  postV2ObjectsByObjectRecords,
  putV2ObjectsByObjectRecords,
  getV2ObjectsByObjectRecordsByRecordId,
  deleteV2ObjectsByObjectRecordsByRecordId,
} from 'attio-ts-sdk';

// Create a new company
const { data: newCompany } = await postV2ObjectsByObjectRecords({
  client,
  path: { object: 'companies' },
  body: {
    data: {
      values: {
        name: [{ value: 'Acme Corp' }],
        domains: [{ domain: 'acme.com' }],
      },
    },
  },
});

// Upsert a record (create or update based on matching attribute)
const { data: upserted } = await putV2ObjectsByObjectRecords({
  client,
  path: { object: 'companies' },
  body: {
    data: {
      values: {
        name: [{ value: 'Acme Corp' }],
        domains: [{ domain: 'acme.com' }],
        description: [{ value: 'Updated description' }],
      },
    },
    matching_attribute: 'domains',
  },
});

// Get a specific record
const { data: company } = await getV2ObjectsByObjectRecordsByRecordId({
  client,
  path: { object: 'companies', record_id: 'abc-123' },
});

// Delete a record
await deleteV2ObjectsByObjectRecordsByRecordId({
  client,
  path: { object: 'companies', record_id: 'abc-123' },
});
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

For browsers, import from the `/browser` entry point:

```typescript
import { createClient, getV2Self } from 'attio-ts-sdk/browser';

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
- **Size Limit**: keep bundles tiny, with CI checks
- **tsdown**: ESM builds for Node and a separate browser bundle
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
