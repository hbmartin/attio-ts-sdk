# Typing Guide

This SDK now provides stronger ID factories so you can avoid raw branded-string casts in application code.

## Why this matters

Branded IDs are intentionally not plain `string` types. Without factories, downstream code often used manual casts (`as ...Id`).

Factories now provide a safe boundary:

- reject empty values at runtime
- return the correct branded type for compile-time safety

## Available ID factories

### Lists

- `createListId`
- `createEntryId`
- `createParentObjectId`
- `createParentRecordId`

### Records

- `createRecordObjectId`
- `createRecordId`
- `createMatchingAttribute`

### Tasks

- `createTaskId`

### Notes

- `createNoteId`
- `createNoteParentObjectId`
- `createNoteParentRecordId`

### Workspace members

- `createWorkspaceMemberId`

## Usage examples

```ts
import {
  createAttioSdk,
  getTask,
  getWorkspaceMember,
  createAttioClient,
  createRecordObjectId,
  createRecordId,
  createTaskId,
  createWorkspaceMemberId,
} from "attio-ts-sdk";

const sdk = createAttioSdk({ apiKey: process.env.ATTIO_API_KEY });

const objectId = createRecordObjectId("people");
const recordId = createRecordId("000e8881-37cc-41d2-bc22-39fe35e76e6b");

await sdk.records.get({
  object: objectId,
  recordId,
});

await getTask({
  client: sdk.client,
  taskId: createTaskId("b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e"),
});

const client = createAttioClient({ apiKey: process.env.ATTIO_API_KEY });
await getWorkspaceMember({
  client,
  workspaceMemberId: createWorkspaceMemberId("member-123"),
});
```

## Creating your own branded IDs

You can also use the generic helper for app-specific IDs:

```ts
import { createBrandedId } from "attio-ts-sdk";

type ExternalSystemId = string & { readonly __brand: "ExternalSystemId" };

const externalId = createBrandedId<"ExternalSystemId">(
  "ext-123",
  "ExternalSystemId",
);
```

## Recommended downstream pattern

- Parse raw external strings at boundaries, then immediately convert with factory helpers.
- Keep raw `string` types at I/O boundaries only.
- Pass branded IDs through domain and service layers unchanged.
- Avoid `as` casts for IDs; rely on factories for both runtime and compile-time guarantees.
