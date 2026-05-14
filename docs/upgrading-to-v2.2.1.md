# Upgrading from `attio-ts-sdk` 2.1.0 to 2.2.1

This guide covers the changes between the git tags `attio-ts-sdk-v2.1.0`
and `attio-ts-sdk-v2.2.1`.

The upgrade is mostly additive. The highest-value changes are:

- a much larger `createAttioSdk()` surface, including notes, tasks, search,
  workspace members, `records.getMany()`, and more metadata helpers
- first-class note listing with parent record filters and pagination
- task listing filters, sorting, pagination, and typed task ID helpers
- schema-bound value reads and metadata-aware write value building
- exported Zod value schemas for common Attio attribute value shapes
- generated endpoint coverage for views, files, file upload/download, and SCIM
- safer retry defaults for non-idempotent writes
- exported branded ID factories and schemas for SDK boundary parsing
- better pagination overloads and exported offset pagination input contracts in
  2.2.1

## Install

```bash
pnpm add attio-ts-sdk@2.2.1 zod@^4
```

For local development in this repository, 2.2.1 targets Node.js `>=22` and uses
`pnpm@11.1.1`.

## Migration checklist

1. Update the package to `attio-ts-sdk@2.2.1`.
2. Run TypeScript and replace raw string casts at SDK boundaries with the new
   branded factories or exported Zod schemas.
3. Prefer `createAttioSdk({ apiKey })` or `createAttioSdk({ client })` for new
   code so you can use the expanded resource namespaces.
4. Move note code to `sdk.notes.*` or the standalone note helpers.
5. Review retry expectations for POST/PATCH/PUT/DELETE calls. These methods are
   no longer retried by default unless you opt in or send an idempotency header.
6. Use `schema.buildValues()` or the expanded `value.*` factories for record
   writes instead of hand-building value arrays.
7. Use generated endpoints directly for the new API areas that do not yet have
   convenience wrappers: views, files, file upload/download, and SCIM.
8. Run your app's typecheck and tests.

## Compatibility notes

There are no intentional runtime breaking changes in the high-level helper
layer, but stricter types may surface issues that were previously hidden.

### Branded IDs are now easier to construct

Many helper inputs already used branded IDs in 2.1.0, but 2.2.1 exports
factories and Zod schemas for those IDs. Prefer parsing at your boundary:

```typescript
import {
  createListId,
  createRecordId,
  createRecordObjectId,
  listIdSchema,
  recordIdSchema,
} from 'attio-ts-sdk';

const object = createRecordObjectId('companies');
const recordId = createRecordId(params.recordId);

const listId = listIdSchema.parse(formData.get('listId'));
const parsedRecordId = recordIdSchema.parse(params.recordId);
```

New or newly exported helpers include record, list, object, note, task, and
workspace member IDs.

### Retry behavior is safer for writes

In 2.1.0, retry handling only considered whether the error looked retryable. In
2.2.1, retry handling also considers the HTTP method. By default, only `GET`,
`HEAD`, and `OPTIONS` are retryable without additional proof that the request is
safe to replay.

For write requests that are safe to retry, use one of these approaches:

```typescript
const client = createAttioClient({
  apiKey: process.env.ATTIO_API_KEY,
  retry: {
    // Use only when your write operations are safe to replay.
    retryUnsafeRequests: true,
  },
});
```

Or pass an idempotency header on a request:

```typescript
await sdk.records.create({
  object: createRecordObjectId('companies'),
  values,
  options: {
    headers: {
      'Idempotency-Key': crypto.randomUUID(),
    },
  },
});
```

`RetryConfig` also now exposes `retryableMethods`, `retryUnsafeRequests`, and
`idempotencyHeaderNames`.

## `createAttioSdk()` additions

`createAttioSdk()` now accepts the same flat config shape as
`createAttioClient()`, as well as `{ config }` or `{ client }`:

```typescript
import { createAttioSdk } from 'attio-ts-sdk';

const sdk = createAttioSdk({
  apiKey: process.env.ATTIO_API_KEY,
});
```

The returned SDK now exposes these namespaces:

| Namespace | Methods |
| --- | --- |
| `sdk.objects` | `list`, `get`, `create`, `update` |
| `sdk.records` | `create`, `update`, `upsert`, `get`, `getMany`, `delete`, `query` |
| `sdk.lists` | `list`, `get`, `queryEntries`, `addEntry`, `updateEntry`, `removeEntry` |
| `sdk.notes` | `list`, `get`, `create`, `delete` |
| `sdk.tasks` | `list`, `get`, `create`, `update`, `delete` |
| `sdk.search` | `records` |
| `sdk.workspaceMembers` | `list`, `get` |
| `sdk.metadata` | `listAttributes`, `findAttribute`, `getAttribute`, `getAttributeOptions`, `getAttributeStatuses`, `listAllowedValues`, `schema` |

The bound methods omit `client` and `config` from each input, while preserving
the standalone helper types and return types.

## Notes

2.2.1 is a substantial notes upgrade. In 2.1.0, `listNotes()` only listed notes
without note-specific filters. In 2.2.1, the high-level API supports parent
record filtering, pagination, Zod-validated note responses, and branded note
IDs.

### Create a note

```typescript
import {
  createAttioSdk,
  createNoteParentObjectId,
  createNoteParentRecordId,
} from 'attio-ts-sdk';

const sdk = createAttioSdk({ apiKey: process.env.ATTIO_API_KEY });

const note = await sdk.notes.create({
  parentObject: createNoteParentObjectId('companies'),
  parentRecordId: createNoteParentRecordId('company-record-id'),
  title: 'Discovery call',
  format: 'markdown',
  content: [
    '## Summary',
    '',
    '- Discussed rollout timeline',
    '- Confirmed procurement owner',
  ].join('\n'),
});
```

`format` can be `plaintext` or `markdown`. Markdown supports the subset exposed
by Attio's API, including headings, lists, bold, italic, strikethrough,
highlight, and links. Images in notes are not returned as markdown API content.

### Backdate a migrated note

Use `createdAt` when migrating historical notes:

```typescript
await sdk.notes.create({
  parentObject: createNoteParentObjectId('people'),
  parentRecordId: createNoteParentRecordId('person-record-id'),
  title: 'Imported note',
  format: 'plaintext',
  content: 'Imported from legacy CRM.',
  createdAt: '2024-06-01T12:00:00.000Z',
});
```

Attio rejects `created_at` values before 1970 or in the future.

### List notes for a person or company

Use both `parentObject` and `parentRecordId` to scope notes to a single record:

```typescript
import {
  createAttioSdk,
  createNoteId,
  createNoteParentObjectId,
  createNoteParentRecordId,
} from 'attio-ts-sdk';

const sdk = createAttioSdk({ apiKey: process.env.ATTIO_API_KEY });

const personNotes = await sdk.notes.list({
  parentObject: createNoteParentObjectId('people'),
  parentRecordId: createNoteParentRecordId('person-record-id'),
  paginate: true,
  limit: 50,
});

const firstNote = personNotes[0];
if (firstNote) {
  const note = await sdk.notes.get({
    noteId: createNoteId(firstNote.id.note_id),
  });

  console.log(note.title);
  console.log(note.content_markdown || note.content_plaintext);
}
```

For reads, the integration token needs the note and record read permissions
documented by Attio. The repository README calls out `note:read`,
`object_configuration:read`, and `record_permission:read` for listing and
viewing person notes. Creating or deleting notes requires the corresponding
write permission for notes.

### Stream notes

Use streaming when you want to process notes without materializing every page:

```typescript
for await (const note of sdk.notes.list({
  parentObject: createNoteParentObjectId('companies'),
  parentRecordId: createNoteParentRecordId('company-record-id'),
  paginate: 'stream',
  limit: 50,
  maxItems: 500,
})) {
  await indexNote(note);
}
```

### Delete a note

```typescript
import { createNoteId } from 'attio-ts-sdk';

await sdk.notes.delete({
  noteId: createNoteId('note-id'),
});
```

The high-level delete helper returns `true` after the generated delete endpoint
completes.

## Tasks

2.2.1 adds task listing to the high-level SDK and maps the generated query
parameters to camelCase inputs.

```typescript
import { createAttioSdk, createTaskId } from 'attio-ts-sdk';

const sdk = createAttioSdk({ apiKey: process.env.ATTIO_API_KEY });

const openTasksForPerson = await sdk.tasks.list({
  linkedRecord: {
    object: 'people',
    recordId: 'person-record-id',
  },
  assignee: 'owner@example.com',
  isCompleted: false,
  sort: 'created_at:desc',
  paginate: true,
});

const task = await sdk.tasks.create({
  data: {
    content: 'Follow up on proposal',
    format: 'plaintext',
    deadline_at: '2026-06-01T17:00:00.000Z',
    is_completed: false,
    linked_records: [
      {
        target_object: 'companies',
        target_record_id: 'company-record-id',
      },
    ],
    assignees: [],
  },
});

await sdk.tasks.update({
  taskId: createTaskId(task.id.task_id),
  data: { is_completed: true },
});
```

Generated task types now also allow `linked_records` to be an array of strings
or structured record references, matching the refreshed API schema.

Task list supports:

- `limit` and `offset`
- `paginate: true`
- `paginate: 'stream'`
- `maxPages` and `maxItems`
- `sort: 'created_at:asc' | 'created_at:desc' | 'completed_at:asc' | 'completed_at:desc'`
- `linkedRecord: { object, recordId }`
- `assignee`
- `isCompleted`
- `signal`

## Records and lists

### Fetch many records by ID

Use `getManyRecords()` or `sdk.records.getMany()` when you already have record
IDs. The helper chunks `$in` queries, runs them with bounded concurrency, and
can preserve the input order.

```typescript
import {
  createRecordId,
  createRecordObjectId,
} from 'attio-ts-sdk';

const companies = await sdk.records.getMany({
  object: createRecordObjectId('companies'),
  recordIds: [
    createRecordId('rec_1'),
    createRecordId('rec_2'),
    createRecordId('rec_3'),
  ],
  preserveOrder: true,
  notFound: 'throw',
  chunkSize: 100,
  concurrency: 4,
});
```

`notFound: 'omit'` is the default. Use `notFound: 'throw'` when missing records
should fail the whole call with `RECORDS_NOT_FOUND`.

### Query overloads are more precise

`queryRecords()` and `queryListEntries()` now have overloads that distinguish:

- `paginate: 'stream'` -> `AsyncIterable<T>`
- no `paginate` or `paginate: false` -> `Promise<T[]>`
- `paginate: true` -> `Promise<T[]>`
- `itemSchema` present -> the return type is inferred from the Zod schema

2.2.1 also exports the offset pagination input contracts:
`OffsetItemsQueryInput`, `OffsetItemsCollectInput`, and
`OffsetItemsStreamInput`.

### List helper return types are explicit

`listLists()`, `getList()`, `addListEntry()`, and `updateListEntry()` now expose
more precise return types. This mainly helps downstream inference and generated
declaration output.

## Metadata and schema helpers

### Find attributes

`sdk.metadata.findAttribute()` searches cached attribute metadata by slug,
title, type, or any combination of those fields:

```typescript
const stage = await sdk.metadata.findAttribute({
  target: 'objects',
  identifier: 'companies',
  title: 'Stage',
});

if (!stage) {
  throw new Error('Stage attribute not found');
}
```

At least one of `slug`, `title`, or `type` is required.

### List allowed values

`sdk.metadata.listAllowedValues()` normalizes select options and statuses to a
single shape:

```typescript
const allowedStages = await sdk.metadata.listAllowedValues({
  target: 'objects',
  identifier: 'companies',
  attribute: 'stage',
});

for (const value of allowedStages) {
  console.log(value.id, value.title, value.archived);
}
```

This is also used by `schema.buildValues()` to validate select and status
writes.

### Build write values from metadata

`createSchema()` now returns an object that also implements
`AttioWriteValuesBuilder`. Use `buildValues()` to serialize native JavaScript
values according to the live Attio attribute metadata:

```typescript
const companySchema = await sdk.metadata.schema({
  target: 'objects',
  identifier: 'companies',
});

const values = await companySchema.buildValues({
  Name: 'Acme Corp',
  Website: 'acme.com',
  Stage: 'Customer',
  employee_count: 150,
  annual_revenue: { value: 50000, currencyCode: 'USD' },
  owner_company: {
    targetObject: 'companies',
    targetRecordId: 'parent-company-record-id',
  },
});

await sdk.records.create({
  object: createRecordObjectId('companies'),
  values,
});
```

Important behavior:

- keys can be attribute API slugs or unique attribute titles
- ambiguous titles throw `AMBIGUOUS_ATTRIBUTE_TITLE`
- unknown attributes throw `UNKNOWN_ATTRIBUTE`
- non-writable attributes throw `NON_WRITABLE_ATTRIBUTE`
- `undefined` omits a field
- `null` clears a field by writing an empty values array
- arrays write multiple values
- select and status values are validated against live allowed values by default
- archived allowed values are rejected unless
  `includeArchivedAllowedValues: true` is passed

```typescript
const values = await companySchema.buildValues(
  {
    Stage: 'Former Customer',
  },
  {
    validateAllowedValues: true,
    includeArchivedAllowedValues: false,
  },
);
```

## Value helpers and typed reads

### Expanded `value` factories

The `value` namespace now covers more Attio value types:

| Helper | Use for |
| --- | --- |
| `value.string()` / `value.text()` | text-like values |
| `value.number()` | numeric and rating values |
| `value.boolean()` | checkbox values |
| `value.domain()` | domain values |
| `value.email()` | email address values |
| `value.phone()` | phone number values |
| `value.personalName()` | personal name values |
| `value.status()` | status values by title or ID |
| `value.select()` | select option values by title or ID |
| `value.recordReference()` | record-reference values |
| `value.location()` | location values |
| `value.currency()` | currency values |

```typescript
const values = {
  name: value.text('Acme Corp'),
  domains: value.domain('acme.com'),
  email_addresses: value.email('hello@acme.com'),
  phone_numbers: value.phone('+15551234567', 'US'),
  stage: value.status('Customer'),
  segments: value.select('Enterprise'),
  headquarters: value.location({
    locality: 'San Francisco',
    region: 'CA',
    countryCode: 'US',
  }),
};
```

### Exported value schemas

2.2.1 exports Zod schemas for common Attio value shapes:

- `textValueSchema`
- `numberValueSchema`
- `checkboxValueSchema`
- `dateValueSchema`
- `timestampValueSchema`
- `ratingValueSchema`
- `currencyValueSchema`
- `domainValueSchema`
- `emailValueSchema`
- `phoneValueSchema`
- `personalNameValueSchema`
- `locationValueSchema`
- `recordReferenceValueSchema`
- `actorReferenceValueSchema`
- `interactionValueSchema`
- `selectValueSchema`
- `statusValueSchema`
- `valueSchemasByType`

Use these with `getValue()`, `getFirstValue()`, or your own Zod schemas:

```typescript
import {
  emailValueSchema,
  getFirstValue,
  getFirstValueSafe,
} from 'attio-ts-sdk';

const primaryEmail = getFirstValue(person, 'email_addresses', {
  schema: emailValueSchema,
});

const safeResult = getFirstValueSafe(
  person,
  'email_addresses',
  emailValueSchema,
);

if (safeResult.ok) {
  console.log(safeResult.value?.email_address);
} else {
  console.error(safeResult.code, safeResult.message);
}
```

### Common scalar readers

New reader helpers handle the most common "get the first scalar out of an Attio
value object" cases:

```typescript
import {
  getFirstDomain,
  getFirstEmail,
  getFirstFullName,
  getFirstNumber,
  getFirstStatusTitle,
  getRecordReferenceIds,
} from 'attio-ts-sdk';

const name = getFirstFullName(person, 'name');
const email = getFirstEmail(person, 'email_addresses');
const domain = getFirstDomain(company, 'domains');
const employeeCount = getFirstNumber(company, 'employee_count');
const stage = getFirstStatusTitle(company, 'stage');
const linkedCompanyIds = getRecordReferenceIds(person, 'company');
```

### Schema-bound accessors

`createSchema()` accessors now include typed convenience readers:

```typescript
const schema = await sdk.metadata.schema({
  target: 'objects',
  identifier: 'people',
});

const emailAccessor = schema.getAccessorOrThrow('email_addresses');
const email = emailAccessor.firstEmail(person);

const typedValue = emailAccessor.firstValueTyped(person);
```

`firstValueTyped()` chooses an extractor based on the attribute type from
metadata. For unsupported or unknown attribute types it falls back to the raw
first value.

## Generated API additions

The OpenAPI-generated client was refreshed between these tags. The generated
surface includes new endpoints that are available from the package root even
when there is not yet a convenience wrapper.

### Views and `filter_view_id`

Object and list views can now be listed:

- `getV2ObjectsByObjectViews`
- `getV2ListsByListViews`

The record and list-entry query bodies now include `filter_view_id`. Use the
generated endpoints directly when querying by a saved Attio view:

```typescript
import {
  getV2ObjectsByObjectViews,
  postV2ObjectsByObjectRecordsQuery,
  unwrapItems,
  type ObjectView,
} from 'attio-ts-sdk';

const views = unwrapItems<ObjectView>(
  await getV2ObjectsByObjectViews({
    client: sdk.client,
    path: { object: 'companies' },
    query: { limit: 100 },
  }),
);

const customerView = views.find((view) => view.title === 'Customers');

if (customerView) {
  const records = unwrapItems(
    await postV2ObjectsByObjectRecordsQuery({
      client: sdk.client,
      path: { object: 'companies' },
      body: {
        filter_view_id: customerView.id.view_id,
        limit: 50,
        offset: 0,
      },
    }),
  );

  console.log(records.length);
}
```

`filter_view_id` cannot be combined with `filter`. Sorts, limits, and offsets
are applied independently of the saved view.

### Files

Generated file endpoints now include:

- `getV2Files`
- `postV2Files`
- `postV2FilesUpload`
- `getV2FilesByFileId`
- `getV2FilesByFileIdDownload`
- `deleteV2FilesByFileId`

Use `getV2Files()` to list files on a record:

```typescript
import { getV2Files, unwrapItems } from 'attio-ts-sdk';

const files = unwrapItems(
  await getV2Files({
    client: sdk.client,
    query: {
      object: 'companies',
      record_id: 'company-record-id',
      limit: 50,
    },
  }),
);
```

Upload an Attio-hosted file with a `Blob` or `File`:

```typescript
import { postV2FilesUpload } from 'attio-ts-sdk';

await postV2FilesUpload({
  client: sdk.client,
  body: {
    object: 'companies',
    record_id: 'company-record-id',
    file: new Blob(['hello'], { type: 'text/plain' }),
  },
});
```

Use `postV2Files()` for folders or connected external file entries.

### SCIM

Generated SCIM endpoints now include users, groups, and schemas:

- `getScimV2Schemas`
- `getScimV2Users`
- `postScimV2Users`
- `getScimV2UsersByUserId`
- `patchScimV2UsersByUserId`
- `putScimV2UsersByUserId`
- `deleteScimV2UsersByUserId`
- `getScimV2Groups`
- `postScimV2Groups`
- `getScimV2GroupsByWorkspaceTeamId`
- `patchScimV2GroupsByWorkspaceTeamId`
- `putScimV2GroupsByWorkspaceTeamId`
- `deleteScimV2GroupsByWorkspaceTeamId`

Use the generated types for these endpoints directly. They are not wrapped by
`createAttioSdk()` in 2.2.1.

## Error and batch improvements

2.2.1 exports more robust error utilities:

- `isAttioError`
- `isAttioNotFound`
- `isRetryableAttioError`
- `getAttioErrorStatus`
- `normalizeAttioError`

These are useful when `instanceof` is unreliable across bundlers or tests.

```typescript
try {
  await sdk.records.get({
    object: createRecordObjectId('companies'),
    recordId: createRecordId('missing-record-id'),
  });
} catch (error) {
  if (isAttioNotFound(error)) {
    return undefined;
  }
  throw error;
}
```

`runBatch()` also received abort-listener cleanup and race fixes. If you use
`runBatch()` directly, keep passing `signal` through your `BatchItem.run`
functions so cancellation can interrupt in-flight work.

## Recommended upgrade path

For new code, prefer this layered approach:

1. Use `createAttioSdk()` for normal object, record, list, note, task, search,
   workspace member, and metadata workflows.
2. Use `schema.buildValues()` for metadata-aware writes where attributes or
   allowed values come from Attio.
3. Use `value.*` factories for simple, explicit value construction.
4. Use `itemSchema` at query/read boundaries when you want runtime validation
   and inferred return types.
5. Use generated endpoints directly for views, files, SCIM, and any API surface
   that is not wrapped yet.
6. Keep retrying non-idempotent writes opt-in unless you provide idempotency
   keys.

## Related docs

- [Type-safe record values](./typesafe-records.md)
- [Pagination guide](./pagination.md)
- [Filtering and sorting guide](./filters.md)
- [Logging guide](./logging.md)
