import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const createRecordRequest = vi.fn();
const updateRecordRequest = vi.fn();
const upsertRecordRequest = vi.fn();
const getRecordRequest = vi.fn();
const deleteRecordRequest = vi.fn();
const queryRecordsRequest = vi.fn();
const resolveAttioClient = vi.fn();

vi.mock("../../src/generated", async () => {
  const actual = await vi.importActual<typeof import("../../src/generated")>(
    "../../src/generated",
  );
  return {
    ...actual,
    postV2ObjectsByObjectRecords: createRecordRequest,
    patchV2ObjectsByObjectRecordsByRecordId: updateRecordRequest,
    putV2ObjectsByObjectRecords: upsertRecordRequest,
    getV2ObjectsByObjectRecordsByRecordId: getRecordRequest,
    deleteV2ObjectsByObjectRecordsByRecordId: deleteRecordRequest,
    postV2ObjectsByObjectRecordsQuery: queryRecordsRequest,
  };
});

vi.mock("../../src/attio/client", () => ({
  resolveAttioClient,
}));

vi.mock("../../src/attio/record-utils", () => ({
  normalizeRecord: vi.fn((record) => record),
  normalizeRecords: vi.fn((records) => records),
}));

describe("records", () => {
  let createRecord: typeof import("../../src/attio/records").createRecord;
  let updateRecord: typeof import("../../src/attio/records").updateRecord;
  let upsertRecord: typeof import("../../src/attio/records").upsertRecord;
  let getRecord: typeof import("../../src/attio/records").getRecord;
  let deleteRecord: typeof import("../../src/attio/records").deleteRecord;
  let queryRecords: typeof import("../../src/attio/records").queryRecords;

  beforeAll(async () => {
    ({
      createRecord,
      updateRecord,
      upsertRecord,
      getRecord,
      deleteRecord,
      queryRecords,
    } = await import("../../src/attio/records"));
  });

  beforeEach(() => {
    vi.resetAllMocks();
    resolveAttioClient.mockReturnValue({});
  });

  describe("createRecord", () => {
    it("creates record with values", async () => {
      const record = { id: "rec-1", name: "Acme" };
      createRecordRequest.mockResolvedValue({ data: record });

      const result = await createRecord({
        object: "companies",
        values: { name: "Acme" },
      });

      expect(result).toEqual(record);
      expect(createRecordRequest).toHaveBeenCalledWith({
        client: {},
        path: { object: "companies" },
        body: {
          data: {
            values: { name: "Acme" },
          },
        },
      });
    });

    it("passes additional options", async () => {
      createRecordRequest.mockResolvedValue({ data: {} });

      await createRecord({
        object: "companies",
        values: { name: "Test" },
        options: { headers: { "X-Custom": "value" } },
      });

      expect(createRecordRequest).toHaveBeenCalledWith({
        client: {},
        path: { object: "companies" },
        body: {
          data: {
            values: { name: "Test" },
          },
        },
        headers: { "X-Custom": "value" },
      });
    });
  });

  describe("updateRecord", () => {
    it("updates record with values", async () => {
      const record = { id: "rec-1", name: "Updated Acme" };
      updateRecordRequest.mockResolvedValue({ data: record });

      const result = await updateRecord({
        object: "companies",
        recordId: "rec-1",
        values: { name: "Updated Acme" },
      });

      expect(result).toEqual(record);
      expect(updateRecordRequest).toHaveBeenCalledWith({
        client: {},
        path: { object: "companies", record_id: "rec-1" },
        body: {
          data: {
            values: { name: "Updated Acme" },
          },
        },
      });
    });

    it("passes additional options", async () => {
      updateRecordRequest.mockResolvedValue({ data: {} });

      await updateRecord({
        object: "companies",
        recordId: "rec-1",
        values: { status: "active" },
        options: { headers: { "X-Custom": "value" } },
      });

      expect(updateRecordRequest).toHaveBeenCalledWith({
        client: {},
        path: { object: "companies", record_id: "rec-1" },
        body: {
          data: {
            values: { status: "active" },
          },
        },
        headers: { "X-Custom": "value" },
      });
    });
  });

  describe("upsertRecord", () => {
    it("upserts record with matching attribute", async () => {
      const record = { id: "rec-1", email: "test@example.com" };
      upsertRecordRequest.mockResolvedValue({ data: record });

      const result = await upsertRecord({
        object: "people",
        matchingAttribute: "email",
        values: { email: "test@example.com" },
      });

      expect(result).toEqual(record);
      expect(upsertRecordRequest).toHaveBeenCalledWith({
        client: {},
        path: { object: "people" },
        body: {
          data: {
            values: { email: "test@example.com" },
          },
        },
        query: {
          matching_attribute: "email",
        },
      });
    });

    it("passes additional options", async () => {
      upsertRecordRequest.mockResolvedValue({ data: {} });

      await upsertRecord({
        object: "people",
        matchingAttribute: "email",
        values: { email: "test@example.com" },
        options: { headers: { "X-Custom": "value" } },
      });

      expect(upsertRecordRequest).toHaveBeenCalledWith({
        client: {},
        path: { object: "people" },
        body: {
          data: {
            values: { email: "test@example.com" },
          },
        },
        query: {
          matching_attribute: "email",
        },
        headers: { "X-Custom": "value" },
      });
    });
  });

  describe("getRecord", () => {
    it("gets record by id", async () => {
      const record = { id: "rec-1", name: "Acme" };
      getRecordRequest.mockResolvedValue({ data: record });

      const result = await getRecord({
        object: "companies",
        recordId: "rec-1",
      });

      expect(result).toEqual(record);
      expect(getRecordRequest).toHaveBeenCalledWith({
        client: {},
        path: { object: "companies", record_id: "rec-1" },
      });
    });

    it("passes additional options", async () => {
      getRecordRequest.mockResolvedValue({ data: {} });

      await getRecord({
        object: "companies",
        recordId: "rec-1",
        options: { headers: { "X-Custom": "value" } },
      });

      expect(getRecordRequest).toHaveBeenCalledWith({
        client: {},
        path: { object: "companies", record_id: "rec-1" },
        headers: { "X-Custom": "value" },
      });
    });
  });

  describe("deleteRecord", () => {
    it("forces throwOnError true to surface delete failures", async () => {
      deleteRecordRequest.mockResolvedValue({});

      await deleteRecord({
        object: "companies",
        recordId: "rec-123",
        options: { throwOnError: false },
      });

      expect(deleteRecordRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          throwOnError: true,
        }),
      );
    });

    it("returns true when delete succeeds", async () => {
      deleteRecordRequest.mockResolvedValue({});

      const result = await deleteRecord({
        object: "companies",
        recordId: "rec-456",
      });

      expect(result).toBe(true);
    });
  });

  describe("queryRecords", () => {
    it("queries records with filter", async () => {
      const records = [{ id: "rec-1" }, { id: "rec-2" }];
      queryRecordsRequest.mockResolvedValue({ data: { data: records } });

      const result = await queryRecords({
        object: "companies",
        filter: { status: { $eq: "active" } },
      });

      expect(result).toEqual(records);
      expect(queryRecordsRequest).toHaveBeenCalledWith({
        client: {},
        path: { object: "companies" },
        body: {
          filter: { status: { $eq: "active" } },
          sorts: undefined,
          limit: undefined,
          offset: undefined,
        },
      });
    });

    it("queries records with sorts", async () => {
      queryRecordsRequest.mockResolvedValue({ data: { data: [] } });

      await queryRecords({
        object: "companies",
        sorts: [{ field: "name", direction: "asc" }],
      });

      expect(queryRecordsRequest).toHaveBeenCalledWith({
        client: {},
        path: { object: "companies" },
        body: {
          filter: undefined,
          sorts: [{ field: "name", direction: "asc" }],
          limit: undefined,
          offset: undefined,
        },
      });
    });

    it("queries records with pagination", async () => {
      queryRecordsRequest.mockResolvedValue({ data: { data: [] } });

      await queryRecords({
        object: "companies",
        limit: 10,
        offset: 20,
      });

      expect(queryRecordsRequest).toHaveBeenCalledWith({
        client: {},
        path: { object: "companies" },
        body: {
          filter: undefined,
          sorts: undefined,
          limit: 10,
          offset: 20,
        },
      });
    });

    it("passes additional options", async () => {
      queryRecordsRequest.mockResolvedValue({ data: { data: [] } });

      await queryRecords({
        object: "companies",
        options: { headers: { "X-Custom": "value" } },
      });

      expect(queryRecordsRequest).toHaveBeenCalledWith({
        client: {},
        path: { object: "companies" },
        body: {
          filter: undefined,
          sorts: undefined,
          limit: undefined,
          offset: undefined,
        },
        headers: { "X-Custom": "value" },
      });
    });

    describe("with paginate: true", () => {
      it("fetches all pages and returns combined results", async () => {
        queryRecordsRequest
          .mockResolvedValueOnce({
            data: { data: [{ id: "rec-1" }, { id: "rec-2" }] },
          })
          .mockResolvedValueOnce({
            data: { data: [{ id: "rec-3" }] },
          });

        const result = await queryRecords({
          object: "companies",
          paginate: true,
          limit: 2,
        });

        expect(result).toEqual([
          { id: "rec-1" },
          { id: "rec-2" },
          { id: "rec-3" },
        ]);
        expect(queryRecordsRequest).toHaveBeenCalledTimes(2);
      });

      it("respects maxItems option", async () => {
        queryRecordsRequest.mockResolvedValue({
          data: { data: [{ id: "rec-1" }, { id: "rec-2" }] },
        });

        const result = await queryRecords({
          object: "companies",
          paginate: true,
          limit: 2,
          maxItems: 1,
        });

        expect(result).toEqual([{ id: "rec-1" }]);
      });

      it("respects maxPages option", async () => {
        queryRecordsRequest
          .mockResolvedValueOnce({
            data: { data: [{ id: "rec-1" }, { id: "rec-2" }] },
          })
          .mockResolvedValueOnce({
            data: { data: [{ id: "rec-3" }, { id: "rec-4" }] },
          });

        const result = await queryRecords({
          object: "companies",
          paginate: true,
          limit: 2,
          maxPages: 1,
        });

        expect(result).toEqual([{ id: "rec-1" }, { id: "rec-2" }]);
        expect(queryRecordsRequest).toHaveBeenCalledTimes(1);
      });

      it("passes filter and sorts to each page request", async () => {
        queryRecordsRequest.mockResolvedValueOnce({
          data: { data: [{ id: "rec-1" }] },
        });

        await queryRecords({
          object: "companies",
          paginate: true,
          filter: { status: { $eq: "active" } },
          sorts: [{ field: "name", direction: "asc" }],
          limit: 10,
        });

        expect(queryRecordsRequest).toHaveBeenCalledWith(
          expect.objectContaining({
            body: expect.objectContaining({
              filter: { status: { $eq: "active" } },
              sorts: [{ field: "name", direction: "asc" }],
            }),
          }),
        );
      });
    });

    describe("with paginate: 'stream'", () => {
      it("returns an async iterable that yields records", async () => {
        queryRecordsRequest
          .mockResolvedValueOnce({
            data: { data: [{ id: "rec-1" }, { id: "rec-2" }] },
          })
          .mockResolvedValueOnce({
            data: { data: [{ id: "rec-3" }] },
          });

        const records: { id: string }[] = [];
        for await (const record of queryRecords({
          object: "companies",
          paginate: "stream",
          limit: 2,
        })) {
          records.push(record);
        }

        expect(records).toEqual([
          { id: "rec-1" },
          { id: "rec-2" },
          { id: "rec-3" },
        ]);
      });

      it("allows early exit from iteration", async () => {
        queryRecordsRequest.mockResolvedValueOnce({
          data: { data: [{ id: "rec-1" }, { id: "rec-2" }, { id: "rec-3" }] },
        });

        const records: { id: string }[] = [];
        for await (const record of queryRecords({
          object: "companies",
          paginate: "stream",
          limit: 10,
        })) {
          records.push(record);
          if (records.length === 2) {
            break;
          }
        }

        expect(records).toEqual([{ id: "rec-1" }, { id: "rec-2" }]);
        expect(queryRecordsRequest).toHaveBeenCalledTimes(1);
      });

      it("respects maxItems option", async () => {
        queryRecordsRequest.mockResolvedValue({
          data: { data: [{ id: "rec-1" }, { id: "rec-2" }] },
        });

        const records: { id: string }[] = [];
        for await (const record of queryRecords({
          object: "companies",
          paginate: "stream",
          limit: 2,
          maxItems: 1,
        })) {
          records.push(record);
        }

        expect(records).toEqual([{ id: "rec-1" }]);
      });

      it("supports AbortSignal cancellation", async () => {
        const controller = new AbortController();
        queryRecordsRequest.mockResolvedValueOnce({
          data: { data: [{ id: "rec-1" }, { id: "rec-2" }] },
        });

        const records: { id: string }[] = [];
        for await (const record of queryRecords({
          object: "companies",
          paginate: "stream",
          limit: 2,
          signal: controller.signal,
        })) {
          records.push(record);
          controller.abort();
        }

        expect(records).toEqual([{ id: "rec-1" }]);
      });
    });
  });
});
