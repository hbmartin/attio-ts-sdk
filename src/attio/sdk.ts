import type { AttioClient, AttioClientInput } from "./client";
import { resolveAttioClient } from "./client";
import {
  type AddListEntryInput,
  addListEntry,
  type GetListInput,
  getList,
  type ListQueryInput,
  listLists,
  queryListEntries,
  type RemoveListEntryInput,
  removeListEntry,
  type UpdateListEntryInput,
  updateListEntry,
} from "./lists";
import {
  type AttributeInput,
  type AttributeListInput,
  getAttribute,
  getAttributeOptions,
  getAttributeStatuses,
  listAttributes,
} from "./metadata";
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
import {
  createRecord,
  deleteRecord,
  getRecord,
  queryRecords,
  type RecordCreateInput,
  type RecordGetInput,
  type RecordQueryInput,
  type RecordUpdateInput,
  type RecordUpsertInput,
  updateRecord,
  upsertRecord,
} from "./records";
import { createSchema, type SchemaInput } from "./schema";

interface AttioSdk {
  client: AttioClient;
  objects: {
    list: (
      input?: Omit<ListObjectsInput, "client" | "config">,
    ) => ReturnType<typeof listObjects>;
    get: (
      input: Omit<GetObjectInput, "client" | "config">,
    ) => ReturnType<typeof getObject>;
    create: (
      input: Omit<CreateObjectInput, "client" | "config">,
    ) => ReturnType<typeof createObject>;
    update: (
      input: Omit<UpdateObjectInput, "client" | "config">,
    ) => ReturnType<typeof updateObject>;
  };
  records: {
    create: (
      input: Omit<RecordCreateInput, "client" | "config">,
    ) => ReturnType<typeof createRecord>;
    update: (
      input: Omit<RecordUpdateInput, "client" | "config">,
    ) => ReturnType<typeof updateRecord>;
    upsert: (
      input: Omit<RecordUpsertInput, "client" | "config">,
    ) => ReturnType<typeof upsertRecord>;
    get: (
      input: Omit<RecordGetInput, "client" | "config">,
    ) => ReturnType<typeof getRecord>;
    delete: (
      input: Omit<RecordGetInput, "client" | "config">,
    ) => ReturnType<typeof deleteRecord>;
    query: (
      input: Omit<RecordQueryInput, "client" | "config">,
    ) => ReturnType<typeof queryRecords>;
  };
  lists: {
    list: (
      input?: Omit<AttioClientInput, "client" | "config">,
    ) => ReturnType<typeof listLists>;
    get: (
      input: Omit<GetListInput, "client" | "config">,
    ) => ReturnType<typeof getList>;
    queryEntries: (
      input: Omit<ListQueryInput, "client" | "config">,
    ) => ReturnType<typeof queryListEntries>;
    addEntry: (
      input: Omit<AddListEntryInput, "client" | "config">,
    ) => ReturnType<typeof addListEntry>;
    updateEntry: (
      input: Omit<UpdateListEntryInput, "client" | "config">,
    ) => ReturnType<typeof updateListEntry>;
    removeEntry: (
      input: Omit<RemoveListEntryInput, "client" | "config">,
    ) => ReturnType<typeof removeListEntry>;
  };
  metadata: {
    listAttributes: (
      input: Omit<AttributeListInput, "client" | "config">,
    ) => ReturnType<typeof listAttributes>;
    getAttribute: (
      input: Omit<AttributeInput, "client" | "config">,
    ) => ReturnType<typeof getAttribute>;
    getAttributeOptions: (
      input: Omit<AttributeInput, "client" | "config">,
    ) => ReturnType<typeof getAttributeOptions>;
    getAttributeStatuses: (
      input: Omit<AttributeInput, "client" | "config">,
    ) => ReturnType<typeof getAttributeStatuses>;
    schema: (
      input: Omit<SchemaInput, "client" | "config">,
    ) => ReturnType<typeof createSchema>;
  };
}

const createAttioSdk = (input: AttioClientInput = {}): AttioSdk => {
  const client = resolveAttioClient(input);

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
      delete: (params) => deleteRecord({ ...params, client }),
      query: (params) => queryRecords({ ...params, client }),
    },
    lists: {
      list: (params = {}) => listLists({ ...params, client }),
      get: (params) => getList({ ...params, client }),
      queryEntries: (params) => queryListEntries({ ...params, client }),
      addEntry: (params) => addListEntry({ ...params, client }),
      updateEntry: (params) => updateListEntry({ ...params, client }),
      removeEntry: (params) => removeListEntry({ ...params, client }),
    },
    metadata: {
      listAttributes: (params) => listAttributes({ ...params, client }),
      getAttribute: (params) => getAttribute({ ...params, client }),
      getAttributeOptions: (params) =>
        getAttributeOptions({ ...params, client }),
      getAttributeStatuses: (params) =>
        getAttributeStatuses({ ...params, client }),
      schema: (params) => createSchema({ ...params, client }),
    },
  };
};

export type { AttioSdk };
export { createAttioSdk };
