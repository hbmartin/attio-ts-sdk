import { describe, expect, it } from "vitest";
import { z } from "zod";
import { AttioResponseError } from "../../src/attio/errors";
import {
  getFirstCheckbox,
  getFirstCurrencyValue,
  getFirstDate,
  getFirstDomain,
  getFirstEmail,
  getFirstFullName,
  getFirstNumber,
  getFirstPhone,
  getFirstRating,
  getFirstSelectTitle,
  getFirstStatusTitle,
  getFirstText,
  getFirstTimestamp,
  getFirstValue,
  getFirstValueSafe,
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
      status: [{ status: { title: "Active" } }],
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

  it("getFirstStatusTitle extracts status title", () => {
    expect(getFirstStatusTitle(record, "status")).toBe("Active");
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
