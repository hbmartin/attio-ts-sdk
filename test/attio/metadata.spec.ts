import { beforeEach, describe, expect, it, vi } from "vitest";
import { updateKnownFieldValues } from "../../src/attio/error-enhancer";
import {
  getAttribute,
  getAttributeOptions,
  getAttributeStatuses,
  listAttributes,
} from "../../src/attio/metadata";
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
});
