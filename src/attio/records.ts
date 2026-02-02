import { z } from "zod";
import type { Options } from "../generated";
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

const rawRecordSchema = z.record(z.string(), z.unknown());

interface RecordCreateInput extends AttioClientInput {
  object: string;
  values: Record<string, unknown>;
  options?: Omit<Options, "client" | "path" | "body">;
}

interface RecordUpdateInput extends AttioClientInput {
  object: string;
  recordId: string;
  values: Record<string, unknown>;
  options?: Omit<Options, "client" | "path" | "body">;
}

interface RecordUpsertInput extends AttioClientInput {
  object: string;
  matchingAttribute: string;
  values: Record<string, unknown>;
  options?: Omit<Options, "client" | "path" | "body">;
}

interface RecordGetInput extends AttioClientInput {
  object: string;
  recordId: string;
  options?: Omit<Options, "client" | "path">;
}

interface RecordQueryInput extends AttioClientInput {
  object: string;
  filter?: Record<string, unknown>;
  sorts?: Record<string, unknown>[];
  limit?: number;
  offset?: number;
  options?: Omit<Options, "client" | "path" | "body">;
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

  const items = unwrapItems<unknown>(result);
  return normalizeRecords<T>(items as Record<string, unknown>[]);
};

export type {
  RecordCreateInput,
  RecordUpdateInput,
  RecordUpsertInput,
  RecordGetInput,
  RecordQueryInput,
};
export {
  createRecord,
  updateRecord,
  upsertRecord,
  getRecord,
  deleteRecord,
  queryRecords,
};
