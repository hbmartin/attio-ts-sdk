import type { ZodType } from "zod";
import type { AttioClient, AttioClientInput } from "./client";
import { resolveAttioClient } from "./client";
import type { AttioClientConfig } from "./config";
import {
  type AddListEntryInput,
  addListEntry,
  type GetListInput,
  getList,
  type ListQueryCollectInput,
  type ListQueryInput,
  type ListQuerySingleInput,
  type ListQueryStreamInput,
  listLists,
  queryListEntries,
  type RemoveListEntryInput,
  removeListEntry,
  type UpdateListEntryInput,
  updateListEntry,
} from "./lists";
import {
  type AttributeFindInput,
  type AttributeInput,
  type AttributeListInput,
  findAttribute,
  getAttribute,
  getAttributeOptions,
  getAttributeStatuses,
  type ListAllowedValuesInput,
  listAllowedValues,
  listAttributes,
} from "./metadata";
import {
  createNote,
  deleteNote,
  getNote,
  listNotes,
  type NoteCreateInput,
  type NoteDeleteInput,
  type NoteGetInput,
  type NoteListCollectInput,
  type NoteListInput,
  type NoteListSingleInput,
  type NoteListStreamInput,
} from "./notes";
import {
  type CreateObjectInput,
  createObject,
  type GetObjectInput,
  getObject,
  type ListObjectsInput,
  listObjects,
  type UpdateObjectInput,
  updateObject,
} from "./objects";
import type { AttioRecordLike } from "./record-utils";
import {
  createRecord,
  deleteRecord,
  getManyRecords,
  getRecord,
  queryRecords,
  type RecordCreateInput,
  type RecordGetInput,
  type RecordGetManyInput,
  type RecordQueryCollectInput,
  type RecordQueryInput,
  type RecordQuerySingleInput,
  type RecordQueryStreamInput,
  type RecordUpdateInput,
  type RecordUpsertInput,
  updateRecord,
  upsertRecord,
} from "./records";
import { createSchema, type SchemaInput } from "./schema";
import { type RecordSearchInput, searchRecords } from "./search";
import {
  createTask,
  deleteTask,
  getTask,
  listTasks,
  type TaskCreateInput,
  type TaskDeleteInput,
  type TaskGetInput,
  type TaskListCollectInput,
  type TaskListInput,
  type TaskListSingleInput,
  type TaskListStreamInput,
  type TaskUpdateInput,
  updateTask,
} from "./tasks";
import {
  getWorkspaceMember,
  listWorkspaceMembers,
  type WorkspaceMemberInput,
} from "./workspace-members";

/** Helper type to omit client and config from input types for SDK methods */
type SdkInput<T> = T extends unknown ? Omit<T, "client" | "config"> : never;

/** Type alias for delete record input (same shape as RecordGetInput) */
type RecordDeleteInput = RecordGetInput;

type AttioSdkInput = AttioClientInput | AttioClientConfig;
type SdkNote = Awaited<ReturnType<typeof getNote>>;
type SdkTask = Awaited<ReturnType<typeof getTask>>;

interface SdkRecordQuery {
  <T extends AttioRecordLike>(
    input: SdkInput<RecordQueryStreamInput<T>> & { itemSchema: ZodType<T> },
  ): AsyncIterable<T>;
  (input: SdkInput<RecordQueryStreamInput>): AsyncIterable<AttioRecordLike>;
  <T extends AttioRecordLike>(
    input: SdkInput<RecordQuerySingleInput<T> | RecordQueryCollectInput<T>> & {
      itemSchema: ZodType<T>;
    },
  ): Promise<T[]>;
  (
    input: SdkInput<RecordQuerySingleInput | RecordQueryCollectInput>,
  ): Promise<AttioRecordLike[]>;
}

interface SdkListQueryEntries {
  <T extends AttioRecordLike>(
    input: SdkInput<ListQueryStreamInput<T>> & { itemSchema: ZodType<T> },
  ): AsyncIterable<T>;
  (input: SdkInput<ListQueryStreamInput>): AsyncIterable<AttioRecordLike>;
  <T extends AttioRecordLike>(
    input: SdkInput<ListQuerySingleInput<T> | ListQueryCollectInput<T>> & {
      itemSchema: ZodType<T>;
    },
  ): Promise<T[]>;
  (
    input: SdkInput<ListQuerySingleInput | ListQueryCollectInput>,
  ): Promise<AttioRecordLike[]>;
}

interface SdkGetManyRecords {
  <T extends AttioRecordLike>(
    input: SdkInput<RecordGetManyInput<T>> & { itemSchema: ZodType<T> },
  ): Promise<T[]>;
  (input: SdkInput<RecordGetManyInput>): Promise<AttioRecordLike[]>;
}

interface SdkListNotes {
  (input: SdkInput<NoteListStreamInput>): AsyncIterable<SdkNote>;
  (
    input?: SdkInput<NoteListSingleInput | NoteListCollectInput>,
  ): Promise<SdkNote[]>;
}

interface SdkListTasks {
  (input: SdkInput<TaskListStreamInput>): AsyncIterable<SdkTask>;
  (
    input?: SdkInput<TaskListSingleInput | TaskListCollectInput>,
  ): Promise<SdkTask[]>;
}

interface SdkSearchRecords {
  <T extends AttioRecordLike>(
    input: SdkInput<RecordSearchInput<T>> & { itemSchema: ZodType<T> },
  ): Promise<T[]>;
  (input: SdkInput<RecordSearchInput>): Promise<AttioRecordLike[]>;
}

interface AttioSdk {
  client: AttioClient;
  objects: {
    list: (
      input?: SdkInput<ListObjectsInput>,
    ) => ReturnType<typeof listObjects>;
    get: (input: SdkInput<GetObjectInput>) => ReturnType<typeof getObject>;
    create: (
      input: SdkInput<CreateObjectInput>,
    ) => ReturnType<typeof createObject>;
    update: (
      input: SdkInput<UpdateObjectInput>,
    ) => ReturnType<typeof updateObject>;
  };
  records: {
    create: (
      input: SdkInput<RecordCreateInput>,
    ) => ReturnType<typeof createRecord>;
    update: (
      input: SdkInput<RecordUpdateInput>,
    ) => ReturnType<typeof updateRecord>;
    upsert: (
      input: SdkInput<RecordUpsertInput>,
    ) => ReturnType<typeof upsertRecord>;
    get: (input: SdkInput<RecordGetInput>) => ReturnType<typeof getRecord>;
    getMany: SdkGetManyRecords;
    delete: (
      input: SdkInput<RecordDeleteInput>,
    ) => ReturnType<typeof deleteRecord>;
    query: SdkRecordQuery;
  };
  lists: {
    list: (input?: SdkInput<AttioClientInput>) => ReturnType<typeof listLists>;
    get: (input: SdkInput<GetListInput>) => ReturnType<typeof getList>;
    queryEntries: SdkListQueryEntries;
    addEntry: (
      input: SdkInput<AddListEntryInput>,
    ) => ReturnType<typeof addListEntry>;
    updateEntry: (
      input: SdkInput<UpdateListEntryInput>,
    ) => ReturnType<typeof updateListEntry>;
    removeEntry: (
      input: SdkInput<RemoveListEntryInput>,
    ) => ReturnType<typeof removeListEntry>;
  };
  notes: {
    list: SdkListNotes;
    get: (input: SdkInput<NoteGetInput>) => ReturnType<typeof getNote>;
    create: (input: SdkInput<NoteCreateInput>) => ReturnType<typeof createNote>;
    delete: (input: SdkInput<NoteDeleteInput>) => ReturnType<typeof deleteNote>;
  };
  tasks: {
    list: SdkListTasks;
    get: (input: SdkInput<TaskGetInput>) => ReturnType<typeof getTask>;
    create: (input: SdkInput<TaskCreateInput>) => ReturnType<typeof createTask>;
    update: (input: SdkInput<TaskUpdateInput>) => ReturnType<typeof updateTask>;
    delete: (input: SdkInput<TaskDeleteInput>) => ReturnType<typeof deleteTask>;
  };
  search: {
    records: SdkSearchRecords;
  };
  workspaceMembers: {
    list: (
      input?: SdkInput<AttioClientInput>,
    ) => ReturnType<typeof listWorkspaceMembers>;
    get: (
      input: SdkInput<WorkspaceMemberInput>,
    ) => ReturnType<typeof getWorkspaceMember>;
  };
  metadata: {
    listAttributes: (
      input: SdkInput<AttributeListInput>,
    ) => ReturnType<typeof listAttributes>;
    findAttribute: (
      input: SdkInput<AttributeFindInput>,
    ) => ReturnType<typeof findAttribute>;
    getAttribute: (
      input: SdkInput<AttributeInput>,
    ) => ReturnType<typeof getAttribute>;
    getAttributeOptions: (
      input: SdkInput<AttributeInput>,
    ) => ReturnType<typeof getAttributeOptions>;
    getAttributeStatuses: (
      input: SdkInput<AttributeInput>,
    ) => ReturnType<typeof getAttributeStatuses>;
    listAllowedValues: (
      input: SdkInput<ListAllowedValuesInput>,
    ) => ReturnType<typeof listAllowedValues>;
    schema: (input: SdkInput<SchemaInput>) => ReturnType<typeof createSchema>;
  };
}

const isAttioClientInput = (input: AttioSdkInput): input is AttioClientInput =>
  "client" in input || "config" in input;

const normalizeSdkInput = (input: AttioSdkInput): AttioClientInput => {
  if (isAttioClientInput(input)) {
    return input;
  }
  return { config: input };
};

function bindRecordQuery(client: AttioClient): SdkRecordQuery {
  function query<T extends AttioRecordLike>(
    input: SdkInput<RecordQueryStreamInput<T>> & { itemSchema: ZodType<T> },
  ): AsyncIterable<T>;
  function query(
    input: SdkInput<RecordQueryStreamInput>,
  ): AsyncIterable<AttioRecordLike>;
  function query<T extends AttioRecordLike>(
    input: SdkInput<RecordQuerySingleInput<T> | RecordQueryCollectInput<T>> & {
      itemSchema: ZodType<T>;
    },
  ): Promise<T[]>;
  function query(
    input: SdkInput<RecordQuerySingleInput | RecordQueryCollectInput>,
  ): Promise<AttioRecordLike[]>;
  function query(
    input: SdkInput<RecordQueryInput>,
  ): Promise<AttioRecordLike[]> | AsyncIterable<AttioRecordLike> {
    return queryRecords({ ...input, client });
  }
  return query;
}

function bindListQueryEntries(client: AttioClient): SdkListQueryEntries {
  function queryEntries<T extends AttioRecordLike>(
    input: SdkInput<ListQueryStreamInput<T>> & { itemSchema: ZodType<T> },
  ): AsyncIterable<T>;
  function queryEntries(
    input: SdkInput<ListQueryStreamInput>,
  ): AsyncIterable<AttioRecordLike>;
  function queryEntries<T extends AttioRecordLike>(
    input: SdkInput<ListQuerySingleInput<T> | ListQueryCollectInput<T>> & {
      itemSchema: ZodType<T>;
    },
  ): Promise<T[]>;
  function queryEntries(
    input: SdkInput<ListQuerySingleInput | ListQueryCollectInput>,
  ): Promise<AttioRecordLike[]>;
  function queryEntries(
    input: SdkInput<ListQueryInput>,
  ): Promise<AttioRecordLike[]> | AsyncIterable<AttioRecordLike> {
    return queryListEntries({ ...input, client });
  }
  return queryEntries;
}

function bindGetManyRecords(client: AttioClient): SdkGetManyRecords {
  function getMany<T extends AttioRecordLike>(
    input: SdkInput<RecordGetManyInput<T>> & { itemSchema: ZodType<T> },
  ): Promise<T[]>;
  function getMany(
    input: SdkInput<RecordGetManyInput>,
  ): Promise<AttioRecordLike[]>;
  function getMany(
    input: SdkInput<RecordGetManyInput>,
  ): Promise<AttioRecordLike[]> {
    return getManyRecords({ ...input, client });
  }
  return getMany;
}

function bindListNotes(client: AttioClient): SdkListNotes {
  function list(input: SdkInput<NoteListStreamInput>): AsyncIterable<SdkNote>;
  function list(
    input?: SdkInput<NoteListSingleInput | NoteListCollectInput>,
  ): Promise<SdkNote[]>;
  function list(
    input: SdkInput<NoteListInput> = {},
  ): Promise<SdkNote[]> | AsyncIterable<SdkNote> {
    return listNotes({ ...input, client });
  }
  return list;
}

function bindListTasks(client: AttioClient): SdkListTasks {
  function list(input: SdkInput<TaskListStreamInput>): AsyncIterable<SdkTask>;
  function list(
    input?: SdkInput<TaskListSingleInput | TaskListCollectInput>,
  ): Promise<SdkTask[]>;
  function list(
    input: SdkInput<TaskListInput> = {},
  ): Promise<SdkTask[]> | AsyncIterable<SdkTask> {
    return listTasks({ ...input, client });
  }
  return list;
}

function bindSearchRecords(client: AttioClient): SdkSearchRecords {
  function records<T extends AttioRecordLike>(
    input: SdkInput<RecordSearchInput<T>> & { itemSchema: ZodType<T> },
  ): Promise<T[]>;
  function records(
    input: SdkInput<RecordSearchInput>,
  ): Promise<AttioRecordLike[]>;
  function records(
    input: SdkInput<RecordSearchInput>,
  ): Promise<AttioRecordLike[]> {
    return searchRecords({ ...input, client });
  }
  return records;
}

const createAttioSdk = (input: AttioSdkInput = {}): AttioSdk => {
  const client = resolveAttioClient(normalizeSdkInput(input));

  return {
    client,
    objects: {
      list: (params = {}) => listObjects({ ...params, client }),
      get: (params) => getObject({ ...params, client }),
      create: (params) => createObject({ ...params, client }),
      update: (params) => updateObject({ ...params, client }),
    },
    records: {
      create: (params) => createRecord({ ...params, client }),
      update: (params) => updateRecord({ ...params, client }),
      upsert: (params) => upsertRecord({ ...params, client }),
      get: (params) => getRecord({ ...params, client }),
      getMany: bindGetManyRecords(client),
      delete: (params) => deleteRecord({ ...params, client }),
      query: bindRecordQuery(client),
    },
    lists: {
      list: (params = {}) => listLists({ ...params, client }),
      get: (params) => getList({ ...params, client }),
      queryEntries: bindListQueryEntries(client),
      addEntry: (params) => addListEntry({ ...params, client }),
      updateEntry: (params) => updateListEntry({ ...params, client }),
      removeEntry: (params) => removeListEntry({ ...params, client }),
    },
    notes: {
      list: bindListNotes(client),
      get: (params) => getNote({ ...params, client }),
      create: (params) => createNote({ ...params, client }),
      delete: (params) => deleteNote({ ...params, client }),
    },
    tasks: {
      list: bindListTasks(client),
      get: (params) => getTask({ ...params, client }),
      create: (params) => createTask({ ...params, client }),
      update: (params) => updateTask({ ...params, client }),
      delete: (params) => deleteTask({ ...params, client }),
    },
    search: {
      records: bindSearchRecords(client),
    },
    workspaceMembers: {
      list: (params = {}) => listWorkspaceMembers({ ...params, client }),
      get: (params) => getWorkspaceMember({ ...params, client }),
    },
    metadata: {
      listAttributes: (params) => listAttributes({ ...params, client }),
      findAttribute: (params) => findAttribute({ ...params, client }),
      getAttribute: (params) => getAttribute({ ...params, client }),
      getAttributeOptions: (params) =>
        getAttributeOptions({ ...params, client }),
      getAttributeStatuses: (params) =>
        getAttributeStatuses({ ...params, client }),
      listAllowedValues: (params) => listAllowedValues({ ...params, client }),
      schema: (params) => createSchema({ ...params, client }),
    },
  };
};

export type {
  AttioSdk,
  AttioSdkInput,
  RecordDeleteInput,
  SdkGetManyRecords,
  SdkInput,
  SdkListNotes,
  SdkListQueryEntries,
  SdkListTasks,
  SdkRecordQuery,
  SdkSearchRecords,
};
export { createAttioSdk };
