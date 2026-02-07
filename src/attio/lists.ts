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
import { type AttioClientInput, resolveAttioClient } from "./client";
import {
  paginateOffset,
  paginateOffsetAsync,
  type SharedPaginationInput,
} from "./pagination";
import { type AttioRecordLike, normalizeRecords } from "./record-utils";
import { unwrapData, unwrapItems } from "./response";
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

type ListId = string & { readonly __brand: "ListId" };
type EntryId = string & { readonly __brand: "EntryId" };
type ParentObjectId = string & { readonly __brand: "ParentObjectId" };
type ParentRecordId = string & { readonly __brand: "ParentRecordId" };

const createListId = (id: string): ListId => {
  if (!id) {
    throw new Error("ListId cannot be empty");
  }
  return id as ListId;
};

type EntryValues = PostV2ListsByListEntriesData["body"]["data"]["entry_values"];
type ListEntryFilter = PostV2ListsByListEntriesQueryData["body"]["filter"];

interface ListQueryBaseInput extends AttioClientInput {
  list: ListId;
  filter?: ListEntryFilter;
  limit?: number;
  offset?: number;
  signal?: AbortSignal;
  itemSchema?: ZodType<AttioRecordLike>;
  options?: Omit<
    Options<PostV2ListsByListEntriesQueryData>,
    "client" | "path" | "body"
  >;
}

interface ListQuerySingleInput extends ListQueryBaseInput {
  paginate?: false;
}

interface ListQueryCollectInput extends ListQueryBaseInput {
  paginate: true;
  maxPages?: number;
  maxItems?: number;
}

interface ListQueryStreamInput extends ListQueryBaseInput {
  paginate: "stream";
  maxPages?: number;
  maxItems?: number;
}

type ListQueryPaginationInput = SharedPaginationInput;

type ListQueryInput =
  | ListQuerySingleInput
  | ListQueryCollectInput
  | ListQueryStreamInput;

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

export const listLists = async (input: AttioClientInput = {}) => {
  const client = resolveAttioClient(input);
  const result = await getV2Lists({ client });
  return unwrapItems(result);
};

export const getList = async (input: GetListInput) => {
  const client = resolveAttioClient(input);
  const result = await getV2ListsByList({
    client,
    path: { list: input.list },
    ...input.options,
  });
  return unwrapData(result);
};

export function queryListEntries<TInput extends ListQueryStreamInput>(
  input: TInput,
): AsyncIterable<InferEntryType<TInput>>;
export function queryListEntries<
  TInput extends ListQuerySingleInput | ListQueryCollectInput,
>(input: TInput): Promise<InferEntryType<TInput>[]>;
export function queryListEntries<TInput extends ListQueryInput>(
  input: TInput,
): Promise<InferEntryType<TInput>[]> | AsyncIterable<InferEntryType<TInput>>;
export function queryListEntries<TInput extends ListQueryInput>(
  input: TInput,
): Promise<InferEntryType<TInput>[]> | AsyncIterable<InferEntryType<TInput>> {
  type T = InferEntryType<TInput>;
  const client = resolveAttioClient(input);
  const schema = input.itemSchema ?? rawRecordSchema;

  const fetchEntries = async (
    offset?: number,
    limit?: number,
    signal?: AbortSignal,
  ): Promise<T[]> => {
    const result = await postV2ListsByListEntriesQuery({
      client,
      path: { list: input.list },
      body: {
        filter: input.filter,
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

export const addListEntry = async (input: AddListEntryInput) => {
  const client = resolveAttioClient(input);
  const result = await postV2ListsByListEntries({
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
  });
  return unwrapData(result);
};

export const updateListEntry = async (input: UpdateListEntryInput) => {
  const client = resolveAttioClient(input);
  const result = await patchV2ListsByListEntriesByEntryId({
    client,
    path: { list: input.list, entry_id: input.entryId },
    body: {
      data: {
        entry_values: input.entryValues,
      },
    },
    ...input.options,
  });
  return unwrapData(result);
};

export const removeListEntry = async (input: RemoveListEntryInput) => {
  const client = resolveAttioClient(input);
  await deleteV2ListsByListEntriesByEntryId({
    client,
    path: { list: input.list, entry_id: input.entryId },
    ...input.options,
    throwOnError: true,
  });
  return true;
};

export { createListId };

export type {
  AddListEntryInput,
  EntryId,
  EntryValues,
  GetListInput,
  InferEntryType,
  ListId,
  ListEntryFilter,
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
