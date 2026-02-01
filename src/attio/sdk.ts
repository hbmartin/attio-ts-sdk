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

/** Helper type to omit client and config from input types for SDK methods */
type SdkInput<T> = Omit<T, "client" | "config">;

/** Type alias for delete record input (same shape as RecordGetInput) */
type RecordDeleteInput = RecordGetInput;

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
    delete: (
      input: SdkInput<RecordDeleteInput>,
    ) => ReturnType<typeof deleteRecord>;
    query: (
      input: SdkInput<RecordQueryInput>,
    ) => ReturnType<typeof queryRecords>;
  };
  lists: {
    list: (input?: SdkInput<AttioClientInput>) => ReturnType<typeof listLists>;
    get: (input: SdkInput<GetListInput>) => ReturnType<typeof getList>;
    queryEntries: (
      input: SdkInput<ListQueryInput>,
    ) => ReturnType<typeof queryListEntries>;
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
  metadata: {
    listAttributes: (
      input: SdkInput<AttributeListInput>,
    ) => ReturnType<typeof listAttributes>;
    getAttribute: (
      input: SdkInput<AttributeInput>,
    ) => ReturnType<typeof getAttribute>;
    getAttributeOptions: (
      input: SdkInput<AttributeInput>,
    ) => ReturnType<typeof getAttributeOptions>;
    getAttributeStatuses: (
      input: SdkInput<AttributeInput>,
    ) => ReturnType<typeof getAttributeStatuses>;
    schema: (input: SdkInput<SchemaInput>) => ReturnType<typeof createSchema>;
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

export type { AttioSdk, RecordDeleteInput, SdkInput };
export { createAttioSdk };
