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
import { runBatch } from "./batch";
import { type AttioClientInput, resolveAttioClient } from "./client";
import { AttioResponseError } from "./errors";
import { type AttioFilter, filters, parseAttioFilter } from "./filters";
import { type BrandedId, createBrandedIdSchema } from "./ids";
import {
  callAndDelete,
  callAndUnwrapRecord,
  createRecordQueryRuntime,
  unwrapAndNormalizeRecords,
} from "./operations";
import { resolveOffsetItems, type SharedPaginationInput } from "./pagination";
import { type AttioRecordLike, extractRecordId } from "./record-utils";
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

const recordObjectIdSchema =
  createBrandedIdSchema<"RecordObjectId">("RecordObjectId");
const recordIdSchema = createBrandedIdSchema<"RecordId">("RecordId");
const matchingAttributeSchema =
  createBrandedIdSchema<"MatchingAttribute">("MatchingAttribute");

const createRecordObjectId = (id: string): RecordObjectId =>
  recordObjectIdSchema.parse(id);
const createRecordId = (id: string): RecordId => recordIdSchema.parse(id);
const createMatchingAttribute = (id: string): MatchingAttribute =>
  matchingAttributeSchema.parse(id);

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

type RecordGetManyNotFoundPolicy = "omit" | "throw";

interface RecordGetManyInput<T extends AttioRecordLike = AttioRecordLike>
  extends AttioClientInput {
  object: RecordObjectId;
  recordIds: readonly RecordId[];
  chunkSize?: number;
  concurrency?: number;
  preserveOrder?: boolean;
  notFound?: RecordGetManyNotFoundPolicy;
  signal?: AbortSignal;
  itemSchema?: ZodType<T>;
  options?: Omit<
    Options<PostV2ObjectsByObjectRecordsQueryData>,
    "client" | "path" | "body"
  >;
}

const DEFAULT_GET_MANY_CHUNK_SIZE = 100;
const DEFAULT_GET_MANY_CONCURRENCY = 4;

const chunkRecordIds = (
  recordIds: readonly RecordId[],
  chunkSize: number,
): RecordId[][] => {
  const chunks: RecordId[][] = [];
  for (let index = 0; index < recordIds.length; index += chunkSize) {
    chunks.push(recordIds.slice(index, index + chunkSize));
  }
  return chunks;
};

const clampPositiveInteger = (
  value: number | undefined,
  fallback: number,
): number => {
  if (value === undefined || !Number.isFinite(value) || value < 1) {
    return fallback;
  }
  return Math.floor(value);
};

const missingRecordsError = (recordIds: readonly RecordId[]) =>
  new AttioResponseError("Attio records were not found.", {
    code: "RECORDS_NOT_FOUND",
    data: { recordIds },
  });

const orderRecordsByInputIds = <T extends AttioRecordLike>(
  records: T[],
  recordIds: readonly RecordId[],
  notFound: RecordGetManyNotFoundPolicy,
): T[] => {
  const byId = new Map<string, T>();
  for (const record of records) {
    const recordId = extractRecordId(record);
    if (recordId) {
      byId.set(recordId, record);
    }
  }

  const ordered: T[] = [];
  const missing: RecordId[] = [];
  for (const recordId of recordIds) {
    const record = byId.get(recordId);
    if (record) {
      ordered.push(record);
    } else {
      missing.push(recordId);
    }
  }

  if (missing.length > 0 && notFound === "throw") {
    throw missingRecordsError(missing);
  }

  return ordered;
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
  return callAndUnwrapRecord(input, (client) =>
    postV2ObjectsByObjectRecords({
      client,
      path: { object: input.object },
      body: { data: { values: input.values } },
      ...input.options,
    }),
  );
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
  return callAndUnwrapRecord(input, (client) =>
    patchV2ObjectsByObjectRecordsByRecordId({
      client,
      path: { object: input.object, record_id: input.recordId },
      body: { data: { values: input.values } },
      ...input.options,
    }),
  );
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
  return callAndUnwrapRecord(input, (client) =>
    putV2ObjectsByObjectRecords({
      client,
      path: { object: input.object },
      body: { data: { values: input.values } },
      query: { matching_attribute: input.matchingAttribute },
      ...input.options,
    }),
  );
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
  return callAndUnwrapRecord(input, (client) =>
    getV2ObjectsByObjectRecordsByRecordId({
      client,
      path: { object: input.object, record_id: input.recordId },
      ...input.options,
    }),
  );
}

const deleteRecord = (input: RecordGetInput): Promise<boolean> =>
  callAndDelete(input, (client) =>
    deleteV2ObjectsByObjectRecordsByRecordId({
      client,
      path: { object: input.object, record_id: input.recordId },
      ...input.options,
      throwOnError: true,
    }),
  );

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
  const query = createRecordQueryRuntime(input);

  const fetchRecords = async (
    offset?: number,
    limit?: number,
    signal?: AbortSignal,
  ): Promise<T[]> => {
    const result = await postV2ObjectsByObjectRecordsQuery({
      client: query.client,
      path: { object: input.object },
      body: { filter: query.filter, sorts: input.sorts, limit, offset },
      ...input.options,
      signal,
    });
    return unwrapAndNormalizeRecords(result, query.schema);
  };

  return resolveOffsetItems(fetchRecords, input);
}

// Overload: With itemSchema - T is inferred from schema
function getManyRecords<T extends AttioRecordLike>(
  input: RecordGetManyInput<T> & { itemSchema: ZodType<T> },
): Promise<T[]>;
// Overload: Without itemSchema - returns AttioRecordLike
function getManyRecords(input: RecordGetManyInput): Promise<AttioRecordLike[]>;
// Implementation
async function getManyRecords<T extends AttioRecordLike>(
  input: RecordGetManyInput<T>,
): Promise<T[]> {
  if (input.recordIds.length === 0) {
    return [];
  }

  const client = resolveAttioClient(input);
  const schema = input.itemSchema ?? rawRecordSchema;
  const chunkSize = clampPositiveInteger(
    input.chunkSize,
    DEFAULT_GET_MANY_CHUNK_SIZE,
  );
  const chunks = chunkRecordIds(input.recordIds, chunkSize);
  const batchItems = chunks.map((recordIds) => ({
    label: recordIds.join(","),
    run: async ({ signal }: { signal?: AbortSignal } = {}) => {
      const result = await postV2ObjectsByObjectRecordsQuery({
        client,
        path: { object: input.object },
        body: {
          filter: parseAttioFilter(filters.in("record_id", [...recordIds])),
          limit: recordIds.length,
          offset: 0,
        },
        ...input.options,
        signal: signal ?? input.signal,
      });
      return unwrapAndNormalizeRecords(result, schema) as T[];
    },
  }));

  const results = await runBatch(batchItems, {
    concurrency: clampPositiveInteger(
      input.concurrency,
      DEFAULT_GET_MANY_CONCURRENCY,
    ),
    stopOnError: true,
  });

  const records = results.flatMap((result) => result.value ?? []);
  const notFound = input.notFound ?? "omit";
  if (input.preserveOrder ?? true) {
    return orderRecordsByInputIds(records, input.recordIds, notFound);
  }

  if (notFound === "throw") {
    const foundIds = new Set<string>(
      records.flatMap((record) => {
        const recordId = extractRecordId(record);
        return recordId ? [recordId] : [];
      }),
    );
    const missing = input.recordIds.filter(
      (recordId) => !foundIds.has(recordId),
    );
    if (missing.length > 0) {
      throw missingRecordsError(missing);
    }
  }

  return records;
}

export type {
  InferRecordType,
  MatchingAttribute,
  RecordCreateInput,
  RecordGetInput,
  RecordGetManyInput,
  RecordGetManyNotFoundPolicy,
  RecordId,
  RecordObjectId,
  RecordQueryBaseInput,
  RecordQueryCollectInput,
  RecordQueryInput,
  RecordQueryPaginationInput,
  RecordQuerySingleInput,
  RecordQueryStreamInput,
  RecordSorts,
  RecordUpdateInput,
  RecordUpsertInput,
  RecordValues,
};
export {
  createMatchingAttribute,
  createRecord,
  createRecordId,
  createRecordObjectId,
  deleteRecord,
  getManyRecords,
  getRecord,
  matchingAttributeSchema,
  queryRecords,
  recordIdSchema,
  recordObjectIdSchema,
  updateRecord,
  upsertRecord,
};
