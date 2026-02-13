import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

const getListsRequest = vi.fn();
const getListByIdRequest = vi.fn();
const queryEntriesRequest = vi.fn();
const addEntryRequest = vi.fn();
const updateEntryRequest = vi.fn();
const deleteEntryRequest = vi.fn();
const resolveAttioClient = vi.fn();
const normalizeRecords = vi.fn((records) => records);

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

vi.mock("../../src/attio/record-utils", () => ({
  normalizeRecords,
}));

const WS_ID = "a1b2c3d4-e5f6-4a7b-8c9d-e0f1a2b3c4d5";
const LIST_ID_1 = "11111111-2222-4333-a444-555555555555";
const LIST_ID_2 = "22222222-3333-4444-a555-666666666666";
const ENTRY_ID_1 = "33333333-4444-4555-a666-777777777777";
const RECORD_ID = "44444444-5555-4666-a777-888888888888";
const MEMBER_ID = "55555555-6666-4777-a888-999999999999";

const makeList = (overrides: Record<string, unknown> = {}) => ({
  id: { workspace_id: WS_ID, list_id: LIST_ID_1 },
  api_slug: "sales-pipeline",
  name: "Sales Pipeline",
  parent_object: ["companies"],
  workspace_access: "full-access",
  workspace_member_access: [
    { workspace_member_id: MEMBER_ID, level: "full-access" },
  ],
  created_by_actor: { id: MEMBER_ID, type: "workspace-member" },
  created_at: "2024-01-01T00:00:00Z",
  ...overrides,
});

const makeEntry = (overrides: Record<string, unknown> = {}) => ({
  id: { workspace_id: WS_ID, list_id: LIST_ID_1, entry_id: ENTRY_ID_1 },
  parent_record_id: RECORD_ID,
  parent_object: "companies",
  created_at: "2024-01-01T00:00:00Z",
  entry_values: {},
  ...overrides,
});

describe("lists", () => {
  let listLists: typeof import("../../src/attio/lists").listLists;
  let getList: typeof import("../../src/attio/lists").getList;
  let queryListEntries: typeof import("../../src/attio/lists").queryListEntries;
  let addListEntry: typeof import("../../src/attio/lists").addListEntry;
  let updateListEntry: typeof import("../../src/attio/lists").updateListEntry;
  let removeListEntry: typeof import("../../src/attio/lists").removeListEntry;
  let createListId: typeof import("../../src/attio/lists").createListId;
  let createEntryId: typeof import("../../src/attio/lists").createEntryId;
  let createParentObjectId: typeof import("../../src/attio/lists").createParentObjectId;
  let createParentRecordId: typeof import("../../src/attio/lists").createParentRecordId;
  let filters: typeof import("../../src/attio/filters").filters;

  beforeAll(async () => {
    ({
      listLists,
      getList,
      queryListEntries,
      addListEntry,
      updateListEntry,
      removeListEntry,
      createListId,
      createEntryId,
      createParentObjectId,
      createParentRecordId,
    } = await import("../../src/attio/lists"));
    ({ filters } = await import("../../src/attio/filters"));
  });

  beforeEach(() => {
    vi.resetAllMocks();
    resolveAttioClient.mockReturnValue({});
    normalizeRecords.mockImplementation((records) => records);
  });

  describe("createListId", () => {
    it("creates a branded ListId from a valid string", () => {
      const id = createListId("list-123");
      expect(id).toBe("list-123");
    });

    it("throws error when id is empty string", () => {
      expect(() => createListId("")).toThrow("ListId cannot be empty");
    });
  });

  describe("other ID factories", () => {
    it("creates branded IDs for list entries and parents", () => {
      expect(createEntryId("entry-123")).toBe("entry-123");
      expect(createParentObjectId("companies")).toBe("companies");
      expect(createParentRecordId("rec-123")).toBe("rec-123");
    });

    it("throws for empty IDs", () => {
      expect(() => createEntryId("")).toThrow("EntryId cannot be empty");
      expect(() => createParentObjectId("")).toThrow(
        "ParentObjectId cannot be empty",
      );
      expect(() => createParentRecordId("")).toThrow(
        "ParentRecordId cannot be empty",
      );
    });
  });

  describe("listLists", () => {
    it("returns unwrapped items from response", async () => {
      const list1 = makeList();
      const list2 = makeList({
        id: { workspace_id: WS_ID, list_id: LIST_ID_2 },
        api_slug: "onboarding",
        name: "Onboarding",
      });
      getListsRequest.mockResolvedValue({ data: { data: [list1, list2] } });

      const result = await listLists();

      expect(result).toEqual([list1, list2]);
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
      const list = makeList();
      getListByIdRequest.mockResolvedValue({ data: list });

      const result = await getList({ list: "list-1" });

      expect(result).toEqual(list);
      expect(getListByIdRequest).toHaveBeenCalledWith({
        client: {},
        path: { list: "list-1" },
      });
    });

    it("passes additional options", async () => {
      getListByIdRequest.mockResolvedValue({ data: makeList() });

      await getList({
        list: "list-1",
        options: { headers: { "X-Custom": "value" } },
      });

      expect(getListByIdRequest).toHaveBeenCalledWith({
        client: {},
        path: { list: "list-1" },
        headers: { "X-Custom": "value" },
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

    it("accepts filters helper output", async () => {
      queryEntriesRequest.mockResolvedValue({ data: { data: [] } });
      const filter = filters.or(
        filters.eq("status", "active"),
        filters.eq("status", "pending"),
      );

      await queryListEntries({
        list: "list-1",
        filter,
      });

      expect(queryEntriesRequest).toHaveBeenCalledWith({
        client: {},
        path: { list: "list-1" },
        body: {
          filter,
          limit: undefined,
          offset: undefined,
        },
      });
    });

    it("throws when filter shape is invalid", () => {
      const invalidFilter = JSON.parse('{"status":{"$not_empty":false}}');

      expect(() =>
        queryListEntries({
          list: "list-1",
          filter: invalidFilter,
        }),
      ).toThrow();
      expect(queryEntriesRequest).not.toHaveBeenCalled();
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

    describe("with paginate: true", () => {
      it("fetches all pages and returns combined results", async () => {
        queryEntriesRequest
          .mockResolvedValueOnce({
            data: { data: [{ id: "entry-1" }, { id: "entry-2" }] },
          })
          .mockResolvedValueOnce({
            data: { data: [{ id: "entry-3" }] },
          });

        const result = await queryListEntries({
          list: "list-1",
          paginate: true,
          limit: 2,
        });

        expect(result).toEqual([
          { id: "entry-1" },
          { id: "entry-2" },
          { id: "entry-3" },
        ]);
        expect(queryEntriesRequest).toHaveBeenCalledTimes(2);
      });

      it("respects maxItems option", async () => {
        queryEntriesRequest.mockResolvedValue({
          data: { data: [{ id: "entry-1" }, { id: "entry-2" }] },
        });

        const result = await queryListEntries({
          list: "list-1",
          paginate: true,
          limit: 2,
          maxItems: 1,
        });

        expect(result).toEqual([{ id: "entry-1" }]);
      });

      it("respects maxPages option", async () => {
        queryEntriesRequest
          .mockResolvedValueOnce({
            data: { data: [{ id: "entry-1" }, { id: "entry-2" }] },
          })
          .mockResolvedValueOnce({
            data: { data: [{ id: "entry-3" }, { id: "entry-4" }] },
          });

        const result = await queryListEntries({
          list: "list-1",
          paginate: true,
          limit: 2,
          maxPages: 1,
        });

        expect(result).toEqual([{ id: "entry-1" }, { id: "entry-2" }]);
        expect(queryEntriesRequest).toHaveBeenCalledTimes(1);
      });

      it("passes filter to each page request", async () => {
        queryEntriesRequest.mockResolvedValueOnce({
          data: { data: [{ id: "entry-1" }] },
        });

        await queryListEntries({
          list: "list-1",
          paginate: true,
          filter: { status: { $eq: "active" } },
          limit: 10,
        });

        expect(queryEntriesRequest).toHaveBeenCalledWith(
          expect.objectContaining({
            body: expect.objectContaining({
              filter: { status: { $eq: "active" } },
            }),
          }),
        );
      });

      it("supports AbortSignal cancellation", async () => {
        const controller = new AbortController();
        queryEntriesRequest.mockImplementationOnce(async () => {
          controller.abort();
          return { data: { data: [{ id: "entry-1" }, { id: "entry-2" }] } };
        });

        const result = await queryListEntries({
          list: "list-1",
          paginate: true,
          limit: 2,
          signal: controller.signal,
        });

        expect(result).toEqual([{ id: "entry-1" }, { id: "entry-2" }]);
        expect(queryEntriesRequest).toHaveBeenCalledTimes(1);
      });

      it("forwards signal to the request", async () => {
        const controller = new AbortController();
        queryEntriesRequest.mockResolvedValueOnce({
          data: { data: [{ id: "entry-1" }] },
        });

        await queryListEntries({
          list: "list-1",
          paginate: true,
          limit: 10,
          signal: controller.signal,
        });

        expect(queryEntriesRequest).toHaveBeenCalledWith(
          expect.objectContaining({
            signal: controller.signal,
          }),
        );
      });
    });

    describe("with paginate: 'stream'", () => {
      it("returns an async iterable that yields entries", async () => {
        queryEntriesRequest
          .mockResolvedValueOnce({
            data: { data: [{ id: "entry-1" }, { id: "entry-2" }] },
          })
          .mockResolvedValueOnce({
            data: { data: [{ id: "entry-3" }] },
          });

        const entries: { id: string }[] = [];
        for await (const entry of queryListEntries({
          list: "list-1",
          paginate: "stream",
          limit: 2,
        })) {
          entries.push(entry);
        }

        expect(entries).toEqual([
          { id: "entry-1" },
          { id: "entry-2" },
          { id: "entry-3" },
        ]);
      });

      it("allows early exit from iteration", async () => {
        queryEntriesRequest.mockResolvedValueOnce({
          data: {
            data: [{ id: "entry-1" }, { id: "entry-2" }, { id: "entry-3" }],
          },
        });

        const entries: { id: string }[] = [];
        for await (const entry of queryListEntries({
          list: "list-1",
          paginate: "stream",
          limit: 10,
        })) {
          entries.push(entry);
          if (entries.length === 2) {
            break;
          }
        }

        expect(entries).toEqual([{ id: "entry-1" }, { id: "entry-2" }]);
        expect(queryEntriesRequest).toHaveBeenCalledTimes(1);
      });

      it("respects maxItems option", async () => {
        queryEntriesRequest.mockResolvedValue({
          data: { data: [{ id: "entry-1" }, { id: "entry-2" }] },
        });

        const entries: { id: string }[] = [];
        for await (const entry of queryListEntries({
          list: "list-1",
          paginate: "stream",
          limit: 2,
          maxItems: 1,
        })) {
          entries.push(entry);
        }

        expect(entries).toEqual([{ id: "entry-1" }]);
      });

      it("supports AbortSignal cancellation", async () => {
        const controller = new AbortController();
        queryEntriesRequest.mockResolvedValueOnce({
          data: { data: [{ id: "entry-1" }, { id: "entry-2" }] },
        });

        const entries: { id: string }[] = [];
        for await (const entry of queryListEntries({
          list: "list-1",
          paginate: "stream",
          limit: 2,
          signal: controller.signal,
        })) {
          entries.push(entry);
          controller.abort();
        }

        expect(entries).toEqual([{ id: "entry-1" }]);
      });
    });

    describe("with itemSchema", () => {
      const customEntrySchema = z.object({
        id: z.object({
          entry_id: z.string(),
        }),
        values: z.object({
          stage: z.string(),
        }),
      });

      it("validates entries against custom schema", async () => {
        const entries = [
          { id: { entry_id: "entry-1" }, values: { stage: "qualified" } },
          { id: { entry_id: "entry-2" }, values: { stage: "won" } },
        ];
        queryEntriesRequest.mockResolvedValue({ data: { data: entries } });

        const result = await queryListEntries({
          list: "list-1",
          itemSchema: customEntrySchema,
        });

        expect(result).toEqual(entries);
      });

      it("throws error when entries fail schema validation", async () => {
        const invalidEntries = [{ invalid: "structure" }];
        queryEntriesRequest.mockResolvedValue({
          data: { data: invalidEntries },
        });

        await expect(
          queryListEntries({
            list: "list-1",
            itemSchema: customEntrySchema,
          }),
        ).rejects.toThrow("Invalid API response");
      });

      it("uses custom schema with paginate: true", async () => {
        const entries = [
          { id: { entry_id: "entry-1" }, values: { stage: "qualified" } },
        ];
        queryEntriesRequest.mockResolvedValueOnce({ data: { data: entries } });

        const result = await queryListEntries({
          list: "list-1",
          paginate: true,
          itemSchema: customEntrySchema,
        });

        expect(result).toEqual(entries);
      });

      it("uses custom schema with paginate: 'stream'", async () => {
        const entries = [
          { id: { entry_id: "entry-1" }, values: { stage: "qualified" } },
        ];
        queryEntriesRequest.mockResolvedValueOnce({ data: { data: entries } });

        const collected: z.infer<typeof customEntrySchema>[] = [];
        for await (const entry of queryListEntries({
          list: "list-1",
          paginate: "stream",
          itemSchema: customEntrySchema,
        })) {
          collected.push(entry);
        }

        expect(collected).toEqual(entries);
      });

      it("throws error when entries fail schema validation with paginate: true", async () => {
        const invalidEntries = [{ invalid: "structure" }];
        queryEntriesRequest.mockResolvedValue({
          data: { data: invalidEntries },
        });

        await expect(
          queryListEntries({
            list: "list-1",
            paginate: true,
            itemSchema: customEntrySchema,
          }),
        ).rejects.toThrow("Invalid API response");
      });

      it("throws error when entries fail schema validation with paginate: 'stream'", async () => {
        const invalidEntries = [{ invalid: "structure" }];
        queryEntriesRequest.mockResolvedValue({
          data: { data: invalidEntries },
        });

        const consumeStream = async () => {
          for await (const _entry of queryListEntries({
            list: "list-1",
            paginate: "stream",
            itemSchema: customEntrySchema,
          })) {
            // consume iterator
          }
        };

        await expect(consumeStream()).rejects.toThrow("Invalid API response");
      });
    });
  });

  describe("addListEntry", () => {
    it("adds entry with parent object and record", async () => {
      const newEntry = makeEntry();
      addEntryRequest.mockResolvedValue({ data: newEntry });

      const result = await addListEntry({
        list: "list-1",
        parentObject: "companies",
        parentRecordId: "rec-123",
      });

      expect(result).toEqual(newEntry);
      expect(addEntryRequest).toHaveBeenCalledWith({
        client: {},
        path: { list: "list-1" },
        body: {
          data: {
            parent_object: "companies",
            parent_record_id: "rec-123",
            entry_values: {},
          },
        },
      });
    });

    it("adds entry with entry values", async () => {
      addEntryRequest.mockResolvedValue({ data: makeEntry() });

      await addListEntry({
        list: "list-1",
        parentObject: "people",
        parentRecordId: "rec-123",
        entryValues: { stage: "qualified" },
      });

      expect(addEntryRequest).toHaveBeenCalledWith({
        client: {},
        path: { list: "list-1" },
        body: {
          data: {
            parent_object: "people",
            parent_record_id: "rec-123",
            entry_values: { stage: "qualified" },
          },
        },
      });
    });

    it("passes additional options", async () => {
      addEntryRequest.mockResolvedValue({ data: makeEntry() });

      await addListEntry({
        list: "list-1",
        parentObject: "companies",
        parentRecordId: "rec-123",
        options: { headers: { "X-Custom": "value" } },
      });

      expect(addEntryRequest).toHaveBeenCalledWith({
        client: {},
        path: { list: "list-1" },
        body: {
          data: {
            parent_object: "companies",
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
      const updatedEntry = makeEntry();
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
      updateEntryRequest.mockResolvedValue({ data: makeEntry() });

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
