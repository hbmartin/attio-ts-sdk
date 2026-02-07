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
import type { Client } from "../generated/client";
import { type AttioClientInput, resolveAttioClient } from "./client";
import {
  buildQueryConfig,
  executePaginatedQuery,
  type SharedPaginationInput,
} from "./pagination";
import {
  type AttioRecordLike,
  normalizeRecord,
  unwrapAndNormalizeRecords,
} from "./record-utils";
import { assertOk, validateWithSchema } from "./response";
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
  filter?: RecordFilter;
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

interface RecordMutationConfig<
  TInput extends { itemSchema?: ZodType<unknown> },
> {
  input: TInput & AttioClientInput;
  execute: (client: Client) => Promise<unknown>;
}

const executeRecordMutation = async <T extends AttioRecordLike>(
  config: RecordMutationConfig<{ itemSchema?: ZodType<T> }>,
): Promise<T> => {
  const client = resolveAttioClient(config.input);
  const schema = config.input.itemSchema ?? rawRecordSchema;
  const result = await config.execute(client);
  const data = assertOk(result) as Record<string, unknown>;
  const normalized = normalizeRecord(data);
  return validateWithSchema(normalized, schema) as T;
};

// Overload: With itemSchema - T is inferred from schema
function createRecord<T extends AttioRecordLike>(
  input: RecordCreateInput<T> & { itemSchema: ZodType<T> },
): Promise<T>;
// Overload: Without itemSchema - returns AttioRecordLike
function createRecord(input: RecordCreateInput): Promise<AttioRecordLike>;
// Implementation
function createRecord<T extends AttioRecordLike>(
  input: RecordCreateInput<T>,
): Promise<T | AttioRecordLike> {
  return executeRecordMutation({
    input,
    execute: (client) =>
      postV2ObjectsByObjectRecords({
        client,
        path: { object: input.object },
        body: { data: { values: input.values } },
        ...input.options,
      }),
  });
}

// Overload: With itemSchema - T is inferred from schema
function updateRecord<T extends AttioRecordLike>(
  input: RecordUpdateInput<T> & { itemSchema: ZodType<T> },
): Promise<T>;
// Overload: Without itemSchema - returns AttioRecordLike
function updateRecord(input: RecordUpdateInput): Promise<AttioRecordLike>;
// Implementation
function updateRecord<T extends AttioRecordLike>(
  input: RecordUpdateInput<T>,
): Promise<T | AttioRecordLike> {
  return executeRecordMutation({
    input,
    execute: (client) =>
      patchV2ObjectsByObjectRecordsByRecordId({
        client,
        path: { object: input.object, record_id: input.recordId },
        body: { data: { values: input.values } },
        ...input.options,
      }),
  });
}

// Overload: With itemSchema - T is inferred from schema
function upsertRecord<T extends AttioRecordLike>(
  input: RecordUpsertInput<T> & { itemSchema: ZodType<T> },
): Promise<T>;
// Overload: Without itemSchema - returns AttioRecordLike
function upsertRecord(input: RecordUpsertInput): Promise<AttioRecordLike>;
// Implementation
function upsertRecord<T extends AttioRecordLike>(
  input: RecordUpsertInput<T>,
): Promise<T | AttioRecordLike> {
  return executeRecordMutation({
    input,
    execute: (client) =>
      putV2ObjectsByObjectRecords({
        client,
        path: { object: input.object },
        body: { data: { values: input.values } },
        query: { matching_attribute: input.matchingAttribute },
        ...input.options,
      }),
  });
}

// Overload: With itemSchema - T is inferred from schema
function getRecord<T extends AttioRecordLike>(
  input: RecordGetInput<T> & { itemSchema: ZodType<T> },
): Promise<T>;
// Overload: Without itemSchema - returns AttioRecordLike
function getRecord(input: RecordGetInput): Promise<AttioRecordLike>;
// Implementation
function getRecord<T extends AttioRecordLike>(
  input: RecordGetInput<T>,
): Promise<T | AttioRecordLike> {
  return executeRecordMutation({
    input,
    execute: (client) =>
      getV2ObjectsByObjectRecordsByRecordId({
        client,
        path: { object: input.object, record_id: input.recordId },
        ...input.options,
      }),
  });
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

  return executePaginatedQuery<T>(
    buildQueryConfig<T>(
      input as RecordQueryCollectInput<T>,
      async (offset, limit, signal) =>
        unwrapAndNormalizeRecords<T>(
          await postV2ObjectsByObjectRecordsQuery({
            client,
            path: { object: input.object },
            body: { filter: input.filter, sorts: input.sorts, limit, offset },
            ...input.options,
            signal,
          }),
          schema as ZodType<T>,
        ),
    ),
  );
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
