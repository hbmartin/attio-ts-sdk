import { describe, expect, it } from "vitest";
import { z } from "zod";
import { AttioResponseError } from "../../src/attio/errors";
import {
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
