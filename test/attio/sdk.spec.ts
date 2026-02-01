import { describe, expect, it, vi } from "vitest";
import { createAttioClient } from "../../src/attio/client";
import { createAttioSdk } from "../../src/attio/sdk";

const mocks = vi.hoisted(() => ({
  objects: {
    listObjects: vi.fn().mockResolvedValue([]),
    getObject: vi.fn().mockResolvedValue({}),
    createObject: vi.fn().mockResolvedValue({}),
    updateObject: vi.fn().mockResolvedValue({}),
  },
  records: {
    createRecord: vi.fn().mockResolvedValue({}),
    updateRecord: vi.fn().mockResolvedValue({}),
    upsertRecord: vi.fn().mockResolvedValue({}),
    getRecord: vi.fn().mockResolvedValue({}),
    deleteRecord: vi.fn().mockResolvedValue(true),
    queryRecords: vi.fn().mockResolvedValue([]),
  },
  lists: {
    listLists: vi.fn().mockResolvedValue([]),
    getList: vi.fn().mockResolvedValue({}),
    queryListEntries: vi.fn().mockResolvedValue([]),
    addListEntry: vi.fn().mockResolvedValue({}),
    updateListEntry: vi.fn().mockResolvedValue({}),
    removeListEntry: vi.fn().mockResolvedValue(true),
  },
  metadata: {
    listAttributes: vi.fn().mockResolvedValue([]),
    getAttribute: vi.fn().mockResolvedValue({}),
    getAttributeOptions: vi.fn().mockResolvedValue([]),
    getAttributeStatuses: vi.fn().mockResolvedValue([]),
  },
  schema: {
    createSchema: vi.fn().mockResolvedValue({ attributes: [] }),
  },
}));

vi.mock("../../src/attio/objects", () => mocks.objects);
vi.mock("../../src/attio/records", () => mocks.records);
vi.mock("../../src/attio/lists", () => mocks.lists);
vi.mock("../../src/attio/metadata", () => mocks.metadata);
vi.mock("../../src/attio/schema", () => mocks.schema);

describe("createAttioSdk", () => {
  it("binds client into convenience methods", async () => {
    const mockFetch: typeof fetch = () =>
      Promise.resolve(
        new Response(JSON.stringify({ data: {} }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

    const client = createAttioClient({
      authToken: "attio_test_token_12345",
      fetch: mockFetch,
    });

    const sdk = createAttioSdk({ client });

    await sdk.objects.list();
    await sdk.objects.get({ object: "companies" });
    await sdk.objects.create({
      apiSlug: "deals",
      singularNoun: "Deal",
      pluralNoun: "Deals",
    });
    await sdk.objects.update({ object: "deals", singularNoun: "Deal" });

    await sdk.records.create({ object: "companies", values: {} });
    await sdk.records.update({
      object: "companies",
      recordId: "rec_1",
      values: {},
    });
    await sdk.records.upsert({
      object: "companies",
      matchingAttribute: "domain",
      values: {},
    });
    await sdk.records.get({ object: "companies", recordId: "rec_1" });
    await sdk.records.delete({ object: "companies", recordId: "rec_1" });
    await sdk.records.query({ object: "companies" });

    await sdk.lists.list();
    await sdk.lists.get({ list: "list_1" });
    await sdk.lists.queryEntries({ list: "list_1" });
    await sdk.lists.addEntry({ list: "list_1", parentRecordId: "rec_1" });
    await sdk.lists.updateEntry({
      list: "list_1",
      entryId: "entry_1",
      entryValues: {},
    });
    await sdk.lists.removeEntry({ list: "list_1", entryId: "entry_1" });

    await sdk.metadata.listAttributes({
      target: "objects",
      identifier: "companies",
    });
    await sdk.metadata.getAttribute({
      target: "objects",
      identifier: "companies",
      attribute: "name",
    });
    await sdk.metadata.getAttributeOptions({
      target: "objects",
      identifier: "companies",
      attribute: "stage",
    });
    await sdk.metadata.getAttributeStatuses({
      target: "objects",
      identifier: "companies",
      attribute: "stage",
    });
    await sdk.metadata.schema({ target: "objects", identifier: "companies" });

    expect(mocks.objects.listObjects).toHaveBeenCalledWith({ client });
    expect(mocks.objects.getObject).toHaveBeenCalledWith({
      client,
      object: "companies",
    });
    expect(mocks.objects.createObject).toHaveBeenCalledWith({
      client,
      apiSlug: "deals",
      singularNoun: "Deal",
      pluralNoun: "Deals",
    });
    expect(mocks.objects.updateObject).toHaveBeenCalledWith({
      client,
      object: "deals",
      singularNoun: "Deal",
    });

    expect(mocks.records.createRecord).toHaveBeenCalledWith({
      client,
      object: "companies",
      values: {},
    });
    expect(mocks.records.updateRecord).toHaveBeenCalledWith({
      client,
      object: "companies",
      recordId: "rec_1",
      values: {},
    });
    expect(mocks.records.upsertRecord).toHaveBeenCalledWith({
      client,
      object: "companies",
      matchingAttribute: "domain",
      values: {},
    });
    expect(mocks.records.getRecord).toHaveBeenCalledWith({
      client,
      object: "companies",
      recordId: "rec_1",
    });
    expect(mocks.records.deleteRecord).toHaveBeenCalledWith({
      client,
      object: "companies",
      recordId: "rec_1",
    });
    expect(mocks.records.queryRecords).toHaveBeenCalledWith({
      client,
      object: "companies",
    });

    expect(mocks.lists.listLists).toHaveBeenCalledWith({ client });
    expect(mocks.lists.getList).toHaveBeenCalledWith({
      client,
      list: "list_1",
    });
    expect(mocks.lists.queryListEntries).toHaveBeenCalledWith({
      client,
      list: "list_1",
    });
    expect(mocks.lists.addListEntry).toHaveBeenCalledWith({
      client,
      list: "list_1",
      parentRecordId: "rec_1",
    });
    expect(mocks.lists.updateListEntry).toHaveBeenCalledWith({
      client,
      list: "list_1",
      entryId: "entry_1",
      entryValues: {},
    });
    expect(mocks.lists.removeListEntry).toHaveBeenCalledWith({
      client,
      list: "list_1",
      entryId: "entry_1",
    });

    expect(mocks.metadata.listAttributes).toHaveBeenCalledWith({
      client,
      target: "objects",
      identifier: "companies",
    });
    expect(mocks.metadata.getAttribute).toHaveBeenCalledWith({
      client,
      target: "objects",
      identifier: "companies",
      attribute: "name",
    });
    expect(mocks.metadata.getAttributeOptions).toHaveBeenCalledWith({
      client,
      target: "objects",
      identifier: "companies",
      attribute: "stage",
    });
    expect(mocks.metadata.getAttributeStatuses).toHaveBeenCalledWith({
      client,
      target: "objects",
      identifier: "companies",
      attribute: "stage",
    });
    expect(mocks.schema.createSchema).toHaveBeenCalledWith({
      client,
      target: "objects",
      identifier: "companies",
    });
  });

  it("returns underlying results from SDK methods", async () => {
    const mockObjects = [{ api_slug: "companies" }, { api_slug: "people" }];
    const mockRecord = { id: "rec_123", values: { name: "Test" } };

    mocks.objects.listObjects.mockResolvedValue(mockObjects);
    mocks.records.getRecord.mockResolvedValue(mockRecord);

    const mockFetch: typeof fetch = () =>
      Promise.resolve(
        new Response(JSON.stringify({ data: {} }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

    const client = createAttioClient({
      authToken: "attio_test_token_12345",
      fetch: mockFetch,
    });

    const sdk = createAttioSdk({ client });

    const objectsResult = await sdk.objects.list();
    expect(objectsResult).toEqual(mockObjects);

    const recordResult = await sdk.records.get({
      object: "companies",
      recordId: "rec_123",
    });
    expect(recordResult).toEqual(mockRecord);
  });

  it("propagates errors from underlying methods", async () => {
    const testError = new Error("API Error");
    mocks.objects.createObject.mockRejectedValue(testError);

    const mockFetch: typeof fetch = () =>
      Promise.resolve(
        new Response(JSON.stringify({ data: {} }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

    const client = createAttioClient({
      authToken: "attio_test_token_12345",
      fetch: mockFetch,
    });

    const sdk = createAttioSdk({ client });

    await expect(
      sdk.objects.create({
        apiSlug: "deals",
        singularNoun: "Deal",
        pluralNoun: "Deals",
      }),
    ).rejects.toThrow("API Error");
  });
});
