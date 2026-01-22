import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  getV2ByTargetByIdentifierAttributesByAttributeOptions,
  getV2ByTargetByIdentifierAttributesByAttributeStatuses,
} from "../../src/generated";
import { updateKnownFieldValues } from "../../src/attio/error-enhancer";
import {
  getAttributeOptions,
  getAttributeStatuses,
} from "../../src/attio/metadata";

vi.mock("../../src/generated", () => ({
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

describe("metadata title extraction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

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
});
