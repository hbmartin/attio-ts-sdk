import { describe, expect, it } from "vitest";
import { AttioResponseError } from "../../src/attio/errors";
import {
  extractRecordId,
  normalizeRecord,
  normalizeRecords,
} from "../../src/attio/record-utils";

describe("record-utils", () => {
  const captureError = (action: () => void): unknown => {
    try {
      action();
    } catch (error) {
      return error;
    }
    throw new Error("Expected action to throw.");
  };

  it("returns undefined for invalid extractRecordId inputs", () => {
    expect(extractRecordId(null)).toBeUndefined();
    expect(extractRecordId("nope")).toBeUndefined();
  });

  it("ignores non-string id values", () => {
    const invalidId = { id: { record_id: 123 } };
    const invalidRootId = { record_id: 456 };
    expect(extractRecordId(invalidId)).toBeUndefined();
    expect(extractRecordId(invalidRootId)).toBeUndefined();
  });

  it("extracts record id from alternative id keys", () => {
    const cases = [
      {
        label: "company_id",
        input: { id: { company_id: "comp-1" } },
        expected: "comp-1",
      },
      {
        label: "person_id",
        input: { id: { person_id: "pers-1" } },
        expected: "pers-1",
      },
      {
        label: "list_id",
        input: { id: { list_id: "list-1" } },
        expected: "list-1",
      },
      {
        label: "task_id",
        input: { id: { task_id: "task-1" } },
        expected: "task-1",
      },
      {
        label: "record_id",
        input: { record_id: "rec-root" },
        expected: "rec-root",
      },
    ];

    for (const testCase of cases) {
      expect(extractRecordId(testCase.input)).toBe(testCase.expected);
    }
  });

  it("extracts record id from data.items[0]", () => {
    const record = {
      data: {
        items: [
          {
            id: { record_id: "rec-items" },
          },
        ],
      },
    };

    expect(extractRecordId(record)).toBe("rec-items");
  });

  it("extracts record id from nested data shapes", () => {
    const record = {
      data: {
        record: {
          id: {
            record_id: "rec-123",
          },
        },
      },
    };

    expect(extractRecordId(record)).toBe("rec-123");
  });

  it("normalizes record values from nested data shapes", () => {
    interface NormalizeValuesCase {
      label: string;
      input: Record<string, unknown>;
      expectedId: string;
      expectedKey: string;
    }

    const cases: NormalizeValuesCase[] = [
      {
        label: "data.values",
        input: {
          data: {
            id: { record_id: "rec-456" },
            values: { name: [{ value: "Acme" }] },
          },
        },
        expectedId: "rec-456",
        expectedKey: "name",
      },
      {
        label: "data.data.values",
        input: {
          data: {
            data: {
              id: { record_id: "rec-457" },
              values: { title: [{ value: "Beta" }] },
            },
          },
        },
        expectedId: "rec-457",
        expectedKey: "title",
      },
      {
        label: "data.record.values",
        input: {
          data: {
            record: {
              id: { record_id: "rec-458" },
              values: { status: [{ value: "Open" }] },
            },
          },
        },
        expectedId: "rec-458",
        expectedKey: "status",
      },
      {
        label: "data.items[0].values",
        input: {
          data: {
            items: [
              {
                id: { record_id: "rec-459" },
                values: { owner: [{ value: "Zed" }] },
              },
            ],
          },
        },
        expectedId: "rec-459",
        expectedKey: "owner",
      },
    ];

    for (const testCase of cases) {
      const normalized = normalizeRecord(testCase.input);
      expect(normalized.id?.record_id).toBe(testCase.expectedId);
      expect(normalized.values?.[testCase.expectedKey]).toBeTruthy();
    }
  });

  it("throws on invalid normalizeRecord inputs", () => {
    const invalidInputs = [null, "nope", []];

    for (const input of invalidInputs) {
      const error = captureError(() => {
        // @ts-expect-error intentional invalid input for runtime validation
        normalizeRecord(input);
      });
      expect(error).toBeInstanceOf(AttioResponseError);
      if (!(error instanceof AttioResponseError)) {
        throw error;
      }
      expect(error.message).toBe("Invalid API response: no data found");
      expect(error.code).toBe("INVALID_RESPONSE");
    }
  });

  it("throws on empty object when emptyBehavior is reject", () => {
    const error = captureError(() => normalizeRecord({}));
    expect(error).toBeInstanceOf(AttioResponseError);
    if (!(error instanceof AttioResponseError)) {
      throw error;
    }
    expect(error.message).toBe("Invalid API response: empty data object");
    expect(error.code).toBe("EMPTY_RESPONSE");
  });

  it("returns empty values when emptyBehavior is allow", () => {
    const normalized = normalizeRecord({}, { emptyBehavior: "allow" });
    expect(normalized.values).toEqual({});
  });

  it("returns record unchanged when it already has valid id and values", () => {
    const validRecord = {
      id: { record_id: "rec-already-valid" },
      values: { name: [{ value: "Test" }] },
    };
    const normalized = normalizeRecord(validRecord);
    expect(normalized).toStrictEqual(validRecord);
  });

  it("rebuilds values when existing values are invalid", () => {
    const record: Record<string, unknown> = {
      id: { record_id: "rec-invalid-values" },
      values: "nope",
    };

    const normalized = normalizeRecord(record);
    expect(normalized.values).toEqual({});
  });

  it("extracts record_id from root level when id is a string", () => {
    const record = { id: "rec-string-id" };
    expect(extractRecordId(record)).toBe("rec-string-id");
  });

  it("extracts id keys from root level without nesting", () => {
    expect(extractRecordId({ company_id: "comp-root" })).toBe("comp-root");
    expect(extractRecordId({ person_id: "pers-root" })).toBe("pers-root");
    expect(extractRecordId({ list_id: "list-root" })).toBe("list-root");
    expect(extractRecordId({ task_id: "task-root" })).toBe("task-root");
  });

  describe("normalizeRecords", () => {
    it("normalizes an array of records", () => {
      const items = [
        {
          data: {
            id: { record_id: "rec-1" },
            values: { name: [{ value: "A" }] },
          },
        },
        {
          data: {
            id: { record_id: "rec-2" },
            values: { name: [{ value: "B" }] },
          },
        },
      ];
      const normalized = normalizeRecords(items);
      expect(normalized).toHaveLength(2);
      expect(normalized[0].id?.record_id).toBe("rec-1");
      expect(normalized[1].id?.record_id).toBe("rec-2");
    });

    it("filters out non-object items", () => {
      const items = [
        { data: { id: { record_id: "rec-1" }, values: {} } },
        null,
        "string",
        undefined,
        { data: { id: { record_id: "rec-2" }, values: {} } },
      ];
      // @ts-expect-error intentional mixed types for testing
      const normalized = normalizeRecords(items);
      expect(normalized).toHaveLength(2);
    });

    it("passes options to normalizeRecord", () => {
      const items = [{}];
      const normalized = normalizeRecords(items, { emptyBehavior: "allow" });
      expect(normalized).toHaveLength(1);
      expect(normalized[0].values).toEqual({});
    });
  });
});
