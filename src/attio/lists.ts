import {
  deleteV2ListsByListEntriesByEntryId,
  getV2Lists,
  getV2ListsByList,
  postV2ListsByListEntries,
  postV2ListsByListEntriesQuery,
  patchV2ListsByListEntriesByEntryId,
} from "../generated";
import type { Options } from "../generated";
import { resolveAttioClient, type AttioClientInput } from "./client";
import { unwrapData, unwrapItems } from "./response";

export interface ListQueryInput extends AttioClientInput {
  list: string;
  filter?: Record<string, unknown>;
  limit?: number;
  offset?: number;
  options?: Omit<Options, "client" | "path" | "body">;
}

export const listLists = async (input: AttioClientInput = {}) => {
  const client = resolveAttioClient(input);
  const result = await getV2Lists({ client });
  return unwrapItems(result);
};

export const getList = async (input: { list: string } & AttioClientInput) => {
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

export const addListEntry = async (
  input: {
    list: string;
    parentRecordId: string;
    entryValues?: Record<string, unknown>;
    options?: Omit<Options, "client" | "path" | "body">;
  } & AttioClientInput,
) => {
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

export const updateListEntry = async (
  input: {
    list: string;
    entryId: string;
    entryValues: Record<string, unknown>;
    options?: Omit<Options, "client" | "path" | "body">;
  } & AttioClientInput,
) => {
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

export const removeListEntry = async (
  input: {
    list: string;
    entryId: string;
    options?: Omit<Options, "client" | "path">;
  } & AttioClientInput,
) => {
  const client = resolveAttioClient(input);
  await deleteV2ListsByListEntriesByEntryId({
    client,
    path: { list: input.list, entry_id: input.entryId },
    ...input.options,
    throwOnError: true,
  });
  return true;
};
