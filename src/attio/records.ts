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
  type AttioRecordLike,
  normalizeRecord,
  normalizeRecords,
} from "./record-utils";
import { assertOk, unwrapItems } from "./response";
import { rawRecordSchema } from "./schemas";

type RecordObjectId = string & { readonly __brand: "RecordObjectId" };
type RecordId = string & { readonly __brand: "RecordId" };
type MatchingAttribute = string & { readonly __brand: "MatchingAttribute" };

type RecordValues = PostV2ObjectsByObjectRecordsData["body"]["data"]["values"];
type RecordFilter = PostV2ObjectsByObjectRecordsQueryData["body"]["filter"];
type RecordSorts = PostV2ObjectsByObjectRecordsQueryData["body"]["sorts"];

interface RecordCreateInput extends AttioClientInput {
  object: RecordObjectId;
  values: RecordValues;
  options?: Omit<
    Options<PostV2ObjectsByObjectRecordsData>,
    "client" | "path" | "body"
  >;
}

interface RecordUpdateInput extends AttioClientInput {
  object: RecordObjectId;
  recordId: RecordId;
  values: RecordValues;
  options?: Omit<
    Options<PatchV2ObjectsByObjectRecordsByRecordIdData>,
    "client" | "path" | "body"
  >;
}

interface RecordUpsertInput extends AttioClientInput {
  object: RecordObjectId;
  matchingAttribute: MatchingAttribute;
  values: RecordValues;
  options?: Omit<
    Options<PutV2ObjectsByObjectRecordsData>,
    "client" | "path" | "body"
  >;
}

interface RecordGetInput extends AttioClientInput {
  object: RecordObjectId;
  recordId: RecordId;
  options?: Omit<
    Options<GetV2ObjectsByObjectRecordsByRecordIdData>,
    "client" | "path"
  >;
}

interface RecordQueryInput extends AttioClientInput {
  object: RecordObjectId;
  filter?: RecordFilter;
  sorts?: RecordSorts;
  limit?: number;
  offset?: number;
  options?: Omit<
    Options<PostV2ObjectsByObjectRecordsQueryData>,
    "client" | "path" | "body"
  >;
}

const createRecord = async <T extends AttioRecordLike>(
  input: RecordCreateInput,
): Promise<T> => {
  const client = resolveAttioClient(input);
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
  return normalizeRecord<T>(assertOk(result, { schema: rawRecordSchema }));
};

const updateRecord = async <T extends AttioRecordLike>(
  input: RecordUpdateInput,
): Promise<T> => {
  const client = resolveAttioClient(input);
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
  return normalizeRecord<T>(assertOk(result, { schema: rawRecordSchema }));
};

const upsertRecord = async <T extends AttioRecordLike>(
  input: RecordUpsertInput,
): Promise<T> => {
  const client = resolveAttioClient(input);
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
  return normalizeRecord<T>(assertOk(result, { schema: rawRecordSchema }));
};

const getRecord = async <T extends AttioRecordLike>(
  input: RecordGetInput,
): Promise<T> => {
  const client = resolveAttioClient(input);
  const result = await getV2ObjectsByObjectRecordsByRecordId({
    client,
    path: { object: input.object, record_id: input.recordId },
    ...input.options,
  });
  return normalizeRecord<T>(assertOk(result, { schema: rawRecordSchema }));
};

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

const queryRecords = async <T extends AttioRecordLike>(
  input: RecordQueryInput,
): Promise<T[]> => {
  const client = resolveAttioClient(input);
  const result = await postV2ObjectsByObjectRecordsQuery({
    client,
    path: { object: input.object },
    body: {
      filter: input.filter,
      sorts: input.sorts,
      limit: input.limit,
      offset: input.offset,
    },
    ...input.options,
  });

  const items = unwrapItems(result, { schema: rawRecordSchema });
  return normalizeRecords<T>(items);
};

export type {
  MatchingAttribute,
  RecordFilter,
  RecordId,
  RecordCreateInput,
  RecordObjectId,
  RecordUpdateInput,
  RecordUpsertInput,
  RecordGetInput,
  RecordQueryInput,
  RecordSorts,
  RecordValues,
};
export {
  createRecord,
  updateRecord,
  upsertRecord,
  getRecord,
  deleteRecord,
  queryRecords,
};
