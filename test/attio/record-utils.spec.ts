import { describe, expect, it } from "vitest";

import { extractRecordId, normalizeRecord } from "../../src/attio/record-utils";

describe("record-utils", () => {
  it("returns undefined for invalid extractRecordId inputs", () => {
    expect(extractRecordId(null)).toBeUndefined();
    expect(extractRecordId("nope")).toBeUndefined();
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
    const invalidInputs = [null, "nope"];

    for (const input of invalidInputs) {
      expect(() => {
        // @ts-expect-error intentional invalid input for runtime validation
        normalizeRecord(input);
      }).toThrow("Invalid API response: no data found");
    }
  });

  it("throws on empty object without allowEmpty", () => {
    expect(() => normalizeRecord({})).toThrow(
      "Invalid API response: empty data object",
    );
  });

  it("returns empty values when allowEmpty is true", () => {
    const normalized = normalizeRecord({}, { allowEmpty: true });
    expect(normalized.values).toEqual({});
  });
});
