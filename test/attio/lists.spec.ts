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

describe("lists", () => {
  let listLists: typeof import("../../src/attio/lists").listLists;
  let getList: typeof import("../../src/attio/lists").getList;
  let queryListEntries: typeof import("../../src/attio/lists").queryListEntries;
  let addListEntry: typeof import("../../src/attio/lists").addListEntry;
  let updateListEntry: typeof import("../../src/attio/lists").updateListEntry;
  let removeListEntry: typeof import("../../src/attio/lists").removeListEntry;
  let createListId: typeof import("../../src/attio/lists").createListId;

  beforeAll(async () => {
    ({
      listLists,
      getList,
      queryListEntries,
      addListEntry,
      updateListEntry,
      removeListEntry,
      createListId,
    } = await import("../../src/attio/lists"));
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

    it("passes additional options", async () => {
      getListByIdRequest.mockResolvedValue({ data: {} });

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
      const newEntry = { id: "entry-new" };
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
      addEntryRequest.mockResolvedValue({ data: {} });

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
      addEntryRequest.mockResolvedValue({ data: {} });

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
