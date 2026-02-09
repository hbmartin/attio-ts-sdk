# Bulk Queries

This guide covers patterns for retrieving multiple records at once from Attio, including fetching people by a list of IDs, bulk filtering, and efficiently processing large result sets.

## Table of Contents

- [Setup](#setup)
- [Request People by ID](#request-people-by-id)
- [Bulk Filter Queries](#bulk-filter-queries)
- [Processing Large Result Sets](#processing-large-result-sets)
- [Type-Safe Bulk Results with Zod](#type-safe-bulk-results-with-zod)
- [Bulk Operations on List Entries](#bulk-operations-on-list-entries)
- [When to Use Each Approach](#when-to-use-each-approach)

---

## Setup

### Using the SDK wrapper

```typescript
import { createAttioSdk, filters } from 'attio-ts-sdk';

const sdk = createAttioSdk({ apiKey: process.env.ATTIO_API_KEY });
```

### Using standalone functions

```typescript
import { createAttioClient, queryRecords, getRecord, filters } from 'attio-ts-sdk';

const client = createAttioClient({ apiKey: process.env.ATTIO_API_KEY });
```

---

## Request People by ID

### Fetch multiple people by record ID with `$in`

The `$in` operator lets you query for multiple people by their record IDs in a single request:

```typescript
const recordIds = [
  '000e8881-37cc-41d2-bc22-39fe35e76e6b',
  '592dc9d8-548b-4148-813f-1259055ca83c',
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
];

const people = await sdk.records.query({
  object: 'people',
  filter: filters.in('record_id', recordIds),
});
```

Or with a standalone function:

```typescript
const people = await queryRecords({
  client,
  object: 'people',
  filter: filters.in('record_id', recordIds),
});
```

### Using raw filter syntax

The same query expressed as a raw filter object:

```typescript
const people = await sdk.records.query({
  object: 'people',
  filter: {
    record_id: {
      $in: [
        '000e8881-37cc-41d2-bc22-39fe35e76e6b',
        '592dc9d8-548b-4148-813f-1259055ca83c',
        'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      ],
    },
  },
});
```

### Fetch a single person by ID

When you only need one record and already have the ID, `getRecord` is more direct:

```typescript
const person = await sdk.records.get({
  object: 'people',
  recordId: 'abc-123',
});
```

### Combining ID filtering with other conditions

You can combine `$in` with other filters to narrow down results from a known set of IDs:

```typescript
// From a batch of IDs, find only the engineers
const people = await sdk.records.query({
  object: 'people',
  filter: filters.and(
    filters.in('record_id', recordIds),
    filters.contains('job_title', 'Engineer'),
  ),
});
```

---

## Bulk Filter Queries

### Collect all matching records

Set `paginate: true` to automatically retrieve every page of results into a single array:

```typescript
const allEngineers = await sdk.records.query({
  object: 'people',
  filter: filters.contains('job_title', 'Engineer'),
  paginate: true,
  maxItems: 5000,  // safety cap
});
```

### Bulk query by email domain

```typescript
const attioEmployees = await sdk.records.query({
  object: 'people',
  filter: {
    email_addresses: {
      email_domain: { $eq: 'attio.com' },
    },
  },
  paginate: true,
});
```

### Bulk query by location

```typescript
// All people in the US or UK
const people = await sdk.records.query({
  object: 'people',
  filter: filters.or(
    { primary_location: { country_code: { $eq: 'US' } } },
    { primary_location: { country_code: { $eq: 'UK' } } },
  ),
  paginate: true,
});
```

### Bulk query with sorting

```typescript
const people = await sdk.records.query({
  object: 'people',
  filter: filters.notEmpty('email_addresses'),
  sorts: [
    { attribute: 'name', field: 'last_name', direction: 'asc' },
  ],
  paginate: true,
});
```

---

## Processing Large Result Sets

### Streaming (memory-efficient)

For large datasets, use `paginate: 'stream'` to process records one at a time without loading everything into memory:

```typescript
for await (const person of sdk.records.query({
  object: 'people',
  filter: filters.notEmpty('email_addresses'),
  paginate: 'stream',
})) {
  await processRecord(person);
}
```

### Streaming with cancellation

Use an `AbortSignal` to cancel long-running bulk queries:

```typescript
const controller = new AbortController();
setTimeout(() => controller.abort(), 30000); // 30s timeout

try {
  for await (const person of sdk.records.query({
    object: 'people',
    paginate: 'stream',
    signal: controller.signal,
  })) {
    await processRecord(person);
  }
} catch (error) {
  if (controller.signal.aborted) {
    console.log('Bulk query cancelled');
  }
}
```

### Capping results

Limit the total number of records fetched across all pages:

```typescript
// Stop after 1000 records regardless of total matches
const people = await sdk.records.query({
  object: 'people',
  filter: filters.contains('job_title', 'Engineer'),
  paginate: true,
  maxItems: 1000,
});

// Or stop after a certain number of pages
const people = await sdk.records.query({
  object: 'people',
  paginate: true,
  maxPages: 10,
});
```

---

## Type-Safe Bulk Results with Zod

Pass an `itemSchema` to get compile-time types backed by runtime validation on every record in the bulk result:

```typescript
import { z } from 'zod';

const personSchema = z.object({
  id: z.object({ record_id: z.string() }),
  values: z.object({
    name: z.array(z.object({
      first_name: z.string().nullable(),
      last_name: z.string().nullable(),
      full_name: z.string(),
    })),
    email_addresses: z.array(z.object({
      email_address: z.string(),
    })),
  }),
});

// Bulk fetch by IDs with typed results
const people = await sdk.records.query({
  object: 'people',
  filter: filters.in('record_id', recordIds),
  itemSchema: personSchema,
});
// people: Array<{ id: { record_id: string }, values: { name: ..., email_addresses: ... } }>

// Works with all pagination modes
for await (const person of sdk.records.query({
  object: 'people',
  filter: filters.in('record_id', recordIds),
  paginate: 'stream',
  itemSchema: personSchema,
})) {
  // person.values.name[0].full_name is typed as string
}
```

---

## Bulk Operations on List Entries

Query people entries within a list using the same bulk patterns:

```typescript
// All candidates in the interview stage
const candidates = await sdk.lists.queryEntries({
  list: 'hiring-pipeline',
  filter: filters.eq('stage', 'Interview'),
  paginate: true,
});

// Stream all list entries
for await (const entry of sdk.lists.queryEntries({
  list: 'hiring-pipeline',
  paginate: 'stream',
})) {
  await processCandidate(entry);
}
```

### Filter list entries by parent person properties

Use path-based filters to query list entries based on properties of the linked person:

```typescript
// Candidates whose person record has an @apple.com email
const appleCandidates = await sdk.lists.queryEntries({
  list: 'hiring-pipeline',
  filter: filters.path(
    [
      ['hiring-pipeline', 'parent_record'],
      ['people', 'email_addresses'],
    ],
    { email_domain: 'apple.com' },
  ),
  paginate: true,
});
```

---

## When to Use Each Approach

| Scenario | Approach |
|----------|----------|
| Fetch 1 person by known ID | `sdk.records.get()` |
| Fetch 2-100 people by known IDs | `sdk.records.query()` with `filters.in('record_id', ids)` |
| Fetch all people matching a condition | `sdk.records.query()` with `paginate: true` |
| Process a large result set without loading it all into memory | `sdk.records.query()` with `paginate: 'stream'` |
| Preview results or fetch a small page | `sdk.records.query()` with `limit` (default single-page mode) |
| Query people within a list context | `sdk.lists.queryEntries()` |

---

## Related Resources

- [Querying People](./querying-people.md)
- [Filtering and Sorting Guide](./filters.md)
- [Pagination Guide](./pagination.md)
- [SDK README](../README.md)
