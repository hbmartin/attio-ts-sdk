# Type-Safe Record Values

The SDK provides built-in mechanisms for extracting typed values from Attio records. You should **not** need to write your own helper functions to unwrap `AttioRecordLike` — everything is handled through Zod schemas at the query boundary or via value accessor functions.

## Table of Contents

- [The Problem](#the-problem)
- [Approach 1: Schema at the Query Boundary (Recommended)](#approach-1-schema-at-the-query-boundary-recommended)
- [Approach 2: Value Extraction Helpers](#approach-2-value-extraction-helpers)
- [Approach 3: Schema Accessors](#approach-3-schema-accessors)
- [Writing Values with the `value` Factory](#writing-values-with-the-value-factory)
- [Common Schemas](#common-schemas)
- [Anti-Patterns](#anti-patterns)

---

## The Problem

Without type information, record values are `unknown`:

```typescript
const companies = await sdk.records.query({ object: 'companies' });
// companies: AttioRecordLike[]

const name = companies[0].values?.name;
// name: unknown — no type safety
```

The SDK solves this in three ways, each suited to different use cases.

---

## Approach 1: Schema at the Query Boundary (Recommended)

Pass an `itemSchema` to any query, CRUD, or search function. The SDK validates every record against the schema at runtime and infers the return type at compile time.

```typescript
import { z } from 'zod';
import { queryRecords } from 'attio-ts-sdk';

const companySchema = z.object({
  id: z.object({ record_id: z.string() }),
  values: z.object({
    name: z.array(z.object({ value: z.string() })),
    domains: z.array(z.object({ domain: z.string() })),
    team_size: z.array(z.object({ value: z.number() })).optional(),
  }),
});

type Company = z.infer<typeof companySchema>;

const companies = await queryRecords({
  client,
  object: 'companies',
  itemSchema: companySchema,
  paginate: true,
});
// companies: Company[] — fully typed, validated at runtime

// Direct property access with full type safety
const name = companies[0].values.name[0].value; // string
const domain = companies[0].values.domains[0].domain; // string
```

This works on every record operation:

| Function | Returns with `itemSchema` |
|---|---|
| `queryRecords` | `Promise<T[]>` or `AsyncIterable<T>` |
| `searchRecords` | `Promise<T[]>` |
| `queryListEntries` | `Promise<T[]>` or `AsyncIterable<T>` |
| `getRecord` | `Promise<T>` |
| `createRecord` | `Promise<T>` |
| `updateRecord` | `Promise<T>` |
| `upsertRecord` | `Promise<T>` |

### Streaming with schemas

Schemas work with all pagination modes:

```typescript
for await (const company of queryRecords({
  client,
  object: 'companies',
  paginate: 'stream',
  itemSchema: companySchema,
})) {
  // company: Company — typed on each iteration
  console.log(company.values.name[0].value);
}
```

### Schema tips

- Use `.optional()` on value arrays that may not exist on every record.
- Use `.passthrough()` on the root object if you want to access fields not in the schema without losing them.
- Start with a strict schema and loosen as needed — runtime validation errors tell you exactly which field mismatched.

---

## Approach 2: Value Extraction Helpers

When you have an `AttioRecordLike` and need to extract a single attribute, use `getValue` or `getFirstValue`:

```typescript
import { getFirstValue, getValue } from 'attio-ts-sdk';
```

### Untyped extraction

```typescript
const record = companies[0];

// Get all values for an attribute
const allEmails = getValue(record, 'email_addresses');
// allEmails: unknown[] | undefined

// Get just the first value
const primaryEmail = getFirstValue(record, 'email_addresses');
// primaryEmail: unknown | undefined
```

### Typed extraction with a Zod schema

Pass a `schema` option to get validated, typed results:

```typescript
const emailValueSchema = z.object({
  email_address: z.string(),
  email_domain: z.string(),
});

const emails = getValue(record, 'email_addresses', {
  schema: emailValueSchema,
});
// emails: { email_address: string; email_domain: string }[] | undefined

const primaryEmail = getFirstValue(record, 'email_addresses', {
  schema: emailValueSchema,
});
// primaryEmail: { email_address: string; email_domain: string } | undefined
```

If any value fails validation, an `AttioResponseError` is thrown with code `INVALID_VALUE`.

---

## Approach 3: Schema Accessors

For metadata-driven access — when you want to discover available attributes at runtime — use `createSchema`:

```typescript
import { createSchema } from 'attio-ts-sdk';

const schema = await createSchema({
  client,
  target: 'objects',
  identifier: 'companies',
});

// List available attributes
console.log(schema.attributeSlugs);
// ['name', 'domains', 'team_size', ...]

// Create a bound accessor for a specific attribute
const nameAccessor = schema.getAccessorOrThrow('name');

// Untyped extraction
const name = nameAccessor.getFirstValue(record);
// name: unknown | undefined

// Typed extraction
const nameValueSchema = z.object({ value: z.string() });
const typedName = nameAccessor.getFirstValueAs(record, {
  schema: nameValueSchema,
});
// typedName: { value: string } | undefined
```

### Accessor API

| Method | Returns |
|---|---|
| `accessor.getValue(record)` | `unknown[] \| undefined` |
| `accessor.getFirstValue(record)` | `unknown \| undefined` |
| `accessor.getValueAs(record, { schema })` | `T[] \| undefined` |
| `accessor.getFirstValueAs(record, { schema })` | `T \| undefined` |

### Schema API

| Method | Returns |
|---|---|
| `schema.attributes` | `ZodAttribute[]` — all attributes |
| `schema.attributeSlugs` | `string[]` — all attribute slugs |
| `schema.getAttribute(slug)` | `ZodAttribute \| undefined` |
| `schema.getAttributeOrThrow(slug)` | `ZodAttribute` (throws if missing) |
| `schema.getAccessor(slug)` | `AttributeAccessor \| undefined` |
| `schema.getAccessorOrThrow(slug)` | `AttributeAccessor` (throws if missing) |

---

## Writing Values with the `value` Factory

When creating or updating records, use the `value` factory for validated input construction:

```typescript
import { value } from 'attio-ts-sdk';

await sdk.records.create({
  object: 'companies',
  values: {
    name: value.string('Acme Corp'),
    domains: value.domain('acme.com'),
    annual_revenue: value.currency(1_000_000, 'USD'),
  },
});
```

### Available factories

| Factory | Input | Validates |
|---|---|---|
| `value.string(v)` | `string` | Non-empty string |
| `value.number(v)` | `number` | Finite number |
| `value.boolean(v)` | `boolean` | Boolean |
| `value.domain(v)` | `string` | Non-empty string |
| `value.email(v)` | `string` | Valid email format |
| `value.currency(v, code?)` | `number, string?` | Finite number, ISO 4217 code |

Each factory returns `ValueInput[]` — the format the Attio API expects for attribute values.

---

## Common Schemas

### Person

```typescript
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
    job_title: z.array(z.object({ value: z.string() })).optional(),
  }),
});
```

### Company

```typescript
const companySchema = z.object({
  id: z.object({ record_id: z.string() }),
  values: z.object({
    name: z.array(z.object({ value: z.string() })),
    domains: z.array(z.object({
      domain: z.string(),
      root_domain: z.string(),
    })),
    description: z.array(z.object({ value: z.string() })).optional(),
  }),
});
```

### Minimal (ID only)

```typescript
const idOnlySchema = z.object({
  id: z.object({ record_id: z.string() }),
}).passthrough();
```

---

## Anti-Patterns

### Don't: Write manual unwrapping helpers

```typescript
// ❌ Don't do this
function getCompanyName(record: AttioRecordLike): string {
  const values = record.values as Record<string, unknown[]>;
  const name = values?.name?.[0] as { value: string };
  return name?.value ?? '';
}

// ✅ Do this instead — schema at the query boundary
const companies = await queryRecords({
  client,
  object: 'companies',
  itemSchema: companySchema,
});
const name = companies[0].values.name[0].value;

// ✅ Or use getFirstValue for ad-hoc extraction
const name = getFirstValue(record, 'name', {
  schema: z.object({ value: z.string() }),
});
```

### Don't: Cast `values` with `as`

```typescript
// ❌ Type assertions hide runtime errors
const email = (record.values as any).email_addresses[0].email_address;

// ✅ Zod validates at runtime and infers at compile time
const email = getFirstValue(record, 'email_addresses', {
  schema: z.object({ email_address: z.string() }),
});
```

### Don't: Build type-narrowing wrappers around AttioRecordLike

```typescript
// ❌ Redundant — the SDK already does this
function isCompanyRecord(r: AttioRecordLike): r is CompanyRecord {
  return 'name' in (r.values ?? {});
}

// ✅ Pass a schema and let Zod do the narrowing
const companies = await queryRecords({
  client,
  object: 'companies',
  itemSchema: companySchema, // validates + narrows in one step
});
```

---

## Related Resources

- [Filtering and Sorting Guide](./filters.md)
- [Pagination Guide](./pagination.md)
- [Querying People Guide](./querying-people.md)
