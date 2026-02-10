# Querying People

This guide covers the higher-level functions available for retrieving people records from Attio. All examples assume you have an SDK instance or a configured client.

## Table of Contents

- [Setup](#setup)
- [Query People with `queryRecords`](#query-people-with-queryrecords)
- [Search People with `searchRecords`](#search-people-with-searchrecords)
- [Get a Single Person](#get-a-single-person)
- [Query People in Lists](#query-people-in-lists)
- [Type-Safe Results with Zod](#type-safe-results-with-zod)
- [Common People Filters](#common-people-filters)

---

## Setup

### Using the SDK wrapper

```typescript
import { createAttioSdk } from 'attio-ts-sdk';

const sdk = createAttioSdk({ apiKey: process.env.ATTIO_API_KEY });
```

### Using standalone functions

```typescript
import { createAttioClient, queryRecords, searchRecords, getRecord } from 'attio-ts-sdk';

const client = createAttioClient({ apiKey: process.env.ATTIO_API_KEY });
```

---

## Query People with `queryRecords`

`queryRecords` is the primary way to retrieve people. It supports filters, sorting, and three pagination modes.

### Single page (default)

Returns the first page of results as `Promise<AttioRecordLike[]>`:

```typescript
const people = await sdk.records.query({
  object: 'people',
  limit: 25,
});
```

### Collect all pages

Set `paginate: true` to automatically fetch every page into a single array:

```typescript
const allPeople = await sdk.records.query({
  object: 'people',
  paginate: true,
  maxItems: 5000,  // safety cap
});
```

### Stream results

Set `paginate: 'stream'` to get an `AsyncIterable` that yields one record at a time, keeping only one page in memory:

```typescript
for await (const person of queryRecords({
  client,
  object: 'people',
  paginate: 'stream',
  signal: controller.signal,
})) {
  console.log(person.id);
}
```

### With filters and sorting

```typescript
import { filters } from 'attio-ts-sdk';

const engineers = await sdk.records.query({
  object: 'people',
  filter: filters.and(
    filters.contains('job_title', 'Engineer'),
    filters.notEmpty('email_addresses'),
  ),
  sorts: [
    { attribute: 'name', field: 'last_name', direction: 'asc' },
  ],
  paginate: true,
});
```

### Pagination options

| Option | Type | Description |
|--------|------|-------------|
| `paginate` | `false \| true \| 'stream'` | Pagination mode (default: `false`) |
| `limit` | `number` | Items per page (default: 50) |
| `offset` | `number` | Starting offset |
| `maxPages` | `number` | Stop after N pages |
| `maxItems` | `number` | Stop after N total items |
| `signal` | `AbortSignal` | Cancel in-flight requests |

---

## Search People with `searchRecords`

`searchRecords` performs a full-text search across record fields. Use it when you have a free-form query string rather than structured filters.

```typescript
import { searchRecords } from 'attio-ts-sdk';

const results = await searchRecords({
  client,
  query: 'john doe',
  objects: ['people'],
  limit: 20,
});
```

### Search input

| Option | Type | Description |
|--------|------|-------------|
| `query` | `string` | Free-text search query |
| `objects` | `string[]` | Object types to search (e.g., `['people']`) |
| `limit` | `number` | Maximum results to return |
| `requestAs` | `{ type: 'workspace' }` | Request context (defaults to workspace) |
| `itemSchema` | `ZodType<T>` | Optional Zod schema for typed results |

### When to use search vs. query

| Scenario | Use |
|----------|-----|
| You have a user-typed search box | `searchRecords` |
| You need exact field-level conditions | `queryRecords` with `filter` |
| You need pagination over large result sets | `queryRecords` with `paginate` |
| You need sorting control | `queryRecords` with `sorts` |

---

## Get a Single Person

When you already have a record ID, use `getRecord`:

```typescript
const person = await sdk.records.get({
  object: 'people',
  recordId: 'abc-123',
});
```

Or with a standalone function:

```typescript
import { getRecord } from 'attio-ts-sdk';

const person = await getRecord({
  client,
  object: 'people',
  recordId: 'abc-123',
});
```

---

## Query People in Lists

People can appear as entries in Attio lists. Use `queryListEntries` to query them within a specific list context. The same three pagination modes (single, collect, stream) are available.

```typescript
import { filters } from 'attio-ts-sdk';

// All active candidates in a hiring pipeline
const candidates = await sdk.lists.queryEntries({
  list: 'hiring-pipeline',
  filter: filters.eq('stage', 'Interview'),
  paginate: true,
});
```

### Path-based filters on list entries

Use `filters.path()` to filter list entries based on the properties of the linked person:

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

## Type-Safe Results with Zod

By default, all query functions return `AttioRecordLike[]`. Pass an `itemSchema` to get compile-time types backed by runtime validation:

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

// Typed and validated at runtime
const people = await queryRecords({
  client,
  object: 'people',
  paginate: true,
  itemSchema: personSchema,
});
// people: Array<z.infer<typeof personSchema>>

// Works with all query modes
for await (const person of queryRecords({
  client,
  object: 'people',
  paginate: 'stream',
  itemSchema: personSchema,
})) {
  // person.values.name[0].full_name is typed as string
}
```

This works with `searchRecords` and `queryListEntries` as well.

---

## Common People Filters

These examples use the `filters` helper object. See the [Filtering Guide](./filters.md) for the full operator reference.

### By name

```typescript
// Shorthand equality
filters.eq('name', 'Jane Smith')

// First name only (verbose)
{ name: { first_name: { $eq: 'Jane' } } }

// Last name contains
{ name: { last_name: { $contains: 'Smith' } } }
```

### By email

```typescript
// Exact address
{ email_addresses: 'jane@example.com' }

// By domain
{ email_addresses: { email_domain: { $eq: 'attio.com' } } }

// Has any email
filters.notEmpty('email_addresses')
```

### By phone

```typescript
// Starts with country code
{ phone_numbers: { $starts_with: '+1' } }

// Has any phone
filters.notEmpty('phone_numbers')
```

### By job title

```typescript
filters.contains('job_title', 'Engineer')
filters.endsWith('job_title', 'Director')
```

### By location

```typescript
// City
{ primary_location: { locality: { $contains: 'London' } } }

// Country
{ primary_location: { country_code: { $eq: 'US' } } }
```

### By company

```typescript
{
  company: {
    target_object: 'companies',
    target_record_id: '[company-record-id]',
  },
}
```

### Combining filters

```typescript
// Engineers in the US with a LinkedIn profile
const filter = filters.and(
  filters.contains('job_title', 'Engineer'),
  { primary_location: { country_code: { $eq: 'US' } } },
  filters.notEmpty('linkedin'),
);

const people = await sdk.records.query({
  object: 'people',
  filter,
  paginate: true,
});
```

---

## Related Resources

- [Filtering and Sorting Guide](./filters.md)
- [Pagination Guide](./pagination.md)
- [SDK README](../README.md)
