# Filtering and Sorting Guide

The Attio API provides powerful filtering and sorting capabilities for querying records and list entries. This SDK provides helper functions to construct filter objects, though you can also use raw filter objects directly.

## Table of Contents

- [Filter Helpers](#filter-helpers)
- [Shorthand Filters](#shorthand-filters)
- [Verbose Filters](#verbose-filters)
- [Comparison Operators](#comparison-operators)
- [Logical Operators](#logical-operators)
- [Filtering by Attribute Type](#filtering-by-attribute-type)
- [Filtering People Records](#filtering-people-records)
- [Path-Based Filtering](#path-based-filtering)
- [Sorting](#sorting)
- [SDK Implementation Status](#sdk-implementation-status)

---

## Filter Helpers

The SDK provides a `filters` object with helper functions to construct filter objects:

```typescript
import { filters } from 'attio-ts-sdk';

// Simple equality filter
const filter = filters.eq('name', 'Acme');
// { name: { $eq: 'Acme' } }

// Combine with logical operators
const complexFilter = filters.and(
  filters.eq('status', 'active'),
  filters.contains('name', 'Inc'),
  filters.not(filters.eq('type', 'archived'))
);
```

### Available Helper Functions

| Helper | Signature | Output | API Operator |
|--------|-----------|--------|--------------|
| `eq` | `(field: string, value: FilterValue)` | `{ [field]: { $eq: value } }` | `$eq` |
| `contains` | `(field: string, value: string)` | `{ [field]: { $contains: value } }` | `$contains` |
| `startsWith` | `(field: string, value: string)` | `{ [field]: { $starts_with: value } }` | `$starts_with` |
| `endsWith` | `(field: string, value: string)` | `{ [field]: { $ends_with: value } }` | `$ends_with` |
| `notEmpty` | `(field: string)` | `{ [field]: { $not_empty: true } }` | `$not_empty` |
| `lt` | `(field: string, value: FilterValue)` | `{ [field]: { $lt: value } }` | `$lt` |
| `lte` | `(field: string, value: FilterValue)` | `{ [field]: { $lte: value } }` | `$lte` |
| `gt` | `(field: string, value: FilterValue)` | `{ [field]: { $gt: value } }` | `$gt` |
| `gte` | `(field: string, value: FilterValue)` | `{ [field]: { $gte: value } }` | `$gte` |
| `in` | `(field: string, values: FilterValue[])` | `{ [field]: { $in: values } }` | `$in` |
| `between` | `(field: string, min: FilterValue, max: FilterValue)` | `{ [field]: { $gte: min, $lt: max } }` | Range |
| `and` | `(...conditions: AttioFilter[])` | `{ $and: conditions }` | `$and` |
| `or` | `(...conditions: AttioFilter[])` | `{ $or: conditions }` | `$or` |
| `not` | `(condition: AttioFilter)` | `{ $not: condition }` | `$not` |
| `path` | `(segments: PathSegment[], constraints: AttributeLevelFilter)` | `{ path, constraints }` | Path filter |

**Type Definitions:**
- `FilterValue = string | number | boolean | null`
- `PathSegment = [objectSlug: string, attributeSlug: string]`
- `AttributeLevelFilter` - Attribute conditions with optional logical operators (no nested paths)

---

## Shorthand Filters

The simplest way to filter is using shorthand syntax, which performs equality checks:

```typescript
// Shorthand: People called "John Smith" with email "john@smith.com"
const filter = {
  name: 'John Smith',
  email_addresses: 'john@smith.com'
};

const people = await sdk.records.query({
  object: 'people',
  filter,
});
```

Multiple fields in a shorthand filter are implicitly combined with `$and`.

---

## Verbose Filters

Verbose filters allow you to specify operators and query specific properties of attribute values:

```typescript
// Verbose: Same filter as above, but explicit
const filter = {
  $and: [
    {
      name: {
        full_name: {
          $eq: 'John Smith'
        }
      }
    },
    {
      email_addresses: {
        email_address: {
          $eq: 'john@smith.com'
        }
      }
    }
  ]
};
```

### Nested Attribute Fields

Many attribute types have multiple sub-fields you can filter on. For example, an email address value has:

- `email_address` - The email address
- `original_email_address` - The raw, original email
- `email_domain` - The domain part (e.g., `attio.com`)
- `email_root_domain` - The root domain (e.g., `attio.com`)
- `email_local_specifier` - The local part (e.g., `alice`)

```typescript
// Find people with @apple.com email addresses
const filter = {
  email_addresses: {
    email_domain: {
      $eq: 'apple.com'
    }
  }
};
```

---

## Comparison Operators

### Equality (`$eq`)

The most common operator, supported by every attribute type:

```typescript
// Using helper
filters.eq('status', 'active')

// Raw object
{ status: { $eq: 'active' } }
```

### Not Empty (`$not_empty`)

Check if an attribute has any value:

```typescript
// Using helper
filters.notEmpty('phone_numbers')

// Raw object
{ phone_numbers: { $not_empty: true } }
```

### Set Membership (`$in`)

Check if a value is in a set (useful for `record_id` or text fields):

```typescript
// Using helper
filters.in('record_id', [
  '000e8881-37cc-41d2-bc22-39fe35e76e6b',
  '592dc9d8-548b-4148-813f-1259055ca83c'
])

// Raw object
{
  record_id: {
    $in: [
      '000e8881-37cc-41d2-bc22-39fe35e76e6b',
      '592dc9d8-548b-4148-813f-1259055ca83c'
    ]
  }
}
```

### String Comparisons

For string-like properties:

```typescript
// Contains (case-insensitive)
filters.contains('name', 'Apple')
// { name: { $contains: 'Apple' } }

// Starts with
filters.startsWith('phone_numbers', '+44')
// { phone_numbers: { $starts_with: '+44' } }

// Ends with
filters.endsWith('job_title', 'Engineer')
// { job_title: { $ends_with: 'Engineer' } }

// Combine on same property (logical AND)
{
  phone_numbers: {
    $starts_with: '+44',
    $ends_with: '798'
  }
}
```

### Numeric and Date Comparisons

For numeric, currency, date, timestamp, and rating fields:

```typescript
// Using helpers
filters.gte('twitter_follower_count', 1000)
// { twitter_follower_count: { $gte: 1000 } }

// Between two values (inclusive min, exclusive max)
filters.between('twitter_follower_count', 100, 200)
// { twitter_follower_count: { $gte: 100, $lt: 200 } }

// Date ranges
filters.and(
  filters.gte('foundation_date', '2019-01-01'),
  filters.lte('foundation_date', '2019-12-31')
)

// Raw object for date range
{
  foundation_date: {
    $gte: '2019-01-01',
    $lte: '2019-12-31'
  }
}
```

**Numeric/Date Operators:**

| Operator | Description |
|----------|-------------|
| `$lt` | Less than (exclusive) |
| `$lte` | Less than or equal |
| `$gt` | Greater than (exclusive) |
| `$gte` | Greater than or equal |

---

## Logical Operators

### `$and`

All conditions must match:

```typescript
// Using helper
filters.and(
  filters.eq('status', 'active'),
  filters.notEmpty('email_addresses')
)

// Raw object
{
  $and: [
    { status: { $eq: 'active' } },
    { email_addresses: { $not_empty: true } }
  ]
}
```

### `$or`

At least one condition must match:

```typescript
// Using helper
filters.or(
  filters.eq('stage', 'One'),
  filters.eq('stage', 'Two')
)

// Raw object
{
  $or: [
    { stage: { $eq: 'One' } },
    { stage: { $eq: 'Two' } }
  ]
}
```

### `$not`

Negate a condition:

```typescript
// Using helper
filters.not(filters.eq('status', 'archived'))

// Raw object
{
  $not: {
    status: { $eq: 'archived' }
  }
}
```

### Complex Combinations

```typescript
// Companies with "Apple" in name that don't use apple.com domain
const filter = filters.and(
  filters.contains('name', 'Apple'),
  filters.not({
    domains: {
      root_domain: { $eq: 'apple.com' }
    }
  })
);

// Deals owned by Alice or Bob worth more than $500
const filter = {
  $and: [
    {
      $or: [
        {
          owner: {
            referenced_actor_type: 'workspace-member',
            referenced_actor_id: '[alices-id]'
          }
        },
        {
          owner: {
            referenced_actor_type: 'workspace-member',
            referenced_actor_id: '[bobs-id]'
          }
        }
      ]
    },
    {
      value: { $gt: 500 }
    }
  ]
};
```

---

## Filtering by Attribute Type

Different attribute types support different operators. Here's the complete matrix:

| Attribute Type | `$eq` | `$in` | `$not_empty` | `$contains` | `$starts_with` | `$ends_with` | `$lt` | `$lte` | `$gt` | `$gte` |
|----------------|:-----:|:-----:|:------------:|:-----------:|:--------------:|:------------:|:-----:|:------:|:-----:|:------:|
| Actor reference | ✓ | | | | | | | | | |
| Checkbox | ✓ | | | | | | | | | |
| Currency | ✓ | | | | | | ✓ | ✓ | ✓ | ✓ |
| Date | ✓ | | | | | | ✓ | ✓ | ✓ | ✓ |
| Domain | ✓ | | ✓ | ✓ | ✓ | ✓ | | | | |
| Email address | ✓ | | | ✓ | ✓ | ✓ | | | | |
| Interaction | ✓ | | ✓ | | | | ✓ | ✓ | ✓ | ✓ |
| Location | ✓ | | | ✓ | ✓ | ✓ | | | | |
| Number | ✓ | | | | | | ✓ | ✓ | ✓ | ✓ |
| Personal name | ✓ | | ✓ | ✓ | ✓ | ✓ | | | | |
| Phone number | ✓ | | ✓ | ✓ | ✓ | ✓ | | | | |
| Rating | ✓ | | | | | | ✓ | ✓ | ✓ | ✓ |
| Record reference | ✓ | ✓ | | | | | | | | |
| Select | ✓ | | | | | | | | | |
| Status | ✓ | | | | | | | | | |
| Text | ✓ | ✓ | | ✓ | ✓ | ✓ | | | | |
| Timestamp | ✓ | | | | | | ✓ | ✓ | ✓ | ✓ |

---

## Filtering People Records

The Person object has several standard attributes you can filter on:

### By Name

```typescript
// Shorthand - full name match
const filter = { name: 'John Smith' };

// Verbose - by first name only
const filter = {
  name: {
    first_name: { $eq: 'John' }
  }
};

// Verbose - by last name only
const filter = {
  name: {
    last_name: { $eq: 'Smith' }
  }
};

// Contains in full name
const filter = {
  name: {
    full_name: { $contains: 'Smith' }
  }
};

// People NOT named John
const filter = filters.not({
  name: {
    first_name: { $eq: 'John' }
  }
});
```

### By Email

```typescript
// Exact email match
const filter = { email_addresses: 'john@example.com' };

// By domain
const filter = {
  email_addresses: {
    email_domain: { $eq: 'apple.com' }
  }
};

// By root domain (ignores subdomains)
const filter = {
  email_addresses: {
    email_root_domain: { $eq: 'attio.com' }
  }
};

// Email contains string
const filter = {
  email_addresses: {
    email_address: { $contains: '@attio' }
  }
};
```

### By Phone Number

```typescript
// Phone numbers starting with UK code
const filter = {
  phone_numbers: { $starts_with: '+44' }
};

// Has any phone number
const filter = filters.notEmpty('phone_numbers');
```

### By Location

```typescript
// People in New York
const filter = {
  primary_location: {
    locality: { $contains: 'New York' }
  }
};

// People in California
const filter = {
  primary_location: {
    region: { $eq: 'CA' }
  }
};

// People in the US
const filter = {
  primary_location: {
    country_code: { $eq: 'US' }
  }
};
```

### By Job Title

```typescript
// Exact job title
const filter = { job_title: 'Software Engineer' };

// Job title contains
const filter = filters.contains('job_title', 'Engineer');

// Job title ends with
const filter = filters.endsWith('job_title', 'Manager');
```

### By Company (Record Reference)

```typescript
// People at a specific company
const filter = {
  company: {
    target_object: 'companies',
    target_record_id: '[company-record-id]'
  }
};
```

### By Social Profiles

```typescript
// Has LinkedIn profile
const filter = filters.notEmpty('linkedin');

// Twitter followers count
const filter = {
  twitter_follower_count: { $gte: 1000 }
};
```

### Complex People Queries

```typescript
// Engineers at Apple with 1000+ Twitter followers
const filter = filters.and(
  filters.contains('job_title', 'Engineer'),
  {
    company: {
      target_object: 'companies',
      target_record_id: '[apple-company-id]'
    }
  },
  {
    twitter_follower_count: { $gte: 1000 }
  }
);

// People in NYC or SF with email at a tech company
const filter = {
  $and: [
    {
      $or: [
        { primary_location: { locality: { $contains: 'New York' } } },
        { primary_location: { locality: { $contains: 'San Francisco' } } }
      ]
    },
    {
      email_addresses: {
        email_root_domain: {
          $in: ['google.com', 'apple.com', 'microsoft.com', 'meta.com']
        }
      }
    }
  ]
};
```

---

## Path-Based Filtering

For record reference attributes, you can use path filtering to drill into related records. The SDK provides a `filters.path()` helper with type-safe constraints:

```typescript
// Using helper - List entries where the parent person has an @apple.com email
const filter = filters.path(
  [
    ['candidates', 'parent_record'],
    ['people', 'email_addresses']
  ],
  { email_domain: 'apple.com' }
);

// Raw object (equivalent)
const filter = {
  path: [
    ['candidates', 'parent_record'],
    ['people', 'email_addresses']
  ],
  constraints: {
    email_domain: 'apple.com'
  }
};

// Entries by specific record_id
const filter = {
  path: [
    ['candidates', 'parent_record'],
    ['people', 'record_id']
  ],
  constraints: {
    value: '[person-record-id]'
  }
};

// Candidates who worked at the same company as someone specific
const filter = {
  path: [
    ['candidates', 'parent_record'],
    ['people', 'company'],
    ['companies', 'team']
  ],
  constraints: {
    target_object: 'people',
    target_record_id: '[specific-person-id]'
  }
};
```

---

## Sorting

Sorting controls the order of results:

```typescript
// Sort by last name, then email
const query = {
  object: 'people',
  sorts: [
    { direction: 'asc', attribute: 'name', field: 'last_name' },
    { direction: 'desc', attribute: 'email_addresses' }
  ]
};
```

### Sort by Related Record (Path)

```typescript
// Sort people by their company name
const query = {
  object: 'people',
  sorts: [
    {
      direction: 'asc',
      path: [
        ['people', 'company'],
        ['companies', 'name']
      ]
    }
  ]
};
```

### Sort Options

| Property | Type | Description |
|----------|------|-------------|
| `direction` | `'asc'` \| `'desc'` | Sort direction |
| `attribute` | `string` | Attribute slug or ID |
| `field` | `string` | (Optional) Specific field for multi-property attributes |
| `path` | `[string, string][]` | (Optional) Path for sorting by related records |

---

## SDK Implementation Status

The SDK provides type-safe helper functions for all filter operators.

### Implemented Helpers

| Operator | Helper | Status |
|----------|--------|--------|
| `$eq` | `filters.eq()` | ✅ |
| `$contains` | `filters.contains()` | ✅ |
| `$starts_with` | `filters.startsWith()` | ✅ |
| `$ends_with` | `filters.endsWith()` | ✅ |
| `$not_empty` | `filters.notEmpty()` | ✅ |
| `$lt` | `filters.lt()` | ✅ |
| `$lte` | `filters.lte()` | ✅ |
| `$gt` | `filters.gt()` | ✅ |
| `$gte` | `filters.gte()` | ✅ |
| `$in` | `filters.in()` | ✅ |
| Range | `filters.between()` | ✅ |
| `$and` | `filters.and()` | ✅ |
| `$or` | `filters.or()` | ✅ |
| `$not` | `filters.not()` | ✅ |
| Path filters | `filters.path()` | ✅ |

### Type Safety

The SDK provides comprehensive type safety for filters:

- **`FilterValue`**: `string | number | boolean | null` - Enforces valid primitive types for filter values
- **`FieldCondition`**: Typed comparison operators with appropriate value types (e.g., `$contains` requires `string`)
- **`AttributeLevelFilter`**: Recursive type for attribute conditions with logical operators
- **`PathFilter`**: Type-safe path segments and constraints (constraints must be non-path attribute filters)
- **`AttioFilter`**: Union type covering all filter variants

```typescript
import { filters, type FilterValue, type AttioFilter } from 'attio-ts-sdk';

// Type-safe: FilterValue only accepts string | number | boolean | null
filters.eq('status', 'active');     // ✅
filters.gte('count', 100);          // ✅
filters.eq('flag', true);           // ✅

// Type-safe: String operators require string
filters.contains('name', 'Inc');    // ✅

// Type-safe: Path constraints use AttributeLevelFilter (no nested paths)
filters.path(
  [['candidates', 'parent_record'], ['people', 'email_addresses']],
  { email_domain: { $eq: 'apple.com' } }  // ✅ Full filter syntax in constraints
);
```

### Type-Safe Query Results

Query results are typed based on whether you provide an `itemSchema`. Without a schema, results are `AttioRecordLike[]`. With a schema, results are validated at runtime and the type is inferred from the schema:

```typescript
import { z } from 'zod';
import { createAttioSdk, filters } from 'attio-ts-sdk';

const sdk = createAttioSdk({ apiKey: 'your-api-key' });
const filter = filters.eq('status', 'active');

// Without schema - returns AttioRecordLike[]
const people = await sdk.records.query({
  object: 'people',
  filter,
});
// people: AttioRecordLike[]

// With schema - returns typed array with runtime validation
const personSchema = z.object({
  id: z.object({ record_id: z.string() }),
  values: z.object({
    name: z.array(z.object({ full_name: z.string() })),
    email_addresses: z.array(z.object({ email_address: z.string() })),
  }),
});

const typedPeople = await sdk.records.query({
  object: 'people',
  filter,
  itemSchema: personSchema,
});
// typedPeople: z.infer<typeof personSchema>[]
// Runtime validation ensures data matches the schema
```

This approach enforces "Make Illegal States Unrepresentable" - you can only get custom types by providing a schema that validates the data at runtime.

---

## Related Resources

- [Attio Filtering Documentation](https://docs.attio.com/docs/filtering-and-sorting)
- [Attribute Types Reference](https://docs.attio.com/docs/attribute-types)
- [SDK README](../README.md)
- [Pagination Guide](./pagination.md)
