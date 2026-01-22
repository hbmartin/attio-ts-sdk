import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const searchRequest = vi.fn();
const resolveAttioClient = vi.fn();

vi.mock("../../src/generated", async () => {
  const actual = await vi.importActual<typeof import("../../src/generated")>(
    "../../src/generated",
  );
  return {
    ...actual,
    postV2ObjectsRecordsSearch: searchRequest,
  };
});

vi.mock("../../src/attio/client", () => ({
  resolveAttioClient,
}));

vi.mock("../../src/attio/record-utils", () => ({
  normalizeRecords: vi.fn((records) => records),
}));

describe("search", () => {
  let searchRecords: typeof import("../../src/attio/search").searchRecords;

  beforeAll(async () => {
    ({ searchRecords } = await import("../../src/attio/search"));
  });

  beforeEach(() => {
    vi.clearAllMocks();
    resolveAttioClient.mockReturnValue({});
  });

  describe("searchRecords", () => {
    it("searches with query and objects", async () => {
      const records = [{ id: "rec-1" }, { id: "rec-2" }];
      searchRequest.mockResolvedValue({ data: { data: records } });

      const result = await searchRecords({
        query: "test query",
        objects: ["companies", "people"],
      });

      expect(result).toEqual(records);
      expect(searchRequest).toHaveBeenCalledWith({
        client: {},
        body: {
          query: "test query",
          objects: ["companies", "people"],
          request_as: { type: "workspace" },
          limit: undefined,
        },
      });
    });

    it("uses default workspace request_as", async () => {
      searchRequest.mockResolvedValue({ data: { data: [] } });

      await searchRecords({
        query: "search",
        objects: ["companies"],
      });

      expect(searchRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.objectContaining({
            request_as: { type: "workspace" },
          }),
        }),
      );
    });

    it("allows custom requestAs with workspace-member and id", async () => {
      searchRequest.mockResolvedValue({ data: { data: [] } });

      await searchRecords({
        query: "search",
        objects: ["companies"],
        requestAs: {
          type: "workspace-member",
          workspace_member_id: "member-1",
        },
      });

      expect(searchRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.objectContaining({
            request_as: {
              type: "workspace-member",
              workspace_member_id: "member-1",
            },
          }),
        }),
      );
    });

    it("allows custom requestAs with workspace-member and email", async () => {
      searchRequest.mockResolvedValue({ data: { data: [] } });

      await searchRecords({
        query: "search",
        objects: ["companies"],
        requestAs: {
          type: "workspace-member",
          email_address: "user@example.com",
        },
      });

      expect(searchRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.objectContaining({
            request_as: {
              type: "workspace-member",
              email_address: "user@example.com",
            },
          }),
        }),
      );
    });

    it("applies limit", async () => {
      searchRequest.mockResolvedValue({ data: { data: [] } });

      await searchRecords({
        query: "search",
        objects: ["companies"],
        limit: 10,
      });

      expect(searchRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.objectContaining({
            limit: 10,
          }),
        }),
      );
    });

    it("passes additional options", async () => {
      searchRequest.mockResolvedValue({ data: { data: [] } });

      await searchRecords({
        query: "search",
        objects: ["companies"],
        options: { headers: { "X-Custom": "value" } },
      });

      expect(searchRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: { "X-Custom": "value" },
        }),
      );
    });

    it("passes client input to resolveAttioClient", async () => {
      searchRequest.mockResolvedValue({ data: { data: [] } });

      await searchRecords({
        query: "search",
        objects: ["companies"],
        apiKey: "test-key",
      });

      expect(resolveAttioClient).toHaveBeenCalledWith(
        expect.objectContaining({ apiKey: "test-key" }),
      );
    });
  });
});
