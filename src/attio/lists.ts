import type { Options } from "../generated";
import {
  deleteV2ListsByListEntriesByEntryId,
  getV2Lists,
  getV2ListsByList,
  patchV2ListsByListEntriesByEntryId,
  postV2ListsByListEntries,
  postV2ListsByListEntriesQuery,
} from "../generated";
import { type AttioClientInput, resolveAttioClient } from "./client";
import { unwrapData, unwrapItems } from "./response";

type ListId = string & { readonly __brand: "ListId" };
type EntryId = string & { readonly __brand: "EntryId" };

interface ListQueryInput extends AttioClientInput {
  list: ListId;
  filter?: Record<string, unknown>;
  limit?: number;
  offset?: number;
  options?: Omit<Options, "client" | "path" | "body">;
}

interface GetListInput extends AttioClientInput {
  list: ListId;
}

interface AddListEntryInput extends AttioClientInput {
  list: ListId;
  parentRecordId: string;
  entryValues?: Record<string, unknown>;
  options?: Omit<Options, "client" | "path" | "body">;
}

interface UpdateListEntryInput extends AttioClientInput {
  list: ListId;
  entryId: EntryId;
  entryValues: Record<string, unknown>;
  options?: Omit<Options, "client" | "path" | "body">;
}

interface RemoveListEntryInput extends AttioClientInput {
  list: ListId;
  entryId: EntryId;
  options?: Omit<Options, "client" | "path">;
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
  });
  return unwrapData(result);
};

export const queryListEntries = async (input: ListQueryInput) => {
  const client = resolveAttioClient(input);
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

  return unwrapItems(result);
};

export const addListEntry = async (input: AddListEntryInput) => {
  const client = resolveAttioClient(input);
  const result = await postV2ListsByListEntries({
    client,
    path: { list: input.list },
    body: {
      data: {
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
  GetListInput,
  ListId,
  ListQueryInput,
  RemoveListEntryInput,
  UpdateListEntryInput,
};
