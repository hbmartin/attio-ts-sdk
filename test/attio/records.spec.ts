import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const deleteRecordRequest = vi.fn();
const resolveAttioClient = vi.fn();

vi.mock("../../src/generated", async () => {
  const actual = await vi.importActual<typeof import("../../src/generated")>(
    "../../src/generated",
  );
  return {
    ...actual,
    deleteV2ObjectsByObjectRecordsByRecordId: deleteRecordRequest,
  };
});

vi.mock("../../src/attio/client", () => ({
  resolveAttioClient,
}));

describe("deleteRecord", () => {
  let deleteRecord: typeof import("../../src/attio/records").deleteRecord;

  beforeAll(async () => {
    ({ deleteRecord } = await import("../../src/attio/records"));
  });

  beforeEach(() => {
    deleteRecordRequest.mockReset();
    resolveAttioClient.mockReset();
    resolveAttioClient.mockReturnValue({});
  });

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
