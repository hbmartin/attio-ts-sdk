import type { ZodType } from "zod";
import type {
  GetV2ObjectsByObjectRecordsByRecordIdData,
  Options,
  PatchV2ObjectsByObjectRecordsByRecordIdData,
  PostV2ObjectsByObjectRecordsData,
  PostV2ObjectsByObjectRecordsQueryData,
  PutV2ObjectsByObjectRecordsData,
} from "../generated";
import {
  deleteV2ObjectsByObjectRecordsByRecordId,
  getV2ObjectsByObjectRecordsByRecordId,
  patchV2ObjectsByObjectRecordsByRecordId,
  postV2ObjectsByObjectRecords,
  postV2ObjectsByObjectRecordsQuery,
  putV2ObjectsByObjectRecords,
} from "../generated";
import { type AttioClientInput, resolveAttioClient } from "./client";
import {
  paginateOffset,
  paginateOffsetAsync,
  type SharedPaginationInput,
} from "./pagination";
import {
  type AttioRecordLike,
  normalizeRecord,
  normalizeRecords,
} from "./record-utils";
import {
  assertOk,
  unwrapItems,
  validateItemsArray,
  validateWithSchema,
} from "./response";
import { rawRecordSchema } from "./schemas";

/**
 * Infers the record type from an input object.
 * If `itemSchema` is provided, the type is inferred from the schema.
 * Otherwise, returns `AttioRecordLike`.
 */
type InferRecordType<TInput> = TInput extends {
  itemSchema: ZodType<infer T>;
}
  ? T
  : AttioRecordLike;

/**
 * Helper type to require itemSchema for typed overloads.
 * This ensures users must provide a schema to get custom type inference.
 */
type WithItemSchema<TBase, T extends AttioRecordLike> = TBase & {
  itemSchema: ZodType<T>;
};

/**
 * Helper type for inputs without itemSchema.
 * Explicitly marks itemSchema as undefined to help overload resolution.
 */
type WithoutItemSchema<TBase> = Omit<TBase, "itemSchema"> & {
  itemSchema?: undefined;
};

type RecordObjectId = string & { readonly __brand: "RecordObjectId" };
type RecordId = string & { readonly __brand: "RecordId" };
type MatchingAttribute = string & { readonly __brand: "MatchingAttribute" };

type RecordValues = PostV2ObjectsByObjectRecordsData["body"]["data"]["values"];
type RecordFilter = PostV2ObjectsByObjectRecordsQueryData["body"]["filter"];
type RecordSorts = PostV2ObjectsByObjectRecordsQueryData["body"]["sorts"];

interface RecordCreateInput extends AttioClientInput {
  object: RecordObjectId;
  values: RecordValues;
  itemSchema?: ZodType<AttioRecordLike>;
  options?: Omit<
    Options<PostV2ObjectsByObjectRecordsData>,
    "client" | "path" | "body"
  >;
}

interface RecordUpdateInput extends AttioClientInput {
  object: RecordObjectId;
  recordId: RecordId;
  values: RecordValues;
  itemSchema?: ZodType<AttioRecordLike>;
  options?: Omit<
    Options<PatchV2ObjectsByObjectRecordsByRecordIdData>,
    "client" | "path" | "body"
  >;
}

interface RecordUpsertInput extends AttioClientInput {
  object: RecordObjectId;
  matchingAttribute: MatchingAttribute;
  values: RecordValues;
  itemSchema?: ZodType<AttioRecordLike>;
  options?: Omit<
    Options<PutV2ObjectsByObjectRecordsData>,
    "client" | "path" | "body"
  >;
}

interface RecordGetInput extends AttioClientInput {
  object: RecordObjectId;
  recordId: RecordId;
  itemSchema?: ZodType<AttioRecordLike>;
  options?: Omit<
    Options<GetV2ObjectsByObjectRecordsByRecordIdData>,
    "client" | "path"
  >;
}

interface RecordQueryBaseInput extends AttioClientInput {
  object: RecordObjectId;
  filter?: RecordFilter;
  sorts?: RecordSorts;
  limit?: number;
  offset?: number;
  signal?: AbortSignal;
  itemSchema?: ZodType<AttioRecordLike>;
  options?: Omit<
    Options<PostV2ObjectsByObjectRecordsQueryData>,
    "client" | "path" | "body"
  >;
}

interface RecordQuerySingleInput extends RecordQueryBaseInput {
  paginate?: false;
}

interface RecordQueryCollectInput extends RecordQueryBaseInput {
  paginate: true;
  maxPages?: number;
  maxItems?: number;
}

interface RecordQueryStreamInput extends RecordQueryBaseInput {
  paginate: "stream";
  maxPages?: number;
  maxItems?: number;
}

type RecordQueryPaginationInput = SharedPaginationInput;

type RecordQueryInput =
  | RecordQuerySingleInput
  | RecordQueryCollectInput
  | RecordQueryStreamInput;

// Overload: With itemSchema - T is inferred from schema
async function createRecord<T extends AttioRecordLike>(
  input: WithItemSchema<RecordCreateInput, T>,
): Promise<T>;
// Overload: Without itemSchema - returns AttioRecordLike
async function createRecord(
  input: WithoutItemSchema<RecordCreateInput>,
): Promise<AttioRecordLike>;
// Implementation
async function createRecord(
  input: RecordCreateInput,
): Promise<AttioRecordLike> {
  const client = resolveAttioClient(input);
  const schema = input.itemSchema ?? rawRecordSchema;
  const result = await postV2ObjectsByObjectRecords({
    client,
    path: { object: input.object },
    body: {
      data: {
        values: input.values,
      },
    },
    ...input.options,
  });
  const normalized = normalizeRecord(assertOk(result));
  return validateWithSchema(normalized, schema);
}

// Overload: With itemSchema - T is inferred from schema
async function updateRecord<T extends AttioRecordLike>(
  input: WithItemSchema<RecordUpdateInput, T>,
): Promise<T>;
// Overload: Without itemSchema - returns AttioRecordLike
async function updateRecord(
  input: WithoutItemSchema<RecordUpdateInput>,
): Promise<AttioRecordLike>;
// Implementation
async function updateRecord(
  input: RecordUpdateInput,
): Promise<AttioRecordLike> {
  const client = resolveAttioClient(input);
  const schema = input.itemSchema ?? rawRecordSchema;
  const result = await patchV2ObjectsByObjectRecordsByRecordId({
    client,
    path: { object: input.object, record_id: input.recordId },
    body: {
      data: {
        values: input.values,
      },
    },
    ...input.options,
  });
  const normalized = normalizeRecord(assertOk(result));
  return validateWithSchema(normalized, schema);
}

// Overload: With itemSchema - T is inferred from schema
async function upsertRecord<T extends AttioRecordLike>(
  input: WithItemSchema<RecordUpsertInput, T>,
): Promise<T>;
// Overload: Without itemSchema - returns AttioRecordLike
async function upsertRecord(
  input: WithoutItemSchema<RecordUpsertInput>,
): Promise<AttioRecordLike>;
// Implementation
async function upsertRecord(
  input: RecordUpsertInput,
): Promise<AttioRecordLike> {
  const client = resolveAttioClient(input);
  const schema = input.itemSchema ?? rawRecordSchema;
  const result = await putV2ObjectsByObjectRecords({
    client,
    path: { object: input.object },
    body: {
      data: {
        values: input.values,
      },
    },
    query: {
      matching_attribute: input.matchingAttribute,
    },
    ...input.options,
  });
  return normalizeRecord(assertOk(result, { schema }));
}

// Overload: With itemSchema - T is inferred from schema
async function getRecord<T extends AttioRecordLike>(
  input: WithItemSchema<RecordGetInput, T>,
): Promise<T>;
// Overload: Without itemSchema - returns AttioRecordLike
async function getRecord(
  input: WithoutItemSchema<RecordGetInput>,
): Promise<AttioRecordLike>;
// Implementation
async function getRecord(input: RecordGetInput): Promise<AttioRecordLike> {
  const client = resolveAttioClient(input);
  const schema = input.itemSchema ?? rawRecordSchema;
  const result = await getV2ObjectsByObjectRecordsByRecordId({
    client,
    path: { object: input.object, record_id: input.recordId },
    ...input.options,
  });
  return normalizeRecord(assertOk(result, { schema }));
}

const deleteRecord = async (input: RecordGetInput): Promise<boolean> => {
  const client = resolveAttioClient(input);
  await deleteV2ObjectsByObjectRecordsByRecordId({
    client,
    path: { object: input.object, record_id: input.recordId },
    ...input.options,
    throwOnError: true,
  });
  return true;
};

// Overload: Stream mode with itemSchema - T is inferred from schema
function queryRecords<T extends AttioRecordLike>(
  input: WithItemSchema<RecordQueryStreamInput, T>,
): AsyncIterable<T>;
// Overload: Stream mode without itemSchema - returns AttioRecordLike
function queryRecords(
  input: WithoutItemSchema<RecordQueryStreamInput>,
): AsyncIterable<AttioRecordLike>;
// Overload: Single/Collect mode with itemSchema - T is inferred from schema
function queryRecords<T extends AttioRecordLike>(
  input: WithItemSchema<RecordQuerySingleInput | RecordQueryCollectInput, T>,
): Promise<T[]>;
// Overload: Single/Collect mode without itemSchema - returns AttioRecordLike
function queryRecords(
  input: WithoutItemSchema<RecordQuerySingleInput | RecordQueryCollectInput>,
): Promise<AttioRecordLike[]>;
// Implementation signature
function queryRecords(
  input: RecordQueryInput,
): Promise<AttioRecordLike[]> | AsyncIterable<AttioRecordLike> {
  type T = AttioRecordLike;
  const client = resolveAttioClient(input);
  const schema = input.itemSchema ?? rawRecordSchema;

  const fetchRecords = async (
    offset?: number,
    limit?: number,
    signal?: AbortSignal,
  ): Promise<T[]> => {
    const result = await postV2ObjectsByObjectRecordsQuery({
      client,
      path: { object: input.object },
      body: {
        filter: input.filter,
        sorts: input.sorts,
        limit,
        offset,
      },
      ...input.options,
      signal,
    });
    const items = unwrapItems(result, { schema });
    return normalizeRecords(items) as T[];
  };

  if (input.paginate === "stream") {
    return paginateOffsetAsync<T>(
      async (offset, limit, signal) => ({
        items: await fetchRecords(offset, limit, signal),
      }),
      {
        offset: input.offset,
        limit: input.limit,
        maxPages: input.maxPages,
        maxItems: input.maxItems,
        signal: input.signal,
      },
    );
  }

  if (input.paginate === true) {
    return paginateOffset<T>(
      async (offset, limit, signal) => ({
        items: await fetchRecords(offset, limit, signal),
      }),
      {
        offset: input.offset,
        limit: input.limit,
        maxPages: input.maxPages,
        maxItems: input.maxItems,
        signal: input.signal,
      },
    );
  }

  return fetchRecords(input.offset, input.limit, input.signal);
}

export type {
  InferRecordType,
  MatchingAttribute,
  RecordFilter,
  RecordId,
  RecordCreateInput,
  RecordObjectId,
  RecordQueryBaseInput,
  RecordQueryCollectInput,
  RecordQueryInput,
  RecordQueryPaginationInput,
  RecordQuerySingleInput,
  RecordQueryStreamInput,
  RecordUpdateInput,
  RecordUpsertInput,
  RecordGetInput,
  RecordSorts,
  RecordValues,
  WithItemSchema,
  WithoutItemSchema,
};
export {
  createRecord,
  updateRecord,
  upsertRecord,
  getRecord,
  deleteRecord,
  queryRecords,
};
