# Pagination Guide

The Attio API uses pagination for endpoints that can return large result sets. This SDK provides high-level pagination helpers that handle all the complexity for you, including automatic response parsing, cursor/offset tracking, and termination conditions.

## Pagination Strategies

The Attio API implements two pagination strategies depending on the endpoint:

| Strategy | When Used | SDK Helper | Streaming Helper |
|----------|-----------|------------|------------------|
| **Cursor-based** | Most `GET` list endpoints (meetings, notes, tasks, webhooks) | `paginate()` | `paginateAsync()` |
| **Offset-based** | Record queries, list entry queries (`POST` query endpoints) | `paginateOffset()` | `paginateOffsetAsync()` |

## Quick Start

```typescript
import {
  createAttioClient,
  paginate,
  paginateOffset,
  paginateAsync,
  paginateOffsetAsync,
  queryRecords,
  getV2Meetings,
  postV2ObjectsByObjectRecordsQuery,
} from 'attio-ts-sdk';

const client = createAttioClient({ apiKey: process.env.ATTIO_API_KEY });

// Cursor-based: Collect all meetings
const allMeetings = await paginate(async (cursor) => {
  return getV2Meetings({ client, query: { cursor, limit: 50 } });
});

// Offset-based: Collect all company records
const allCompanies = await paginateOffset(async (offset, limit) => {
  return postV2ObjectsByObjectRecordsQuery({
    client,
    path: { object: 'companies' },
    body: { offset, limit },
  });
});

// Convenience function with auto-pagination
const allRecords = await queryRecords({
  client,
  object: 'companies',
  paginate: true,  // Fetches all pages automatically
});

// Streaming with async generators (memory-efficient)
for await (const record of queryRecords({
  client,
  object: 'companies',
  paginate: 'stream',
})) {
  console.log(record.id);  // Process one record at a time
}
```

---

## Cursor-Based Pagination

Cursor-based pagination uses an opaque cursor token to track position in the result set. The API returns a `next_cursor` value that you pass to subsequent requests.

### API Behavior

According to the [Attio API documentation](https://docs.attio.com):

- The initial request should omit the `cursor` parameter
- Each response includes `pagination.next_cursor` for the next page
- When `next_cursor` is `null` or absent, you've reached the end
- Keep `limit` and filter parameters consistent between requests

### SDK Helper: `paginate()`

The `paginate()` function abstracts away cursor management:

```typescript
import { paginate, getV2Notes } from 'attio-ts-sdk';

const allNotes = await paginate(async (cursor) => {
  return getV2Notes({ client, query: { cursor, limit: 100 } });
});
```

**How it works:**

1. Calls your fetch function with `cursor = null` for the first request
2. Extracts items and `next_cursor` from the response automatically
3. Continues calling with the new cursor until `next_cursor` is `null`
4. Returns all collected items as a flat array

### Cursor-Based Options

```typescript
interface PaginationOptions<T> {
  cursor?: string | null;  // Starting cursor (default: null)
  maxPages?: number;       // Stop after N pages (default: unlimited)
  maxItems?: number;       // Stop after N total items (default: unlimited)
  itemSchema?: ZodType<T>; // Optional Zod schema for runtime validation
}
```

### Examples

#### Fetch all meetings

```typescript
const allMeetings = await paginate(async (cursor) => {
  return getV2Meetings({ client, query: { cursor } });
});
```

#### Limit to 500 items

```typescript
const meetings = await paginate(
  async (cursor) => getV2Meetings({ client, query: { cursor } }),
  { maxItems: 500 }
);
```

#### Limit to 10 pages

```typescript
const meetings = await paginate(
  async (cursor) => getV2Meetings({ client, query: { cursor } }),
  { maxPages: 10 }
);
```

#### Resume from a saved cursor

```typescript
const meetings = await paginate(
  async (cursor) => getV2Meetings({ client, query: { cursor } }),
  { cursor: savedCursor }
);
```

#### With runtime schema validation

```typescript
import { z } from 'zod';

const MeetingSchema = z.object({
  id: z.object({ meeting_id: z.string() }),
  title: z.string().nullable(),
});

const meetings = await paginate(
  async (cursor) => getV2Meetings({ client, query: { cursor } }),
  { itemSchema: MeetingSchema }
);
// meetings is typed as Array<{ id: { meeting_id: string }, title: string | null }>
```

### Cursor-Based Endpoints

| Endpoint | Function |
|----------|----------|
| List meetings | `getV2Meetings` |
| List notes | `getV2Notes` |
| List tasks | `getV2Tasks` |
| List webhooks | `getV2Webhooks` |
| List call recordings | `getV2MeetingsByMeetingIdCallRecordings` |

---

## Offset-Based Pagination

Offset-based pagination uses `limit` and `offset` parameters to control which slice of results to return.

### API Behavior

According to the [Attio API documentation](https://docs.attio.com):

- `limit` controls the maximum number of results per page
- `offset` controls how many results to skip (default: 0)
- When the number of results is less than `limit`, you've reached the end
- For `POST` endpoints, these parameters go in the request body

**Example flow for 122 records with limit=50:**

```
Request 1: offset=0   → Results 1-50
Request 2: offset=50  → Results 51-100
Request 3: offset=100 → Results 101-122 (less than limit, stop)
```

### SDK Helper: `paginateOffset()`

The `paginateOffset()` function handles offset calculation automatically:

```typescript
import { paginateOffset, postV2ObjectsByObjectRecordsQuery } from 'attio-ts-sdk';

const allCompanies = await paginateOffset(async (offset, limit) => {
  return postV2ObjectsByObjectRecordsQuery({
    client,
    path: { object: 'companies' },
    body: { offset, limit },
  });
});
```

**How it works:**

1. Calls your fetch function with `offset=0` and the configured `limit`
2. Extracts items from the response automatically
3. Calculates the next offset based on items returned
4. Continues until fewer items than `limit` are returned (end of results)
5. Returns all collected items as a flat array

### Offset-Based Options

```typescript
interface OffsetPaginationOptions<T> {
  offset?: number;         // Starting offset (default: 0)
  limit?: number;          // Items per page (default: 50)
  pageSize?: number;       // Alias for limit
  maxPages?: number;       // Stop after N pages (default: unlimited)
  maxItems?: number;       // Stop after N total items (default: unlimited)
  itemSchema?: ZodType<T>; // Optional Zod schema for runtime validation
}
```

### Examples

#### Fetch all company records

```typescript
const allCompanies = await paginateOffset(async (offset, limit) => {
  return postV2ObjectsByObjectRecordsQuery({
    client,
    path: { object: 'companies' },
    body: { offset, limit },
  });
});
```

#### With filters (keep filters consistent across pages)

```typescript
const acmeCompanies = await paginateOffset(async (offset, limit) => {
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

#### Fetch all list entries

```typescript
import { paginateOffset, postV2ListsByListEntriesQuery } from 'attio-ts-sdk';

const allEntries = await paginateOffset(async (offset, limit) => {
  return postV2ListsByListEntriesQuery({
    client,
    path: { list: 'sales-pipeline' },
    body: { offset, limit },
  });
});
```

#### Custom page size

```typescript
const companies = await paginateOffset(
  async (offset, limit) => {
    return postV2ObjectsByObjectRecordsQuery({
      client,
      path: { object: 'companies' },
      body: { offset, limit },
    });
  },
  { limit: 100 } // 100 items per page instead of default 50
);
```

#### Limit total items

```typescript
const first200Companies = await paginateOffset(
  async (offset, limit) => {
    return postV2ObjectsByObjectRecordsQuery({
      client,
      path: { object: 'companies' },
      body: { offset, limit },
    });
  },
  { maxItems: 200 }
);
```

#### Start from a specific offset

```typescript
const companiesAfter100 = await paginateOffset(
  async (offset, limit) => {
    return postV2ObjectsByObjectRecordsQuery({
      client,
      path: { object: 'companies' },
      body: { offset, limit },
    });
  },
  { offset: 100 }
);
```

### Offset-Based Endpoints

| Endpoint | Function |
|----------|----------|
| Query records | `postV2ObjectsByObjectRecordsQuery` |
| Query list entries | `postV2ListsByListEntriesQuery` |

---

## Streaming Pagination (Async Generators)

For memory-efficient processing of large datasets, the SDK provides async generator variants that yield items one at a time instead of collecting all items in memory.

### Benefits

- **Memory efficient**: Only one page is held in memory at a time
- **Streaming**: Process items as they arrive
- **Backpressure**: Consumer controls iteration speed
- **Early exit**: `break` from the loop stops fetching more pages
- **Cancellable**: AbortSignal support for timeouts and user cancellation

### `paginateAsync()` - Cursor-Based Streaming

```typescript
import { paginateAsync, getV2Meetings } from 'attio-ts-sdk';

// Stream all meetings one at a time
for await (const meeting of paginateAsync(async (cursor, signal) => {
  return getV2Meetings({ client, query: { cursor, limit: 50 }, signal });
})) {
  console.log(meeting.id);

  // Can break early - no more pages will be fetched
  if (someCondition) break;
}
```

The `signal` parameter is forwarded from the options, enabling in-flight request cancellation when using `AbortSignal`.

### `paginateOffsetAsync()` - Offset-Based Streaming

```typescript
import { paginateOffsetAsync, postV2ObjectsByObjectRecordsQuery } from 'attio-ts-sdk';

// Stream all company records one at a time
for await (const company of paginateOffsetAsync(async (offset, limit, signal) => {
  return postV2ObjectsByObjectRecordsQuery({
    client,
    path: { object: 'companies' },
    body: { offset, limit },
    signal, // Enables in-flight request cancellation
  });
})) {
  await processCompany(company);
}
```

The `signal` parameter is forwarded from the options, enabling in-flight request cancellation when using `AbortSignal`.

### Async Options

Both async generators extend their synchronous counterparts with AbortSignal support:

```typescript
interface PaginationAsyncOptions<T> extends PaginationOptions<T> {
  signal?: AbortSignal;  // Cancel pagination when aborted
}

interface OffsetPaginationAsyncOptions<T> extends OffsetPaginationOptions<T> {
  signal?: AbortSignal;  // Cancel pagination when aborted
}
```

### Cancellation with AbortSignal

The signal is forwarded to your `fetchPage` callback, enabling cancellation of in-flight HTTP requests. This means when the signal is aborted, the current fetch operation can be cancelled immediately rather than waiting for it to complete.

```typescript
const controller = new AbortController();

// Set a timeout
setTimeout(() => controller.abort(), 30000);

try {
  for await (const record of paginateOffsetAsync(
    async (offset, limit, signal) => {
      // Signal is forwarded - pass it to your HTTP client
      return postV2ObjectsByObjectRecordsQuery({
        client,
        path: { object: 'companies' },
        body: { offset, limit },
        signal, // Enables in-flight request cancellation
      });
    },
    { signal: controller.signal }
  )) {
    await processRecord(record);
  }
} catch (error) {
  if (controller.signal.aborted) {
    console.log('Pagination cancelled');
  }
}
```

**How signal forwarding works:**

1. You pass an `AbortSignal` in the options
2. The signal is forwarded to every `fetchPage` call
3. When aborted, the current HTTP request can be cancelled immediately
4. No more pages are fetched after abort

### Early Exit

Breaking from the loop stops fetching additional pages:

```typescript
let count = 0;
for await (const record of paginateOffsetAsync(fetchPage)) {
  await processRecord(record);
  count++;

  if (count >= 100) {
    break;  // Stops iteration, no more API calls
  }
}
```

---

## Auto-Pagination on Convenience Functions

The SDK's convenience functions (`queryRecords`, `queryListEntries`) support an optional `paginate` parameter for automatic pagination:

### Single Page (Default)

```typescript
// Returns first page only (existing behavior)
const firstPage = await queryRecords({
  client,
  object: 'companies',
  limit: 50,
});
```

### All Pages (`paginate: true`)

```typescript
// Returns all records as Promise<T[]>
const allCompanies = await queryRecords({
  client,
  object: 'companies',
  paginate: true,
  maxItems: 10000,  // Optional: limit total items
  maxPages: 100,    // Optional: limit total pages
});
```

### Streaming (`paginate: 'stream'`)

```typescript
// Returns AsyncIterable<T> for memory-efficient streaming
for await (const company of queryRecords({
  client,
  object: 'companies',
  paginate: 'stream',
  signal: controller.signal,  // Optional: cancellation support
})) {
  await processCompany(company);
}
```

### Pagination Options for Convenience Functions

When using `paginate: true` or `paginate: 'stream'`, these additional options are available:

| Option | Type | Description |
|--------|------|-------------|
| `maxPages` | `number` | Maximum pages to fetch |
| `maxItems` | `number` | Maximum total items to return |
| `signal` | `AbortSignal` | Cancel pagination (stream mode only) |

### Example: Query List Entries with Streaming

```typescript
import { queryListEntries } from 'attio-ts-sdk';

// Stream all entries from a list
for await (const entry of queryListEntries({
  client,
  list: 'sales-pipeline',
  filter: { status: { $eq: 'active' } },
  paginate: 'stream',
})) {
  await processEntry(entry);
}
```

---

## Automatic Response Parsing

Both pagination helpers automatically extract items and pagination metadata from API responses. You don't need to manually navigate response structures.

### Response Unwrapping

The SDK intelligently searches for arrays in nested response structures, checking these keys in order:

1. `data`
2. `items`
3. `records`

This handles various Attio API response shapes:

```typescript
// All of these response shapes are handled automatically:
{ data: [items] }
{ data: { data: [items] } }
{ data: { items: [items] } }
{ data: { records: [items] } }
```

### Pagination Metadata Extraction

**Cursor-based:** Looks for `pagination.next_cursor` or `pagination.nextCursor`

**Offset-based:** Looks for `pagination.next_offset` or `pagination.nextOffset`, or calculates based on returned item count

---

## Comparison: Pagination Approaches

### Single-Page (Default)

Returns only the first page of results:

```typescript
import { queryRecords } from 'attio-ts-sdk';

// Returns first page only (up to limit items)
const firstPage = await queryRecords({
  client,
  object: 'companies',
  limit: 50,
});
```

### Full Pagination with Convenience Functions

Use `paginate: true` for automatic pagination:

```typescript
// Returns ALL matching records across all pages
const allCompanies = await queryRecords({
  client,
  object: 'companies',
  paginate: true,
});
```

### Full Pagination with Helpers

Use the low-level pagination helpers for more control:

```typescript
// Returns ALL matching records across all pages
const allCompanies = await paginateOffset(async (offset, limit) => {
  return postV2ObjectsByObjectRecordsQuery({
    client,
    path: { object: 'companies' },
    body: { offset, limit },
  });
});
```

### Streaming with Convenience Functions

Use `paginate: 'stream'` for memory-efficient streaming:

```typescript
// Process records one at a time
for await (const company of queryRecords({
  client,
  object: 'companies',
  paginate: 'stream',
})) {
  await processCompany(company);
}
```

### Streaming with Helpers

Use async generator helpers for more control:

```typescript
for await (const company of paginateOffsetAsync(async (offset, limit, signal) => {
  return postV2ObjectsByObjectRecordsQuery({
    client,
    path: { object: 'companies' },
    body: { offset, limit },
    signal, // Forward signal for in-flight cancellation
  });
})) {
  await processCompany(company);
}
```

### When to Use Each Approach

| Approach | Use Case |
|----------|----------|
| Single page (default) | Quick queries, preview data, known small result sets |
| `paginate: true` | Fetch all results into memory for further processing |
| `paginate: 'stream'` | Large datasets, memory constraints, early exit scenarios |
| Low-level helpers | Custom pagination logic, non-standard endpoints |

---

## Termination Conditions

### Cursor-Based (`paginate`)

Pagination stops when any of these conditions are met:

1. `nextCursor` is `null` or `undefined` (end of results)
2. `maxPages` limit reached
3. `maxItems` limit reached

### Offset-Based (`paginateOffset`)

Pagination stops when any of these conditions are met:

1. Returned items count is less than `limit` (end of results)
2. `nextOffset` is `null` (if API provides it)
3. `nextOffset` doesn't advance (safety check against infinite loops)
4. `maxPages` limit reached
5. `maxItems` limit reached

---

## Type Safety with Zod Schemas

Both helpers accept an optional `itemSchema` parameter for runtime type validation:

```typescript
import { z } from 'zod';
import { paginate, getV2Tasks } from 'attio-ts-sdk';

const TaskSchema = z.object({
  id: z.object({ task_id: z.string() }),
  content: z.string(),
  is_completed: z.boolean(),
  deadline_at: z.string().nullable(),
});

const tasks = await paginate(
  async (cursor) => getV2Tasks({ client, query: { cursor } }),
  { itemSchema: TaskSchema }
);

// `tasks` is now typed as Array<z.infer<typeof TaskSchema>>
```

If schema validation fails, the helper throws an "Invalid API response" error, ensuring data integrity by failing fast on unexpected response shapes.

---

## Best Practices

### 1. Keep parameters consistent

When paginating, keep `limit`, filters, and sorts consistent across all requests to avoid unexpected results:

```typescript
// Good: Same filter on every page
const filter = { attribute: 'name', value: 'Acme' };
const companies = await paginateOffset(async (offset, limit) => {
  return postV2ObjectsByObjectRecordsQuery({
    client,
    path: { object: 'companies' },
    body: { offset, limit, filter }, // Same filter every time
  });
});
```

### 2. Use appropriate limits

Set reasonable `maxItems` or `maxPages` to avoid accidentally fetching millions of records:

```typescript
// Defensive: Limit to first 10,000 records
const companies = await paginateOffset(fetchPage, { maxItems: 10000 });
```

### 3. Choose the right helper

| Use Case | Helper |
|----------|--------|
| `GET` list endpoints | `paginate()` |
| Record/entry `POST` queries | `paginateOffset()` |

### 4. Handle large datasets

For very large datasets, use streaming pagination to avoid loading everything into memory:

```typescript
// Recommended: Use streaming for large datasets
for await (const company of queryRecords({
  client,
  object: 'companies',
  paginate: 'stream',
})) {
  await processCompany(company);
}
```

Or with the low-level helper for more control:

```typescript
for await (const company of paginateOffsetAsync(
  async (offset, limit, signal) => postV2ObjectsByObjectRecordsQuery({
    client,
    path: { object: 'companies' },
    body: { offset, limit },
    signal,
  }),
  { limit: 100 }
)) {
  await processCompany(company);
}
```

### 5. Use AbortSignal for cancellation

For long-running pagination, implement cancellation:

```typescript
const controller = new AbortController();

// Cancel after 60 seconds
const timeout = setTimeout(() => controller.abort(), 60000);

try {
  for await (const record of queryRecords({
    client,
    object: 'companies',
    paginate: 'stream',
    signal: controller.signal,
  })) {
    await processRecord(record);
  }
} finally {
  clearTimeout(timeout);
}
```

---

## API Reference

### `paginate<T>(fetchPage, options?): Promise<T[]>`

Fetches all pages using cursor-based pagination.

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `fetchPage` | `(cursor: string \| null \| undefined, signal?: AbortSignal) => Promise<PageResult<T> \| unknown>` | Function that fetches a page given a cursor and optional signal |
| `options.cursor` | `string \| null` | Starting cursor (default: `null`) |
| `options.maxPages` | `number` | Maximum pages to fetch |
| `options.maxItems` | `number` | Maximum total items to return |
| `options.itemSchema` | `ZodType<T>` | Optional Zod schema for item validation |
| `options.signal` | `AbortSignal` | Cancel pagination when aborted (forwarded to fetchPage) |

**Returns:** `Promise<T[]>` - All collected items as a flat array

**Note:** The signal is forwarded to the `fetchPage` callback, enabling cancellation of in-flight HTTP requests.

---

### `paginateAsync<T>(fetchPage, options?): AsyncIterable<T>`

Streams items using cursor-based pagination via async generator.

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `fetchPage` | `(cursor: string \| null \| undefined, signal: AbortSignal \| undefined) => Promise<PageResult<T> \| unknown>` | Function that fetches a page given a cursor and signal |
| `options.cursor` | `string \| null` | Starting cursor (default: `null`) |
| `options.maxPages` | `number` | Maximum pages to fetch |
| `options.maxItems` | `number` | Maximum total items to yield |
| `options.itemSchema` | `ZodType<T>` | Optional Zod schema for item validation |
| `options.signal` | `AbortSignal` | Cancel pagination when aborted (forwarded to fetchPage) |

**Returns:** `AsyncIterable<T>` - Async iterable yielding items one at a time

**Note:** The signal is forwarded to the `fetchPage` callback, enabling cancellation of in-flight HTTP requests.

---

### `paginateOffset<T>(fetchPage, options?): Promise<T[]>`

Fetches all pages using offset-based pagination.

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `fetchPage` | `(offset: number, limit: number, signal?: AbortSignal) => Promise<OffsetPageResult<T> \| unknown>` | Function that fetches a page given offset, limit, and optional signal |
| `options.offset` | `number` | Starting offset (default: `0`) |
| `options.limit` | `number` | Items per page (default: `50`) |
| `options.pageSize` | `number` | Alias for `limit` |
| `options.maxPages` | `number` | Maximum pages to fetch |
| `options.maxItems` | `number` | Maximum total items to return |
| `options.itemSchema` | `ZodType<T>` | Optional Zod schema for item validation |
| `options.signal` | `AbortSignal` | Cancel pagination when aborted (forwarded to fetchPage) |

**Returns:** `Promise<T[]>` - All collected items as a flat array

**Note:** The signal is forwarded to the `fetchPage` callback, enabling cancellation of in-flight HTTP requests.

---

### `paginateOffsetAsync<T>(fetchPage, options?): AsyncIterable<T>`

Streams items using offset-based pagination via async generator.

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `fetchPage` | `(offset: number, limit: number, signal: AbortSignal \| undefined) => Promise<OffsetPageResult<T> \| unknown>` | Function that fetches a page given offset, limit, and signal |
| `options.offset` | `number` | Starting offset (default: `0`) |
| `options.limit` | `number` | Items per page (default: `50`) |
| `options.pageSize` | `number` | Alias for `limit` |
| `options.maxPages` | `number` | Maximum pages to fetch |
| `options.maxItems` | `number` | Maximum total items to yield |
| `options.itemSchema` | `ZodType<T>` | Optional Zod schema for item validation |
| `options.signal` | `AbortSignal` | Cancel pagination when aborted (forwarded to fetchPage) |

**Returns:** `AsyncIterable<T>` - Async iterable yielding items one at a time

**Note:** The signal is forwarded to the `fetchPage` callback, enabling cancellation of in-flight HTTP requests.

---

### `queryRecords<T>(input): Promise<T[]> | AsyncIterable<T>`

Queries records with optional auto-pagination.

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `input.client` | `Client` | Attio client instance |
| `input.object` | `string` | Object API slug (e.g., `'companies'`) |
| `input.filter` | `AttioFilter` | Optional filter criteria |
| `input.sorts` | `RecordSorts` | Optional sort criteria |
| `input.limit` | `number` | Items per page |
| `input.offset` | `number` | Starting offset |
| `input.paginate` | `boolean \| 'stream'` | Pagination mode |
| `input.maxPages` | `number` | Maximum pages (when paginating) |
| `input.maxItems` | `number` | Maximum items (when paginating) |
| `input.signal` | `AbortSignal` | Cancel signal (stream mode only) |
| `input.itemSchema` | `ZodType<T>` | Optional Zod schema for item validation |

**Returns:**
- `Promise<T[]>` when `paginate` is `undefined`, `false`, or `true`
- `AsyncIterable<T>` when `paginate` is `'stream'`

---

### `queryListEntries<T>(input): Promise<T[]> | AsyncIterable<T>`

Queries list entries with optional auto-pagination.

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `input.client` | `Client` | Attio client instance |
| `input.list` | `string` | List API slug or ID |
| `input.filter` | `AttioFilter` | Optional filter criteria |
| `input.limit` | `number` | Items per page |
| `input.offset` | `number` | Starting offset |
| `input.paginate` | `boolean \| 'stream'` | Pagination mode |
| `input.maxPages` | `number` | Maximum pages (when paginating) |
| `input.maxItems` | `number` | Maximum items (when paginating) |
| `input.signal` | `AbortSignal` | Cancel signal (stream mode only) |
| `input.itemSchema` | `ZodType<T>` | Optional Zod schema for item validation |

**Returns:**
- `Promise<T[]>` when `paginate` is `undefined`, `false`, or `true`
- `AsyncIterable<T>` when `paginate` is `'stream'`

---

## Related Resources

- [Attio API Pagination Documentation](https://docs.attio.com/docs/pagination)
- [SDK README - Pagination Helpers](../README.md#pagination-helpers)
