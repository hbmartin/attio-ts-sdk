import type { ZodType } from "zod";
import type {
  DeleteV2ListsByListEntriesByEntryIdData,
  GetV2ListsByListData,
  Options,
  PatchV2ListsByListEntriesByEntryIdData,
  PostV2ListsByListEntriesData,
  PostV2ListsByListEntriesQueryData,
} from "../generated";
import {
  deleteV2ListsByListEntriesByEntryId,
  getV2Lists,
  getV2ListsByList,
  patchV2ListsByListEntriesByEntryId,
  postV2ListsByListEntries,
  postV2ListsByListEntriesQuery,
} from "../generated";
import type { AttioClientInput } from "./client";
import { type AttioFilter, parseAttioFilter } from "./filters";
import { type BrandedId, createBrandedId } from "./ids";
import {
  executeDataOperation,
  executeItemsOperation,
  executeRawOperation,
  executeValidatedItemsOperation,
} from "./operations";
import {
  paginateOffset,
  paginateOffsetAsync,
  type SharedPaginationInput,
} from "./pagination";
import { type AttioRecordLike, normalizeRecords } from "./record-utils";
import { rawRecordSchema } from "./schemas";

/**
 * Infers the entry type from an input object.
 * If `itemSchema` is provided, the type is inferred from the schema.
 * Otherwise, returns `AttioRecordLike`.
 */
type InferEntryType<TInput> = TInput extends {
  itemSchema: ZodType<infer T>;
}
  ? T
  : AttioRecordLike;

type ListId = BrandedId<"ListId">;
type EntryId = BrandedId<"EntryId">;
type ParentObjectId = BrandedId<"ParentObjectId">;
type ParentRecordId = BrandedId<"ParentRecordId">;

const createListId = (id: string): ListId =>
  createBrandedId<"ListId">(id, "ListId");
const createEntryId = (id: string): EntryId =>
  createBrandedId<"EntryId">(id, "EntryId");
const createParentObjectId = (id: string): ParentObjectId =>
  createBrandedId<"ParentObjectId">(id, "ParentObjectId");
const createParentRecordId = (id: string): ParentRecordId =>
  createBrandedId<"ParentRecordId">(id, "ParentRecordId");

type EntryValues = PostV2ListsByListEntriesData["body"]["data"]["entry_values"];

interface ListQueryBaseInput<T extends AttioRecordLike = AttioRecordLike>
  extends AttioClientInput {
  list: ListId;
  filter?: AttioFilter;
  limit?: number;
  offset?: number;
  signal?: AbortSignal;
  itemSchema?: ZodType<T>;
  options?: Omit<
    Options<PostV2ListsByListEntriesQueryData>,
    "client" | "path" | "body"
  >;
}

interface ListQuerySingleInput<T extends AttioRecordLike = AttioRecordLike>
  extends ListQueryBaseInput<T> {
  paginate?: false;
}

interface ListQueryCollectInput<T extends AttioRecordLike = AttioRecordLike>
  extends ListQueryBaseInput<T> {
  paginate: true;
  maxPages?: number;
  maxItems?: number;
}

interface ListQueryStreamInput<T extends AttioRecordLike = AttioRecordLike>
  extends ListQueryBaseInput<T> {
  paginate: "stream";
  maxPages?: number;
  maxItems?: number;
}

type ListQueryPaginationInput = SharedPaginationInput;

type ListQueryInput<T extends AttioRecordLike = AttioRecordLike> =
  | ListQuerySingleInput<T>
  | ListQueryCollectInput<T>
  | ListQueryStreamInput<T>;

interface GetListInput extends AttioClientInput {
  list: ListId;
  options?: Omit<Options<GetV2ListsByListData>, "client" | "path">;
}

interface AddListEntryInput extends AttioClientInput {
  list: ListId;
  parentObject: ParentObjectId;
  parentRecordId: ParentRecordId;
  entryValues?: EntryValues;
  options?: Omit<
    Options<PostV2ListsByListEntriesData>,
    "client" | "path" | "body"
  >;
}

interface UpdateListEntryInput extends AttioClientInput {
  list: ListId;
  entryId: EntryId;
  entryValues: EntryValues;
  options?: Omit<
    Options<PatchV2ListsByListEntriesByEntryIdData>,
    "client" | "path" | "body"
  >;
}

interface RemoveListEntryInput extends AttioClientInput {
  list: ListId;
  entryId: EntryId;
  options?: Omit<
    Options<DeleteV2ListsByListEntriesByEntryIdData, true>,
    "client" | "path"
  >;
}

export const listLists = async (input: AttioClientInput = {}) =>
  executeItemsOperation({
    input,
    request: async (client) => getV2Lists({ client }),
  });

export const getList = async (input: GetListInput) =>
  executeDataOperation({
    input,
    request: async (client) =>
      getV2ListsByList({
        client,
        path: { list: input.list },
        ...input.options,
      }),
  });

// Overload: Stream mode with itemSchema - T is inferred from schema
export function queryListEntries<T extends AttioRecordLike>(
  input: ListQueryStreamInput<T> & { itemSchema: ZodType<T> },
): AsyncIterable<T>;
// Overload: Stream mode without itemSchema - returns AttioRecordLike
export function queryListEntries(
  input: ListQueryStreamInput,
): AsyncIterable<AttioRecordLike>;
// Overload: Single/Collect mode with itemSchema - T is inferred from schema
export function queryListEntries<T extends AttioRecordLike>(
  input: (ListQuerySingleInput<T> | ListQueryCollectInput<T>) & {
    itemSchema: ZodType<T>;
  },
): Promise<T[]>;
// Overload: Single/Collect mode without itemSchema - returns AttioRecordLike
export function queryListEntries(
  input: ListQuerySingleInput | ListQueryCollectInput,
): Promise<AttioRecordLike[]>;
// Overload: Base input type (for SDK compatibility)
export function queryListEntries(
  input: ListQueryInput,
): Promise<AttioRecordLike[]> | AsyncIterable<AttioRecordLike>;
// Implementation signature
export function queryListEntries<T extends AttioRecordLike>(
  input: ListQueryInput<T>,
): Promise<T[]> | AsyncIterable<T> {
  const schema = input.itemSchema ?? rawRecordSchema;
  const filter =
    input.filter === undefined ? undefined : parseAttioFilter(input.filter);

  const fetchEntries = async (
    offset?: number,
    limit?: number,
    signal?: AbortSignal,
  ): Promise<T[]> =>
    executeValidatedItemsOperation({
      input,
      schema,
      normalize: normalizeRecords,
      request: async (client) =>
        postV2ListsByListEntriesQuery({
          client,
          path: { list: input.list },
          body: {
            filter,
            limit,
            offset,
          },
          ...input.options,
          signal,
        }),
    }) as Promise<T[]>;

  if (input.paginate === "stream") {
    return paginateOffsetAsync<T>(
      async (offset, limit, signal) => ({
        items: await fetchEntries(offset, limit, signal),
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
        items: await fetchEntries(offset, limit, signal),
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

  return fetchEntries(input.offset, input.limit, input.signal);
}

export const addListEntry = async (input: AddListEntryInput) =>
  executeDataOperation({
    input,
    request: async (client) =>
      postV2ListsByListEntries({
        client,
        path: { list: input.list },
        body: {
          data: {
            parent_object: input.parentObject,
            parent_record_id: input.parentRecordId,
            entry_values: input.entryValues ?? {},
          },
        },
        ...input.options,
      }),
  });

export const updateListEntry = async (input: UpdateListEntryInput) =>
  executeDataOperation({
    input,
    request: async (client) =>
      patchV2ListsByListEntriesByEntryId({
        client,
        path: { list: input.list, entry_id: input.entryId },
        body: {
          data: {
            entry_values: input.entryValues,
          },
        },
        ...input.options,
      }),
  });

export const removeListEntry = async (input: RemoveListEntryInput) => {
  await executeRawOperation({
    input,
    request: async (client) =>
      deleteV2ListsByListEntriesByEntryId({
        client,
        path: { list: input.list, entry_id: input.entryId },
        ...input.options,
        throwOnError: true,
      }),
  });
  return true;
};

export {
  createEntryId,
  createListId,
  createParentObjectId,
  createParentRecordId,
};

export type {
  AddListEntryInput,
  EntryId,
  EntryValues,
  GetListInput,
  InferEntryType,
  ListId,
  ListQueryBaseInput,
  ListQueryCollectInput,
  ListQueryInput,
  ListQueryPaginationInput,
  ListQuerySingleInput,
  ListQueryStreamInput,
  ParentObjectId,
  ParentRecordId,
  RemoveListEntryInput,
  UpdateListEntryInput,
};
