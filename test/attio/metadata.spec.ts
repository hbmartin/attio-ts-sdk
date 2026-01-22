import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TtlCache } from "../../src/attio/cache";
import { resolveAttioClient } from "../../src/attio/client";
import { updateKnownFieldValues } from "../../src/attio/error-enhancer";
import {
  buildAttributeMetadataPath,
  buildKey,
  extractTitles,
  getAttribute,
  getAttributeOptions,
  getAttributeStatuses,
  listAttributeMetadata,
  listAttributes,
} from "../../src/attio/metadata";
import { unwrapItems } from "../../src/attio/response";
import {
  getV2ByTargetByIdentifierAttributes,
  getV2ByTargetByIdentifierAttributesByAttribute,
  getV2ByTargetByIdentifierAttributesByAttributeOptions,
  getV2ByTargetByIdentifierAttributesByAttributeStatuses,
} from "../../src/generated";

vi.mock("../../src/generated", () => ({
  getV2ByTargetByIdentifierAttributes: vi.fn(),
  getV2ByTargetByIdentifierAttributesByAttribute: vi.fn(),
  getV2ByTargetByIdentifierAttributesByAttributeOptions: vi.fn(),
  getV2ByTargetByIdentifierAttributesByAttributeStatuses: vi.fn(),
}));

vi.mock("../../src/attio/error-enhancer", () => ({
  updateKnownFieldValues: vi.fn(),
}));

vi.mock("../../src/attio/client", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../../src/attio/client")>();
  return {
    ...actual,
    resolveAttioClient: vi.fn(actual.resolveAttioClient),
  };
});

vi.mock("../../src/attio/response", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../../src/attio/response")>();
  return {
    ...actual,
    unwrapItems: vi.fn(actual.unwrapItems),
  };
});

const apiKey = "test-token-1234567890";

const buildInput = (attribute: string) => ({
  target: "companies",
  identifier: "comp-123",
  attribute,
  config: { apiKey },
});

const sampleItems = [
  { title: "Active" },
  { title: 123 },
  { name: "Ignored" },
  null,
  "string",
  { title: "Inactive", extra: true },
  { title: "Pending" },
];

describe("metadata", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("listAttributes", () => {
    it("fetches and caches attributes", async () => {
      const listMock = vi.mocked(getV2ByTargetByIdentifierAttributes);
      const attributes = [{ api_slug: "name" }, { api_slug: "email" }];
      listMock.mockResolvedValue({ data: { data: attributes } });

      const input = {
        target: "people",
        identifier: "ppl-123",
        config: { apiKey },
      };
      const first = await listAttributes(input);
      const second = await listAttributes(input);

      expect(first).toEqual(attributes);
      expect(second).toEqual(attributes);
      expect(listMock).toHaveBeenCalledTimes(1);
    });

    it("passes options to API call", async () => {
      const listMock = vi.mocked(getV2ByTargetByIdentifierAttributes);
      listMock.mockResolvedValue({ data: { data: [] } });

      await listAttributes({
        target: "deals",
        identifier: "deal-123",
        config: { apiKey },
        options: { headers: { "X-Custom": "value" } },
      });

      expect(listMock).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: { "X-Custom": "value" },
        }),
      );
    });
  });

  describe("getAttribute", () => {
    it("fetches single attribute", async () => {
      const getMock = vi.mocked(getV2ByTargetByIdentifierAttributesByAttribute);
      const attribute = { api_slug: "stage", type: "select" };
      getMock.mockResolvedValue({ data: attribute });

      const result = await getAttribute({
        target: "companies",
        identifier: "comp-123",
        attribute: "stage",
        config: { apiKey },
      });

      expect(result).toEqual(attribute);
      expect(getMock).toHaveBeenCalledWith(
        expect.objectContaining({
          path: {
            target: "companies",
            identifier: "comp-123",
            attribute: "stage",
          },
        }),
      );
    });

    it("passes options to API call", async () => {
      const getMock = vi.mocked(getV2ByTargetByIdentifierAttributesByAttribute);
      getMock.mockResolvedValue({ data: {} });

      await getAttribute({
        target: "companies",
        identifier: "comp-123",
        attribute: "stage",
        config: { apiKey },
        options: { headers: { "X-Custom": "value" } },
      });

      expect(getMock).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: { "X-Custom": "value" },
        }),
      );
    });
  });

  describe("getAttributeOptions", () => {
    it("extracts string titles for attribute options", async () => {
      const optionsMock = vi.mocked(
        getV2ByTargetByIdentifierAttributesByAttributeOptions,
      );
      const updateMock = vi.mocked(updateKnownFieldValues);

      optionsMock.mockResolvedValue({ data: sampleItems });

      const input = buildInput("stage");
      const result = await getAttributeOptions(input);

      expect(result).toEqual(sampleItems);
      expect(updateMock).toHaveBeenCalledWith("stage", [
        "Active",
        "Inactive",
        "Pending",
      ]);
    });

    it("caches attribute options responses", async () => {
      const optionsMock = vi.mocked(
        getV2ByTargetByIdentifierAttributesByAttributeOptions,
      );
      const updateMock = vi.mocked(updateKnownFieldValues);

      optionsMock.mockResolvedValue({ data: sampleItems });

      const input = buildInput("priority");
      const first = await getAttributeOptions(input);
      const second = await getAttributeOptions(input);

      expect(first).toEqual(sampleItems);
      expect(second).toEqual(sampleItems);
      expect(optionsMock).toHaveBeenCalledTimes(1);
      expect(updateMock).toHaveBeenCalledTimes(1);
    });
  });

  describe("getAttributeStatuses", () => {
    it("extracts string titles for attribute statuses", async () => {
      const statusesMock = vi.mocked(
        getV2ByTargetByIdentifierAttributesByAttributeStatuses,
      );
      const updateMock = vi.mocked(updateKnownFieldValues);

      statusesMock.mockResolvedValue({ data: sampleItems });

      const input = buildInput("status");
      const result = await getAttributeStatuses(input);

      expect(result).toEqual(sampleItems);
      expect(updateMock).toHaveBeenCalledWith("status", [
        "Active",
        "Inactive",
        "Pending",
      ]);
    });

    it("caches attribute statuses responses", async () => {
      const statusesMock = vi.mocked(
        getV2ByTargetByIdentifierAttributesByAttributeStatuses,
      );

      statusesMock.mockResolvedValue({ data: [{ title: "Done" }] });

      const input = buildInput("workflow_status");
      const first = await getAttributeStatuses(input);
      const second = await getAttributeStatuses(input);

      expect(first).toEqual([{ title: "Done" }]);
      expect(second).toEqual([{ title: "Done" }]);
      expect(statusesMock).toHaveBeenCalledTimes(1);
    });
  });

  describe("listAttributeMetadata", () => {
    const createMockCache = () => ({
      get: vi.fn(),
      set: vi.fn(),
      delete: vi.fn(),
      clear: vi.fn(),
    });

    describe("cache hit behavior", () => {
      it("returns cached value when cache.get returns a value", async () => {
        const cachedItems = [{ title: "Cached Option" }, { title: "Another" }];
        const mockCache = createMockCache();
        mockCache.get.mockReturnValue(cachedItems);

        const fetcher = vi.fn();
        const input = buildInput("cached_attr");

        const result = await listAttributeMetadata({
          input,
          cache: mockCache as unknown as TtlCache<string, unknown[]>,
          fetcher,
        });

        expect(result).toEqual(cachedItems);
        expect(mockCache.get).toHaveBeenCalledWith(
          "companies:comp-123:cached_attr",
        );
        expect(fetcher).not.toHaveBeenCalled();
      });

      it("does not call resolveAttioClient on cache hit", async () => {
        const mockCache = createMockCache();
        mockCache.get.mockReturnValue([{ title: "Cached" }]);
        const resolveClientMock = vi.mocked(resolveAttioClient);

        await listAttributeMetadata({
          input: buildInput("cached_field"),
          cache: mockCache as unknown as TtlCache<string, unknown[]>,
          fetcher: vi.fn(),
        });

        expect(resolveClientMock).not.toHaveBeenCalled();
      });

      it("does not call updateKnownFieldValues on cache hit", async () => {
        const mockCache = createMockCache();
        mockCache.get.mockReturnValue([{ title: "Cached" }]);
        const updateMock = vi.mocked(updateKnownFieldValues);

        await listAttributeMetadata({
          input: buildInput("cached_field"),
          cache: mockCache as unknown as TtlCache<string, unknown[]>,
          fetcher: vi.fn(),
        });

        expect(updateMock).not.toHaveBeenCalled();
      });

      it("does not call unwrapItems on cache hit", async () => {
        const mockCache = createMockCache();
        mockCache.get.mockReturnValue([{ title: "Cached" }]);
        const unwrapMock = vi.mocked(unwrapItems);

        await listAttributeMetadata({
          input: buildInput("cached_field"),
          cache: mockCache as unknown as TtlCache<string, unknown[]>,
          fetcher: vi.fn(),
        });

        expect(unwrapMock).not.toHaveBeenCalled();
      });
    });

    describe("cache miss behavior", () => {
      it("calls fetcher with path from buildAttributeMetadataPath and options", async () => {
        const mockCache = createMockCache();
        mockCache.get.mockReturnValue(undefined);

        const mockClient = { baseUrl: "https://api.attio.com" };
        vi.mocked(resolveAttioClient).mockReturnValue(
          mockClient as ReturnType<typeof resolveAttioClient>,
        );

        const fetchedData = { data: [{ title: "Fetched" }] };
        const fetcher = vi.fn().mockResolvedValue(fetchedData);
        vi.mocked(unwrapItems).mockReturnValue([{ title: "Fetched" }]);

        const input = {
          ...buildInput("new_attr"),
          options: { headers: { "X-Custom": "header-value" } },
        };

        await listAttributeMetadata({
          input,
          cache: mockCache as unknown as TtlCache<string, unknown[]>,
          fetcher,
        });

        expect(fetcher).toHaveBeenCalledWith({
          client: mockClient,
          path: {
            target: "companies",
            identifier: "comp-123",
            attribute: "new_attr",
          },
          headers: { "X-Custom": "header-value" },
        });
      });

      it("calls cache.set with buildKey result and unwrapped items", async () => {
        const mockCache = createMockCache();
        mockCache.get.mockReturnValue(undefined);

        const mockClient = { baseUrl: "https://api.attio.com" };
        vi.mocked(resolveAttioClient).mockReturnValue(
          mockClient as ReturnType<typeof resolveAttioClient>,
        );

        const unwrappedItems = [{ title: "Item1" }, { title: "Item2" }];
        vi.mocked(unwrapItems).mockReturnValue(unwrappedItems);

        const fetcher = vi.fn().mockResolvedValue({ data: unwrappedItems });

        const input = buildInput("test_attr");

        await listAttributeMetadata({
          input,
          cache: mockCache as unknown as TtlCache<string, unknown[]>,
          fetcher,
        });

        const expectedKey = buildKey(
          input.target,
          input.identifier,
          input.attribute,
        );
        expect(mockCache.set).toHaveBeenCalledWith(expectedKey, unwrappedItems);
        expect(expectedKey).toBe("companies:comp-123:test_attr");
      });

      it("calls updateKnownFieldValues with attribute and extracted titles", async () => {
        const mockCache = createMockCache();
        mockCache.get.mockReturnValue(undefined);

        const mockClient = { baseUrl: "https://api.attio.com" };
        vi.mocked(resolveAttioClient).mockReturnValue(
          mockClient as ReturnType<typeof resolveAttioClient>,
        );

        const unwrappedItems = [
          { title: "Active" },
          { title: "Inactive" },
          { name: "NoTitle" },
        ];
        vi.mocked(unwrapItems).mockReturnValue(unwrappedItems);
        const updateMock = vi.mocked(updateKnownFieldValues);

        const fetcher = vi.fn().mockResolvedValue({ data: unwrappedItems });

        const input = buildInput("status_field");

        await listAttributeMetadata({
          input,
          cache: mockCache as unknown as TtlCache<string, unknown[]>,
          fetcher,
        });

        expect(updateMock).toHaveBeenCalledWith("status_field", [
          "Active",
          "Inactive",
        ]);
      });

      it("calls resolveAttioClient with input on cache miss", async () => {
        const mockCache = createMockCache();
        mockCache.get.mockReturnValue(undefined);

        const mockClient = { baseUrl: "https://api.attio.com" };
        const resolveClientMock = vi.mocked(resolveAttioClient);
        resolveClientMock.mockReturnValue(
          mockClient as ReturnType<typeof resolveAttioClient>,
        );

        vi.mocked(unwrapItems).mockReturnValue([]);

        const fetcher = vi.fn().mockResolvedValue({ data: [] });

        const input = buildInput("some_attr");

        await listAttributeMetadata({
          input,
          cache: mockCache as unknown as TtlCache<string, unknown[]>,
          fetcher,
        });

        expect(resolveClientMock).toHaveBeenCalledWith(input);
      });

      it("returns unwrapped items on cache miss", async () => {
        const mockCache = createMockCache();
        mockCache.get.mockReturnValue(undefined);

        const mockClient = { baseUrl: "https://api.attio.com" };
        vi.mocked(resolveAttioClient).mockReturnValue(
          mockClient as ReturnType<typeof resolveAttioClient>,
        );

        const unwrappedItems = [{ title: "Result1" }, { title: "Result2" }];
        vi.mocked(unwrapItems).mockReturnValue(unwrappedItems);

        const fetcher = vi.fn().mockResolvedValue({ data: unwrappedItems });

        const result = await listAttributeMetadata({
          input: buildInput("result_attr"),
          cache: mockCache as unknown as TtlCache<string, unknown[]>,
          fetcher,
        });

        expect(result).toEqual(unwrappedItems);
      });

      it("passes fetcher result to unwrapItems", async () => {
        const mockCache = createMockCache();
        mockCache.get.mockReturnValue(undefined);

        const mockClient = { baseUrl: "https://api.attio.com" };
        vi.mocked(resolveAttioClient).mockReturnValue(
          mockClient as ReturnType<typeof resolveAttioClient>,
        );

        const fetcherResult = { data: { items: [{ title: "Wrapped" }] } };
        const fetcher = vi.fn().mockResolvedValue(fetcherResult);
        const unwrapMock = vi.mocked(unwrapItems);
        unwrapMock.mockReturnValue([{ title: "Wrapped" }]);

        await listAttributeMetadata({
          input: buildInput("unwrap_attr"),
          cache: mockCache as unknown as TtlCache<string, unknown[]>,
          fetcher,
        });

        expect(unwrapMock).toHaveBeenCalledWith(fetcherResult);
      });
    });

    describe("buildKey verification", () => {
      it("uses correct cache key format for attribute metadata", () => {
        const key = buildKey("objects", "my-object", "my-attribute");
        expect(key).toBe("objects:my-object:my-attribute");
      });

      it("uses correct cache key format without attribute", () => {
        const key = buildKey("objects", "my-object");
        expect(key).toBe("objects:my-object");
      });
    });

    describe("extractTitles verification", () => {
      it("extracts titles from items with valid title strings", () => {
        const items = [
          { title: "First" },
          { title: "Second" },
          { title: "Third" },
        ];
        const titles = extractTitles(items);
        expect(titles).toEqual(["First", "Second", "Third"]);
      });

      it("ignores items without title property", () => {
        const items = [
          { title: "Valid" },
          { name: "NoTitle" },
          { title: "AlsoValid" },
        ];
        const titles = extractTitles(items);
        expect(titles).toEqual(["Valid", "AlsoValid"]);
      });

      it("ignores items with non-string title values", () => {
        const items = [
          { title: "String" },
          { title: 123 },
          { title: null },
          { title: undefined },
          { title: "AnotherString" },
        ];
        const titles = extractTitles(items);
        expect(titles).toEqual(["String", "AnotherString"]);
      });

      it("handles empty array", () => {
        const titles = extractTitles([]);
        expect(titles).toEqual([]);
      });

      it("handles null and primitive items", () => {
        const items = [null, "string", 123, { title: "Valid" }];
        const titles = extractTitles(items);
        expect(titles).toEqual(["Valid"]);
      });
    });

    describe("buildAttributeMetadataPath verification", () => {
      it("constructs path object from input", () => {
        const input = buildInput("my_attribute");
        const path = buildAttributeMetadataPath(input);

        expect(path).toEqual({
          target: "companies",
          identifier: "comp-123",
          attribute: "my_attribute",
        });
      });
    });
  });
});
