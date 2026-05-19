import { describe, expect, it } from "vitest";
import {
  validateListEntryMutationResponse,
  validateListEntryQueryResponse,
  validateRecordDataResponse,
  validateRecordQueryResponse,
} from "../../src/attio/response-validators";

const WORKSPACE_ID = "550e8400-e29b-41d4-a716-446655440000";
const OBJECT_ID = "550e8400-e29b-41d4-a716-446655440001";
const RECORD_ID = "550e8400-e29b-41d4-a716-446655440002";
const LIST_ID = "550e8400-e29b-41d4-a716-446655440003";
const ENTRY_ID = "550e8400-e29b-41d4-a716-446655440004";

const makeUnknownValues = () => ({
  future_custom_attribute: [
    {
      active_from: "2024-01-01T00:00:00.000Z",
      active_until: null,
      attribute_type: "future-value",
      payload: { nested: true },
    },
  ],
});

const makeRecord = (overrides: Record<string, unknown> = {}) => ({
  id: {
    workspace_id: WORKSPACE_ID,
    object_id: OBJECT_ID,
    record_id: RECORD_ID,
  },
  created_at: "2024-01-01T00:00:00.000Z",
  web_url: "https://app.attio.com/companies/record/rec-123",
  values: {},
  ...overrides,
});

const makeEntry = (overrides: Record<string, unknown> = {}) => ({
  id: {
    workspace_id: WORKSPACE_ID,
    list_id: LIST_ID,
    entry_id: ENTRY_ID,
  },
  parent_record_id: RECORD_ID,
  parent_object: "companies",
  created_at: "2024-01-01T00:00:00.000Z",
  entry_values: {},
  ...overrides,
});

const withoutField = (
  value: Record<string, unknown>,
  field: string,
): Record<string, unknown> => {
  const copy = { ...value };
  delete copy[field];
  return copy;
};

describe("response validators", () => {
  it("validates record metadata while accepting unknown value shapes", async () => {
    const record = makeRecord({ values: makeUnknownValues() });

    await expect(validateRecordDataResponse({ data: record })).resolves.toEqual(
      {
        data: record,
      },
    );
  });

  it("accepts omitted and nullish record value maps", async () => {
    const recordWithoutValues = withoutField(makeRecord(), "values");
    const recordWithNullValues = makeRecord({ values: null });

    await expect(
      validateRecordQueryResponse({
        data: [recordWithoutValues, recordWithNullValues],
      }),
    ).resolves.toEqual({
      data: [recordWithoutValues, recordWithNullValues],
    });
  });

  it.each([
    "id",
    "created_at",
    "web_url",
  ] as const)("rejects record responses missing %s", async (field) => {
    await expect(
      validateRecordDataResponse({ data: withoutField(makeRecord(), field) }),
    ).rejects.toThrow();
  });

  it("validates list entry metadata while accepting unknown value shapes", async () => {
    const entry = makeEntry({ entry_values: makeUnknownValues() });

    await expect(
      validateListEntryQueryResponse({ data: [entry] }),
    ).resolves.toEqual({
      data: [entry],
    });
  });

  it("accepts omitted and nullish list entry value maps", async () => {
    const entryWithoutValues = withoutField(makeEntry(), "entry_values");
    const entryWithNullValues = makeEntry({ entry_values: null });

    await expect(
      validateListEntryMutationResponse({ data: entryWithoutValues }),
    ).resolves.toEqual({
      data: entryWithoutValues,
    });
    await expect(
      validateListEntryQueryResponse({ data: [entryWithNullValues] }),
    ).resolves.toEqual({
      data: [entryWithNullValues],
    });
  });

  it.each([
    "id",
    "parent_record_id",
    "parent_object",
    "created_at",
  ] as const)("rejects list entry responses missing %s", async (field) => {
    await expect(
      validateListEntryMutationResponse({
        data: withoutField(makeEntry(), field),
      }),
    ).rejects.toThrow();
  });
});
