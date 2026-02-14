import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { AttioResponseError } from "../../src/attio/errors";
import { listAttributes } from "../../src/attio/metadata";
import { createSchema } from "../../src/attio/schema";

vi.mock("../../src/attio/metadata", () => ({
  listAttributes: vi.fn(),
}));

const mockAttribute = (slug: string, type: string) => ({
  id: { workspace_id: "w1", object_id: "o1", attribute_id: `a_${slug}` },
  title: slug,
  description: null,
  api_slug: slug,
  type,
  is_system_attribute: false,
  is_writable: true,
  is_required: false,
  is_unique: false,
  is_multiselect: false,
  is_default_value_enabled: false,
  is_archived: false,
  default_value: null,
  relationship: null,
  created_at: "2024-01-01T00:00:00Z",
  config: {
    currency: { default_currency_code: "USD", display_type: "code" },
    record_reference: { allowed_object_ids: null },
  },
});

describe("createSchema", () => {
  it("builds attribute accessors", async () => {
    const mockList = vi.mocked(listAttributes);
    mockList.mockResolvedValue([
      {
        id: { workspace_id: "w1", object_id: "o1", attribute_id: "a1" },
        title: "Name",
        description: null,
        api_slug: "name",
        type: "text",
        is_system_attribute: false,
        is_writable: true,
        is_required: false,
        is_unique: false,
        is_multiselect: false,
        is_default_value_enabled: false,
        is_archived: false,
        default_value: null,
        relationship: null,
        created_at: "2024-01-01T00:00:00Z",
        config: {
          currency: {
            default_currency_code: "USD",
            display_type: "code",
          },
          record_reference: {
            allowed_object_ids: null,
          },
        },
      },
    ]);

    const schema = await createSchema({
      target: "objects",
      identifier: "companies",
    });

    expect(schema.getAttribute("name")?.api_slug).toBe("name");

    const accessor = schema.getAccessor("name");
    expect(accessor).toBeDefined();
    expect(
      accessor?.getFirstValue({ values: { name: [{ value: "Acme" }] } }),
    ).toEqual({ value: "Acme" });

    const strictAccessor = schema.getAccessorOrThrow("name");
    expect(strictAccessor.attribute.api_slug).toBe("name");
  });

  it("throws when attribute slug is unknown", async () => {
    const mockList = vi.mocked(listAttributes);
    mockList.mockResolvedValue([]);

    const schema = await createSchema({
      target: "objects",
      identifier: "companies",
    });

    expect(() => schema.getAttributeOrThrow("unknown")).toThrow(
      AttioResponseError,
    );
  });

  it("returns undefined for getAccessor with unknown slug", async () => {
    const mockList = vi.mocked(listAttributes);
    mockList.mockResolvedValue([]);

    const schema = await createSchema({
      target: "objects",
      identifier: "companies",
    });

    expect(schema.getAccessor("unknown")).toBeUndefined();
  });

  it("throws when getAccessorOrThrow is called with unknown slug", async () => {
    const mockList = vi.mocked(listAttributes);
    mockList.mockResolvedValue([]);

    const schema = await createSchema({
      target: "objects",
      identifier: "companies",
    });

    expect(() => schema.getAccessorOrThrow("unknown")).toThrow(
      AttioResponseError,
    );
  });

  it("exposes target, identifier, and attributeSlugs", async () => {
    const mockList = vi.mocked(listAttributes);
    mockList.mockResolvedValue([
      {
        id: { workspace_id: "w1", object_id: "o1", attribute_id: "a1" },
        title: "Name",
        description: null,
        api_slug: "name",
        type: "text",
        is_system_attribute: false,
        is_writable: true,
        is_required: false,
        is_unique: false,
        is_multiselect: false,
        is_default_value_enabled: false,
        is_archived: false,
        default_value: null,
        relationship: null,
        created_at: "2024-01-01T00:00:00Z",
        config: {
          currency: { default_currency_code: "USD", display_type: "code" },
          record_reference: { allowed_object_ids: null },
        },
      },
      {
        id: { workspace_id: "w1", object_id: "o1", attribute_id: "a2" },
        title: "Domain",
        description: null,
        api_slug: "domain",
        type: "domain",
        is_system_attribute: false,
        is_writable: true,
        is_required: false,
        is_unique: false,
        is_multiselect: false,
        is_default_value_enabled: false,
        is_archived: false,
        default_value: null,
        relationship: null,
        created_at: "2024-01-01T00:00:00Z",
        config: {
          currency: { default_currency_code: "USD", display_type: "code" },
          record_reference: { allowed_object_ids: null },
        },
      },
    ]);

    const schema = await createSchema({
      target: "objects",
      identifier: "people",
    });

    expect(schema.target).toBe("objects");
    expect(schema.identifier).toBe("people");
    expect(schema.attributeSlugs).toEqual(["name", "domain"]);
    expect(schema.attributes).toHaveLength(2);
  });

  it("accessor getValueAs parses values with a schema", async () => {
    const mockList = vi.mocked(listAttributes);
    mockList.mockResolvedValue([
      {
        id: { workspace_id: "w1", object_id: "o1", attribute_id: "a1" },
        title: "Revenue",
        description: null,
        api_slug: "revenue",
        type: "number",
        is_system_attribute: false,
        is_writable: true,
        is_required: false,
        is_unique: false,
        is_multiselect: false,
        is_default_value_enabled: false,
        is_archived: false,
        default_value: null,
        relationship: null,
        created_at: "2024-01-01T00:00:00Z",
        config: {
          currency: { default_currency_code: "USD", display_type: "code" },
          record_reference: { allowed_object_ids: null },
        },
      },
    ]);

    const schema = await createSchema({
      target: "objects",
      identifier: "companies",
    });

    const valueSchema = z.object({ value: z.number() });
    const accessor = schema.getAccessorOrThrow("revenue");
    const record = { values: { revenue: [{ value: 100 }, { value: 200 }] } };

    const values = accessor.getValueAs(record, { schema: valueSchema });
    expect(values).toEqual([{ value: 100 }, { value: 200 }]);
  });

  it("accessor getFirstValueAs parses the first value with a schema", async () => {
    const mockList = vi.mocked(listAttributes);
    mockList.mockResolvedValue([
      {
        id: { workspace_id: "w1", object_id: "o1", attribute_id: "a1" },
        title: "Status",
        description: null,
        api_slug: "status",
        type: "status",
        is_system_attribute: false,
        is_writable: true,
        is_required: false,
        is_unique: false,
        is_multiselect: false,
        is_default_value_enabled: false,
        is_archived: false,
        default_value: null,
        relationship: null,
        created_at: "2024-01-01T00:00:00Z",
        config: {
          currency: { default_currency_code: "USD", display_type: "code" },
          record_reference: { allowed_object_ids: null },
        },
      },
    ]);

    const schema = await createSchema({
      target: "objects",
      identifier: "companies",
    });

    const statusSchema = z.object({ status: z.string() });
    const accessor = schema.getAccessorOrThrow("status");
    const record = {
      values: { status: [{ status: "active" }, { status: "inactive" }] },
    };

    const first = accessor.getFirstValueAs(record, { schema: statusSchema });
    expect(first).toEqual({ status: "active" });
  });

  it("accessor getValue returns all values without schema", async () => {
    const mockList = vi.mocked(listAttributes);
    mockList.mockResolvedValue([
      {
        id: { workspace_id: "w1", object_id: "o1", attribute_id: "a1" },
        title: "Tags",
        description: null,
        api_slug: "tags",
        type: "text",
        is_system_attribute: false,
        is_writable: true,
        is_required: false,
        is_unique: false,
        is_multiselect: true,
        is_default_value_enabled: false,
        is_archived: false,
        default_value: null,
        relationship: null,
        created_at: "2024-01-01T00:00:00Z",
        config: {
          currency: { default_currency_code: "USD", display_type: "code" },
          record_reference: { allowed_object_ids: null },
        },
      },
    ]);

    const schema = await createSchema({
      target: "objects",
      identifier: "companies",
    });

    const accessor = schema.getAccessorOrThrow("tags");
    const record = { values: { tags: [{ value: "a" }, { value: "b" }] } };

    const values = accessor.getValue(record);
    expect(values).toEqual([{ value: "a" }, { value: "b" }]);
  });
});

describe("typed accessor methods", () => {
  const mockList = vi.mocked(listAttributes);

  it("firstText extracts string value", async () => {
    mockList.mockResolvedValue([mockAttribute("name", "text")]);
    const schema = await createSchema({
      target: "objects",
      identifier: "companies",
    });
    const accessor = schema.getAccessorOrThrow("name");
    const record = { values: { name: [{ value: "Acme" }] } };
    expect(accessor.firstText(record)).toBe("Acme");
  });

  it("firstNumber extracts number value", async () => {
    mockList.mockResolvedValue([mockAttribute("revenue", "number")]);
    const schema = await createSchema({
      target: "objects",
      identifier: "companies",
    });
    const accessor = schema.getAccessorOrThrow("revenue");
    const record = { values: { revenue: [{ value: 42 }] } };
    expect(accessor.firstNumber(record)).toBe(42);
  });

  it("firstDate extracts date string", async () => {
    mockList.mockResolvedValue([mockAttribute("founded", "date")]);
    const schema = await createSchema({
      target: "objects",
      identifier: "companies",
    });
    const accessor = schema.getAccessorOrThrow("founded");
    const record = { values: { founded: [{ value: "2024-01-15" }] } };
    expect(accessor.firstDate(record)).toBe("2024-01-15");
  });

  it("firstTimestamp extracts timestamp string", async () => {
    mockList.mockResolvedValue([mockAttribute("updated_at", "timestamp")]);
    const schema = await createSchema({
      target: "objects",
      identifier: "companies",
    });
    const accessor = schema.getAccessorOrThrow("updated_at");
    const record = {
      values: { updated_at: [{ value: "2024-01-15T10:30:00Z" }] },
    };
    expect(accessor.firstTimestamp(record)).toBe("2024-01-15T10:30:00Z");
  });

  it("firstCheckbox extracts boolean value", async () => {
    mockList.mockResolvedValue([mockAttribute("is_active", "checkbox")]);
    const schema = await createSchema({
      target: "objects",
      identifier: "companies",
    });
    const accessor = schema.getAccessorOrThrow("is_active");
    const record = { values: { is_active: [{ value: true }] } };
    expect(accessor.firstCheckbox(record)).toBe(true);
  });

  it("firstRating extracts rating number", async () => {
    mockList.mockResolvedValue([mockAttribute("score", "rating")]);
    const schema = await createSchema({
      target: "objects",
      identifier: "companies",
    });
    const accessor = schema.getAccessorOrThrow("score");
    const record = { values: { score: [{ value: 4 }] } };
    expect(accessor.firstRating(record)).toBe(4);
  });

  it("firstCurrencyValue extracts currency_value", async () => {
    mockList.mockResolvedValue([mockAttribute("arr", "currency")]);
    const schema = await createSchema({
      target: "objects",
      identifier: "companies",
    });
    const accessor = schema.getAccessorOrThrow("arr");
    const record = {
      values: { arr: [{ currency_value: 100_000, currency_code: "USD" }] },
    };
    expect(accessor.firstCurrencyValue(record)).toBe(100_000);
  });

  it("firstSelectTitle extracts option title", async () => {
    mockList.mockResolvedValue([mockAttribute("stage", "select")]);
    const schema = await createSchema({
      target: "objects",
      identifier: "companies",
    });
    const accessor = schema.getAccessorOrThrow("stage");
    const record = {
      values: { stage: [{ option: { title: "Series A" } }] },
    };
    expect(accessor.firstSelectTitle(record)).toBe("Series A");
  });

  it("firstStatusTitle extracts status title", async () => {
    mockList.mockResolvedValue([mockAttribute("status", "status")]);
    const schema = await createSchema({
      target: "objects",
      identifier: "companies",
    });
    const accessor = schema.getAccessorOrThrow("status");
    const record = {
      values: { status: [{ status: { title: "Active" } }] },
    };
    expect(accessor.firstStatusTitle(record)).toBe("Active");
  });

  it("firstFullName extracts full_name", async () => {
    mockList.mockResolvedValue([
      mockAttribute("contact_name", "personal-name"),
    ]);
    const schema = await createSchema({
      target: "objects",
      identifier: "people",
    });
    const accessor = schema.getAccessorOrThrow("contact_name");
    const record = {
      values: {
        contact_name: [
          { first_name: "John", last_name: "Doe", full_name: "John Doe" },
        ],
      },
    };
    expect(accessor.firstFullName(record)).toBe("John Doe");
  });

  it("firstEmail extracts email_address", async () => {
    mockList.mockResolvedValue([mockAttribute("email", "email-address")]);
    const schema = await createSchema({
      target: "objects",
      identifier: "people",
    });
    const accessor = schema.getAccessorOrThrow("email");
    const record = {
      values: {
        email: [
          {
            original_email_address: "john@example.com",
            email_address: "john@example.com",
          },
        ],
      },
    };
    expect(accessor.firstEmail(record)).toBe("john@example.com");
  });

  it("firstDomain extracts domain", async () => {
    mockList.mockResolvedValue([mockAttribute("website", "domain")]);
    const schema = await createSchema({
      target: "objects",
      identifier: "companies",
    });
    const accessor = schema.getAccessorOrThrow("website");
    const record = { values: { website: [{ domain: "example.com" }] } };
    expect(accessor.firstDomain(record)).toBe("example.com");
  });

  it("firstPhone extracts phone_number", async () => {
    mockList.mockResolvedValue([mockAttribute("phone", "phone-number")]);
    const schema = await createSchema({
      target: "objects",
      identifier: "people",
    });
    const accessor = schema.getAccessorOrThrow("phone");
    const record = {
      values: {
        phone: [
          {
            original_phone_number: "+15551234567",
            phone_number: "+15551234567",
          },
        ],
      },
    };
    expect(accessor.firstPhone(record)).toBe("+15551234567");
  });

  it("firstValueTyped auto-selects extractor by attribute type", async () => {
    mockList.mockResolvedValue([
      mockAttribute("name", "text"),
      mockAttribute("revenue", "number"),
      mockAttribute("status", "status"),
    ]);
    const schema = await createSchema({
      target: "objects",
      identifier: "companies",
    });
    const record = {
      values: {
        name: [{ value: "Acme" }],
        revenue: [{ value: 42 }],
        status: [{ status: { title: "Active" } }],
      },
    };

    expect(schema.getAccessorOrThrow("name").firstValueTyped(record)).toBe(
      "Acme",
    );
    expect(schema.getAccessorOrThrow("revenue").firstValueTyped(record)).toBe(
      42,
    );
    expect(schema.getAccessorOrThrow("status").firstValueTyped(record)).toBe(
      "Active",
    );
  });

  it("firstValueTyped falls back to getFirstValue for unknown types", async () => {
    mockList.mockResolvedValue([mockAttribute("custom", "unknown-type")]);
    const schema = await createSchema({
      target: "objects",
      identifier: "companies",
    });
    const record = { values: { custom: [{ foo: "bar" }] } };
    expect(schema.getAccessorOrThrow("custom").firstValueTyped(record)).toEqual(
      { foo: "bar" },
    );
  });

  it("typed accessors return undefined for missing attributes", async () => {
    mockList.mockResolvedValue([mockAttribute("name", "text")]);
    const schema = await createSchema({
      target: "objects",
      identifier: "companies",
    });
    const accessor = schema.getAccessorOrThrow("name");
    const record = { values: {} };
    expect(accessor.firstText(record)).toBeUndefined();
    expect(accessor.firstValueTyped(record)).toBeUndefined();
  });
});
