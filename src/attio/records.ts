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
import { type AttioFilter, parseAttioFilter } from "./filters";
import { type BrandedId, createBrandedId } from "./ids";
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

type RecordObjectId = BrandedId<"RecordObjectId">;
type RecordId = BrandedId<"RecordId">;
type MatchingAttribute = BrandedId<"MatchingAttribute">;

const createRecordObjectId = (id: string): RecordObjectId =>
  createBrandedId<"RecordObjectId">(id, "RecordObjectId");
const createRecordId = (id: string): RecordId =>
  createBrandedId<"RecordId">(id, "RecordId");
const createMatchingAttribute = (id: string): MatchingAttribute =>
  createBrandedId<"MatchingAttribute">(id, "MatchingAttribute");

type RecordValues = PostV2ObjectsByObjectRecordsData["body"]["data"]["values"];
type RecordSorts = PostV2ObjectsByObjectRecordsQueryData["body"]["sorts"];

interface RecordCreateInput<T extends AttioRecordLike = AttioRecordLike>
  extends AttioClientInput {
  object: RecordObjectId;
  values: RecordValues;
  itemSchema?: ZodType<T>;
  options?: Omit<
    Options<PostV2ObjectsByObjectRecordsData>,
    "client" | "path" | "body"
  >;
}

interface RecordUpdateInput<T extends AttioRecordLike = AttioRecordLike>
  extends AttioClientInput {
  object: RecordObjectId;
  recordId: RecordId;
  values: RecordValues;
  itemSchema?: ZodType<T>;
  options?: Omit<
    Options<PatchV2ObjectsByObjectRecordsByRecordIdData>,
    "client" | "path" | "body"
  >;
}

interface RecordUpsertInput<T extends AttioRecordLike = AttioRecordLike>
  extends AttioClientInput {
  object: RecordObjectId;
  matchingAttribute: MatchingAttribute;
  values: RecordValues;
  itemSchema?: ZodType<T>;
  options?: Omit<
    Options<PutV2ObjectsByObjectRecordsData>,
    "client" | "path" | "body"
  >;
}

interface RecordGetInput<T extends AttioRecordLike = AttioRecordLike>
  extends AttioClientInput {
  object: RecordObjectId;
  recordId: RecordId;
  itemSchema?: ZodType<T>;
  options?: Omit<
    Options<GetV2ObjectsByObjectRecordsByRecordIdData>,
    "client" | "path"
  >;
}

interface RecordQueryBaseInput<T extends AttioRecordLike = AttioRecordLike>
  extends AttioClientInput {
  object: RecordObjectId;
  filter?: AttioFilter;
  sorts?: RecordSorts;
  limit?: number;
  offset?: number;
  signal?: AbortSignal;
  itemSchema?: ZodType<T>;
  options?: Omit<
    Options<PostV2ObjectsByObjectRecordsQueryData>,
    "client" | "path" | "body"
  >;
}

interface RecordQuerySingleInput<T extends AttioRecordLike = AttioRecordLike>
  extends RecordQueryBaseInput<T> {
  paginate?: false;
}

interface RecordQueryCollectInput<T extends AttioRecordLike = AttioRecordLike>
  extends RecordQueryBaseInput<T> {
  paginate: true;
  maxPages?: number;
  maxItems?: number;
}

interface RecordQueryStreamInput<T extends AttioRecordLike = AttioRecordLike>
  extends RecordQueryBaseInput<T> {
  paginate: "stream";
  maxPages?: number;
  maxItems?: number;
}

type RecordQueryPaginationInput = SharedPaginationInput;

type RecordQueryInput<T extends AttioRecordLike = AttioRecordLike> =
  | RecordQuerySingleInput<T>
  | RecordQueryCollectInput<T>
  | RecordQueryStreamInput<T>;

// Overload: With itemSchema - T is inferred from schema
async function createRecord<T extends AttioRecordLike>(
  input: RecordCreateInput<T> & { itemSchema: ZodType<T> },
): Promise<T>;
// Overload: Without itemSchema - returns AttioRecordLike
async function createRecord(input: RecordCreateInput): Promise<AttioRecordLike>;
// Implementation
async function createRecord<T extends AttioRecordLike>(
  input: RecordCreateInput<T>,
): Promise<T | AttioRecordLike> {
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
  const data = assertOk(result) as Record<string, unknown>;
  const normalized = normalizeRecord(data);
  return validateWithSchema(normalized, schema);
}

// Overload: With itemSchema - T is inferred from schema
async function updateRecord<T extends AttioRecordLike>(
  input: RecordUpdateInput<T> & { itemSchema: ZodType<T> },
): Promise<T>;
// Overload: Without itemSchema - returns AttioRecordLike
async function updateRecord(input: RecordUpdateInput): Promise<AttioRecordLike>;
// Implementation
async function updateRecord<T extends AttioRecordLike>(
  input: RecordUpdateInput<T>,
): Promise<T | AttioRecordLike> {
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
  const data = assertOk(result) as Record<string, unknown>;
  const normalized = normalizeRecord(data);
  return validateWithSchema(normalized, schema);
}

// Overload: With itemSchema - T is inferred from schema
async function upsertRecord<T extends AttioRecordLike>(
  input: RecordUpsertInput<T> & { itemSchema: ZodType<T> },
): Promise<T>;
// Overload: Without itemSchema - returns AttioRecordLike
async function upsertRecord(input: RecordUpsertInput): Promise<AttioRecordLike>;
// Implementation
async function upsertRecord<T extends AttioRecordLike>(
  input: RecordUpsertInput<T>,
): Promise<T | AttioRecordLike> {
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
  const data = assertOk(result) as Record<string, unknown>;
  const normalized = normalizeRecord(data);
  return validateWithSchema(normalized, schema);
}

// Overload: With itemSchema - T is inferred from schema
async function getRecord<T extends AttioRecordLike>(
  input: RecordGetInput<T> & { itemSchema: ZodType<T> },
): Promise<T>;
// Overload: Without itemSchema - returns AttioRecordLike
async function getRecord(input: RecordGetInput): Promise<AttioRecordLike>;
// Implementation
async function getRecord<T extends AttioRecordLike>(
  input: RecordGetInput<T>,
): Promise<T | AttioRecordLike> {
  const client = resolveAttioClient(input);
  const schema = input.itemSchema ?? rawRecordSchema;
  const result = await getV2ObjectsByObjectRecordsByRecordId({
    client,
    path: { object: input.object, record_id: input.recordId },
    ...input.options,
  });
  const data = assertOk(result) as Record<string, unknown>;
  const normalized = normalizeRecord(data);
  return validateWithSchema(normalized, schema);
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
  input: RecordQueryStreamInput<T> & { itemSchema: ZodType<T> },
): AsyncIterable<T>;
// Overload: Stream mode without itemSchema - returns AttioRecordLike
function queryRecords(
  input: RecordQueryStreamInput,
): AsyncIterable<AttioRecordLike>;
// Overload: Single/Collect mode with itemSchema - T is inferred from schema
function queryRecords<T extends AttioRecordLike>(
  input: (RecordQuerySingleInput<T> | RecordQueryCollectInput<T>) & {
    itemSchema: ZodType<T>;
  },
): Promise<T[]>;
// Overload: Single/Collect mode without itemSchema - returns AttioRecordLike
function queryRecords(
  input: RecordQuerySingleInput | RecordQueryCollectInput,
): Promise<AttioRecordLike[]>;
// Overload: Base input type (for SDK compatibility)
function queryRecords(
  input: RecordQueryInput,
): Promise<AttioRecordLike[]> | AsyncIterable<AttioRecordLike>;
// Implementation signature
function queryRecords<T extends AttioRecordLike>(
  input: RecordQueryInput<T>,
): Promise<T[]> | AsyncIterable<T> {
  const client = resolveAttioClient(input);
  const schema = input.itemSchema ?? rawRecordSchema;
  const filter =
    input.filter === undefined ? undefined : parseAttioFilter(input.filter);

  const fetchRecords = async (
    offset?: number,
    limit?: number,
    signal?: AbortSignal,
  ): Promise<T[]> => {
    const result = await postV2ObjectsByObjectRecordsQuery({
      client,
      path: { object: input.object },
      body: {
        filter,
        sorts: input.sorts,
        limit,
        offset,
      },
      ...input.options,
      signal,
    });
    const items = unwrapItems(result) as Record<string, unknown>[];
    const normalized = normalizeRecords(items);
    return validateItemsArray(normalized, schema) as T[];
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
};
export {
  createMatchingAttribute,
  createRecord,
  createRecordId,
  createRecordObjectId,
  updateRecord,
  upsertRecord,
  getRecord,
  deleteRecord,
  queryRecords,
};
