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
import { paginateOffset, paginateOffsetAsync } from "./pagination";
import { unwrapData, unwrapItems } from "./response";

type ListId = string & { readonly __brand: "ListId" };
type EntryId = string & { readonly __brand: "EntryId" };
type ParentObjectId = string & { readonly __brand: "ParentObjectId" };
type ParentRecordId = string & { readonly __brand: "ParentRecordId" };

type EntryValues = PostV2ListsByListEntriesData["body"]["data"]["entry_values"];
type ListEntryFilter = PostV2ListsByListEntriesQueryData["body"]["filter"];

interface ListQueryBaseInput extends AttioClientInput {
  list: ListId;
  filter?: ListEntryFilter;
  limit?: number;
  offset?: number;
  options?: Omit<
    Options<PostV2ListsByListEntriesQueryData>,
    "client" | "path" | "body"
  >;
}

interface ListQueryPaginationInput {
  maxPages?: number;
  maxItems?: number;
  signal?: AbortSignal;
}

type ListQueryInput = ListQueryBaseInput &
  ListQueryPaginationInput & {
    paginate?: boolean | "stream";
  };

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

export function queryListEntries<T = unknown>(
  input: ListQueryInput & { paginate: "stream" },
): AsyncIterable<T>;
export function queryListEntries<T = unknown>(
  input: ListQueryInput & { paginate?: false | true },
): Promise<T[]>;
export function queryListEntries<T = unknown>(
  input: ListQueryInput,
): Promise<T[]> | AsyncIterable<T>;
export function queryListEntries<T = unknown>(
  input: ListQueryInput,
): Promise<T[]> | AsyncIterable<T> {
  const client = resolveAttioClient(input);

  if (input.paginate === "stream" || input.paginate === true) {
    const fetchPage = async (offset: number, limit: number) => {
      const result = await postV2ListsByListEntriesQuery({
        client,
        path: { list: input.list },
        body: {
          filter: input.filter,
          limit,
          offset,
        },
        ...input.options,
      });

      const items = unwrapItems(result) as T[];
      return { items };
    };

    if (input.paginate === "stream") {
      return paginateOffsetAsync<T>(fetchPage, {
        offset: input.offset,
        limit: input.limit,
        maxPages: input.maxPages,
        maxItems: input.maxItems,
        signal: input.signal,
      });
    }

    return paginateOffset<T>(fetchPage, {
      offset: input.offset,
      limit: input.limit,
      maxPages: input.maxPages,
      maxItems: input.maxItems,
    });
  }

  const fetchSinglePage = async () => {
    const result = await postV2ListsByListEntriesQuery({
      client,
      path: { list: input.list },
      body: {
        filter: input.filter,
        limit: input.limit,
        offset: input.offset,
      },
      ...input.options,
    });

    return unwrapItems(result) as T[];
  };

  return fetchSinglePage();
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

export type {
  AddListEntryInput,
  EntryId,
  EntryValues,
  GetListInput,
  ListId,
  ListEntryFilter,
  ListQueryBaseInput,
  ListQueryInput,
  ListQueryPaginationInput,
  ParentObjectId,
  ParentRecordId,
  RemoveListEntryInput,
  UpdateListEntryInput,
};
