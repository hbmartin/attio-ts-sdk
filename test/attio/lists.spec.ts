import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const getListsRequest = vi.fn();
const getListByIdRequest = vi.fn();
const queryEntriesRequest = vi.fn();
const addEntryRequest = vi.fn();
const updateEntryRequest = vi.fn();
const deleteEntryRequest = vi.fn();
const resolveAttioClient = vi.fn();

vi.mock("../../src/generated", async () => {
  const actual = await vi.importActual<typeof import("../../src/generated")>(
    "../../src/generated",
  );
  return {
    ...actual,
    getV2Lists: getListsRequest,
    getV2ListsByList: getListByIdRequest,
    postV2ListsByListEntriesQuery: queryEntriesRequest,
    postV2ListsByListEntries: addEntryRequest,
    patchV2ListsByListEntriesByEntryId: updateEntryRequest,
    deleteV2ListsByListEntriesByEntryId: deleteEntryRequest,
  };
});

vi.mock("../../src/attio/client", () => ({
  resolveAttioClient,
}));

describe("lists", () => {
  let listLists: typeof import("../../src/attio/lists").listLists;
  let getList: typeof import("../../src/attio/lists").getList;
  let queryListEntries: typeof import("../../src/attio/lists").queryListEntries;
  let addListEntry: typeof import("../../src/attio/lists").addListEntry;
  let updateListEntry: typeof import("../../src/attio/lists").updateListEntry;
  let removeListEntry: typeof import("../../src/attio/lists").removeListEntry;

  beforeAll(async () => {
    ({
      listLists,
      getList,
      queryListEntries,
      addListEntry,
      updateListEntry,
      removeListEntry,
    } = await import("../../src/attio/lists"));
  });

  beforeEach(() => {
    vi.clearAllMocks();
    resolveAttioClient.mockReturnValue({});
  });

  describe("listLists", () => {
    it("returns unwrapped items from response", async () => {
      const lists = [{ id: "list-1" }, { id: "list-2" }];
      getListsRequest.mockResolvedValue({ data: { data: lists } });

      const result = await listLists();

      expect(result).toEqual(lists);
      expect(getListsRequest).toHaveBeenCalledWith({ client: {} });
    });

    it("passes client input to resolveAttioClient", async () => {
      getListsRequest.mockResolvedValue({ data: { data: [] } });

      await listLists({ apiKey: "test-key" });

      expect(resolveAttioClient).toHaveBeenCalledWith({ apiKey: "test-key" });
    });
  });

  describe("getList", () => {
    it("returns unwrapped list data", async () => {
      const list = { id: "list-1", name: "Sales Pipeline" };
      getListByIdRequest.mockResolvedValue({ data: list });

      const result = await getList({ list: "list-1" });

      expect(result).toEqual(list);
      expect(getListByIdRequest).toHaveBeenCalledWith({
        client: {},
        path: { list: "list-1" },
      });
    });
  });

  describe("queryListEntries", () => {
    it("queries entries with filter", async () => {
      const entries = [{ id: "entry-1" }, { id: "entry-2" }];
      queryEntriesRequest.mockResolvedValue({ data: { data: entries } });

      const result = await queryListEntries({
        list: "list-1",
        filter: { status: { $eq: "active" } },
      });

      expect(result).toEqual(entries);
      expect(queryEntriesRequest).toHaveBeenCalledWith({
        client: {},
        path: { list: "list-1" },
        body: {
          filter: { status: { $eq: "active" } },
          limit: undefined,
          offset: undefined,
        },
      });
    });

    it("queries entries with pagination", async () => {
      queryEntriesRequest.mockResolvedValue({ data: { data: [] } });

      await queryListEntries({
        list: "list-1",
        limit: 10,
        offset: 20,
      });

      expect(queryEntriesRequest).toHaveBeenCalledWith({
        client: {},
        path: { list: "list-1" },
        body: {
          filter: undefined,
          limit: 10,
          offset: 20,
        },
      });
    });

    it("passes additional options", async () => {
      queryEntriesRequest.mockResolvedValue({ data: { data: [] } });

      await queryListEntries({
        list: "list-1",
        options: { headers: { "X-Custom": "value" } },
      });

      expect(queryEntriesRequest).toHaveBeenCalledWith({
        client: {},
        path: { list: "list-1" },
        body: {
          filter: undefined,
          limit: undefined,
          offset: undefined,
        },
        headers: { "X-Custom": "value" },
      });
    });
  });

  describe("addListEntry", () => {
    it("adds entry with parent record", async () => {
      const newEntry = { id: "entry-new" };
      addEntryRequest.mockResolvedValue({ data: newEntry });

      const result = await addListEntry({
        list: "list-1",
        parentRecordId: "rec-123",
      });

      expect(result).toEqual(newEntry);
      expect(addEntryRequest).toHaveBeenCalledWith({
        client: {},
        path: { list: "list-1" },
        body: {
          data: {
            parent_record_id: "rec-123",
            entry_values: {},
          },
        },
      });
    });

    it("adds entry with entry values", async () => {
      addEntryRequest.mockResolvedValue({ data: {} });

      await addListEntry({
        list: "list-1",
        parentRecordId: "rec-123",
        entryValues: { stage: "qualified" },
      });

      expect(addEntryRequest).toHaveBeenCalledWith({
        client: {},
        path: { list: "list-1" },
        body: {
          data: {
            parent_record_id: "rec-123",
            entry_values: { stage: "qualified" },
          },
        },
      });
    });

    it("passes additional options", async () => {
      addEntryRequest.mockResolvedValue({ data: {} });

      await addListEntry({
        list: "list-1",
        parentRecordId: "rec-123",
        options: { headers: { "X-Custom": "value" } },
      });

      expect(addEntryRequest).toHaveBeenCalledWith({
        client: {},
        path: { list: "list-1" },
        body: {
          data: {
            parent_record_id: "rec-123",
            entry_values: {},
          },
        },
        headers: { "X-Custom": "value" },
      });
    });
  });

  describe("updateListEntry", () => {
    it("updates entry values", async () => {
      const updatedEntry = { id: "entry-1", stage: "won" };
      updateEntryRequest.mockResolvedValue({ data: updatedEntry });

      const result = await updateListEntry({
        list: "list-1",
        entryId: "entry-1",
        entryValues: { stage: "won" },
      });

      expect(result).toEqual(updatedEntry);
      expect(updateEntryRequest).toHaveBeenCalledWith({
        client: {},
        path: { list: "list-1", entry_id: "entry-1" },
        body: {
          data: {
            entry_values: { stage: "won" },
          },
        },
      });
    });

    it("passes additional options", async () => {
      updateEntryRequest.mockResolvedValue({ data: {} });

      await updateListEntry({
        list: "list-1",
        entryId: "entry-1",
        entryValues: { stage: "lost" },
        options: { headers: { "X-Custom": "value" } },
      });

      expect(updateEntryRequest).toHaveBeenCalledWith({
        client: {},
        path: { list: "list-1", entry_id: "entry-1" },
        body: {
          data: {
            entry_values: { stage: "lost" },
          },
        },
        headers: { "X-Custom": "value" },
      });
    });
  });

  describe("removeListEntry", () => {
    it("removes entry and returns true", async () => {
      deleteEntryRequest.mockResolvedValue({});

      const result = await removeListEntry({
        list: "list-1",
        entryId: "entry-1",
      });

      expect(result).toBe(true);
      expect(deleteEntryRequest).toHaveBeenCalledWith({
        client: {},
        path: { list: "list-1", entry_id: "entry-1" },
        throwOnError: true,
      });
    });

    it("passes additional options", async () => {
      deleteEntryRequest.mockResolvedValue({});

      await removeListEntry({
        list: "list-1",
        entryId: "entry-1",
        options: { headers: { "X-Custom": "value" } },
      });

      expect(deleteEntryRequest).toHaveBeenCalledWith({
        client: {},
        path: { list: "list-1", entry_id: "entry-1" },
        headers: { "X-Custom": "value" },
        throwOnError: true,
      });
    });
  });
});
