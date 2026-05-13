import { describe, expect, it } from "vitest";
import { z } from "zod";
import { AttioResponseError } from "../../src/attio/errors";
import {
  getEmails,
  getFirstCheckbox,
  getFirstCurrencyValue,
  getFirstDate,
  getFirstDomain,
  getFirstEmail,
  getFirstFullName,
  getFirstLocation,
  getFirstNumber,
  getFirstPhone,
  getFirstRating,
  getFirstRecordReferenceId,
  getFirstSelectTitle,
  getFirstStatusTitle,
  getFirstText,
  getFirstTimestamp,
  getFirstValue,
  getFirstValueSafe,
  getPhones,
  getRecordReferenceIds,
  getSelectTitles,
  getStatusTitles,
  getValue,
  getValueSafe,
  value,
} from "../../src/attio/values";

describe("value helpers", () => {
  it("builds string values", () => {
    expect(value.string("Acme")).toEqual([{ value: "Acme" }]);
  });

  it("builds domain values", () => {
    expect(value.domain("acme.com")).toEqual([{ domain: "acme.com" }]);
  });

  it("builds currency values with code", () => {
    expect(value.currency(50_000, "USD")).toEqual([
      { currency_value: 50_000, currency_code: "USD" },
    ]);
  });

  it("builds number, boolean, email, and currency values", () => {
    expect(value.number(42)).toEqual([{ value: 42 }]);
    expect(value.boolean(true)).toEqual([{ value: true }]);
    expect(value.email("hello@example.com")).toEqual([
      { email_address: "hello@example.com" },
    ]);
    expect(value.currency(123)).toEqual([{ currency_value: 123 }]);
  });

  it("builds richer typed values", () => {
    expect(value.text("hello")).toEqual([{ value: "hello" }]);
    expect(value.phone("+15551234567")).toEqual([
      { original_phone_number: "+15551234567" },
    ]);
    expect(value.phone("5551234567", "US")).toEqual([
      { original_phone_number: "5551234567", country_code: "US" },
    ]);
    expect(value.personalName({ full_name: "Jane Doe" })).toEqual([
      { full_name: "Jane Doe" },
    ]);
    expect(value.status("Active")).toEqual([{ status: "Active" }]);
    expect(value.select("Enterprise")).toEqual([{ option: "Enterprise" }]);
    expect(
      value.recordReference({
        targetObject: "companies",
        targetRecordId: "rec-123",
      }),
    ).toEqual([{ target_object: "companies", target_record_id: "rec-123" }]);
    expect(value.location({ locality: "Oakland", countryCode: "US" })).toEqual([
      {
        line_1: null,
        line_2: null,
        line_3: null,
        line_4: null,
        locality: "Oakland",
        region: null,
        postcode: null,
        country_code: "US",
        latitude: null,
        longitude: null,
      },
    ]);
  });

  it("validates richer typed values", () => {
    expect(() => value.phone("5551234567", "USA")).toThrow();
    expect(() => value.personalName({})).toThrow();
    expect(() =>
      value.recordReference({ targetObject: "", targetRecordId: "rec-123" }),
    ).toThrow();
  });
});

describe("getValue helpers", () => {
  const record = {
    values: {
      name: [{ value: "Acme" }],
      revenue: [{ currency_value: 50_000, currency_code: "USD" }],
    },
  };

  it("reads values by attribute slug", () => {
    expect(getValue(record, "name")).toEqual([{ value: "Acme" }]);
  });

  it("reads first value by attribute slug", () => {
    expect(getFirstValue(record, "revenue")).toEqual({
      currency_value: 50_000,
      currency_code: "USD",
    });
  });

  it("validates values with schema", () => {
    const schema = z.object({ value: z.string() });
    expect(getValue(record, "name", { schema })).toEqual([{ value: "Acme" }]);
  });

  it("throws when schema validation fails", () => {
    const schema = z.object({ value: z.string() });
    expect(() => getValue(record, "revenue", { schema })).toThrow(
      AttioResponseError,
    );
  });

  it("returns undefined when attribute is missing", () => {
    expect(getValue(record, "missing")).toBeUndefined();
    expect(getFirstValue(record, "missing")).toBeUndefined();
  });
});

describe("getValueSafe", () => {
  const textSchema = z.object({ value: z.string() });
  const record = {
    values: {
      name: [{ value: "Acme" }, { value: "Corp" }],
      revenue: [{ currency_value: 50_000, currency_code: "USD" }],
    },
  };

  it("returns ok with parsed values on success", () => {
    const result = getValueSafe(record, "name", textSchema);
    expect(result).toEqual({
      ok: true,
      value: [{ value: "Acme" }, { value: "Corp" }],
    });
  });

  it("returns ok with undefined when attribute is missing", () => {
    const result = getValueSafe(record, "missing", textSchema);
    expect(result).toEqual({ ok: true, value: undefined });
  });

  it("returns error when schema does not match", () => {
    const result = getValueSafe(record, "revenue", textSchema);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("INVALID_VALUE");
      expect(result.message).toContain("revenue");
    }
  });
});

describe("getFirstValueSafe", () => {
  const textSchema = z.object({ value: z.string() });
  const record = {
    values: {
      name: [{ value: "Acme" }],
      revenue: [{ currency_value: 50_000 }],
    },
  };

  it("returns ok with the first parsed value", () => {
    const result = getFirstValueSafe(record, "name", textSchema);
    expect(result).toEqual({ ok: true, value: { value: "Acme" } });
  });

  it("returns ok with undefined when attribute is missing", () => {
    const result = getFirstValueSafe(record, "missing", textSchema);
    expect(result).toEqual({ ok: true, value: undefined });
  });

  it("returns error when schema does not match", () => {
    const result = getFirstValueSafe(record, "revenue", textSchema);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("INVALID_VALUE");
      expect(result.message).toContain("revenue");
    }
  });
});

describe("typed primitive getters", () => {
  const record = {
    values: {
      name: [{ value: "Acme" }],
      revenue: [{ value: 50_000 }],
      founded: [{ value: "2024-01-15" }],
      updated_at: [{ value: "2024-01-15T10:30:00Z" }],
      is_active: [{ value: true }],
      rating: [{ value: 4 }],
      arr: [{ currency_value: 100_000, currency_code: "USD" }],
      stage: [{ option: { title: "Series A" } }],
      stage_id: [{ option: "opt_abc123" }],
      status: [{ status: { title: "Active" } }],
      status_id: [{ status: "sta_abc123" }],
      contact_name: [
        { first_name: "John", last_name: "Doe", full_name: "John Doe" },
      ],
      email: [
        {
          original_email_address: "john@example.com",
          email_address: "john@example.com",
        },
      ],
      website: [{ domain: "example.com" }],
      phone: [
        { original_phone_number: "+15551234567", phone_number: "+15551234567" },
      ],
      emails: [
        {
          original_email_address: "a@example.com",
          email_address: "a@example.com",
        },
        {
          original_email_address: "b@example.com",
          email_address: "b@example.com",
        },
      ],
      phones: [
        { original_phone_number: "+15550000001", phone_number: "+15550000001" },
        { original_phone_number: "+15550000002", phone_number: "+15550000002" },
      ],
      stages: [{ option: { title: "Seed" } }, { option: "opt_2" }],
      statuses: [{ status: { title: "Open" } }, { status: "sta_2" }],
      company: [
        { target_object: "companies", target_record_id: "company-1" },
        { target_object: "companies", target_record_id: "company-2" },
      ],
      office: [
        {
          line_1: "1 Market St",
          line_2: null,
          line_3: null,
          line_4: null,
          locality: "San Francisco",
          region: "CA",
          postcode: "94105",
          country_code: "US",
          latitude: null,
          longitude: null,
        },
      ],
    },
  };

  it("getFirstText extracts string value", () => {
    expect(getFirstText(record, "name")).toBe("Acme");
  });

  it("getFirstNumber extracts number value", () => {
    expect(getFirstNumber(record, "revenue")).toBe(50_000);
  });

  it("getFirstDate extracts date string", () => {
    expect(getFirstDate(record, "founded")).toBe("2024-01-15");
  });

  it("getFirstTimestamp extracts timestamp string", () => {
    expect(getFirstTimestamp(record, "updated_at")).toBe(
      "2024-01-15T10:30:00Z",
    );
  });

  it("getFirstCheckbox extracts boolean value", () => {
    expect(getFirstCheckbox(record, "is_active")).toBe(true);
  });

  it("getFirstRating extracts rating number", () => {
    expect(getFirstRating(record, "rating")).toBe(4);
  });

  it("getFirstCurrencyValue extracts currency_value", () => {
    expect(getFirstCurrencyValue(record, "arr")).toBe(100_000);
  });

  it("getFirstSelectTitle extracts option title", () => {
    expect(getFirstSelectTitle(record, "stage")).toBe("Series A");
  });

  it("getFirstSelectTitle falls back to raw option string", () => {
    expect(getFirstSelectTitle(record, "stage_id")).toBe("opt_abc123");
  });

  it("getFirstStatusTitle extracts status title", () => {
    expect(getFirstStatusTitle(record, "status")).toBe("Active");
  });

  it("getFirstStatusTitle falls back to raw status string", () => {
    expect(getFirstStatusTitle(record, "status_id")).toBe("sta_abc123");
  });

  it("getFirstFullName extracts full_name", () => {
    expect(getFirstFullName(record, "contact_name")).toBe("John Doe");
  });

  it("getFirstEmail extracts email_address", () => {
    expect(getFirstEmail(record, "email")).toBe("john@example.com");
  });

  it("getFirstDomain extracts domain", () => {
    expect(getFirstDomain(record, "website")).toBe("example.com");
  });

  it("getFirstPhone extracts phone_number", () => {
    expect(getFirstPhone(record, "phone")).toBe("+15551234567");
  });

  it("plural readers extract common scalar values", () => {
    expect(getEmails(record, "emails")).toEqual([
      "a@example.com",
      "b@example.com",
    ]);
    expect(getPhones(record, "phones")).toEqual([
      "+15550000001",
      "+15550000002",
    ]);
    expect(getSelectTitles(record, "stages")).toEqual(["Seed", "opt_2"]);
    expect(getStatusTitles(record, "statuses")).toEqual(["Open", "sta_2"]);
    expect(getRecordReferenceIds(record, "company")).toEqual([
      "company-1",
      "company-2",
    ]);
  });

  it("record-reference and location readers extract first values", () => {
    expect(getFirstRecordReferenceId(record, "company")).toBe("company-1");
    expect(getFirstLocation(record, "office")).toMatchObject({
      locality: "San Francisco",
      country_code: "US",
    });
  });

  it("returns undefined for missing attribute", () => {
    expect(getFirstText(record, "missing")).toBeUndefined();
    expect(getFirstNumber(record, "missing")).toBeUndefined();
    expect(getFirstCheckbox(record, "missing")).toBeUndefined();
  });

  it("returns undefined when value shape does not match", () => {
    expect(getFirstText(record, "revenue")).toBeUndefined();
    expect(getFirstNumber(record, "name")).toBeUndefined();
    expect(getFirstCurrencyValue(record, "name")).toBeUndefined();
  });
});
