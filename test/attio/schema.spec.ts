import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { AttioResponseError } from "../../src/attio/errors";
import { listAttributes, type ZodAttribute } from "../../src/attio/metadata";
import { createSchema } from "../../src/attio/schema";

vi.mock("../../src/attio/metadata", () => ({
  listAttributes: vi.fn(),
}));

interface MockAttributeInput {
  slug: ZodAttribute["api_slug"];
  type: ZodAttribute["type"];
}

const mockAttribute = ({ slug, type }: MockAttributeInput): ZodAttribute => ({
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
    mockList.mockResolvedValue([mockAttribute({ slug: "name", type: "text" })]);
    const schema = await createSchema({
      target: "objects",
      identifier: "companies",
    });
    const accessor = schema.getAccessorOrThrow("name");
    const record = { values: { name: [{ value: "Acme" }] } };
    expect(accessor.firstText(record)).toBe("Acme");
  });

  it("firstNumber extracts number value", async () => {
    mockList.mockResolvedValue([
      mockAttribute({ slug: "revenue", type: "number" }),
    ]);
    const schema = await createSchema({
      target: "objects",
      identifier: "companies",
    });
    const accessor = schema.getAccessorOrThrow("revenue");
    const record = { values: { revenue: [{ value: 42 }] } };
    expect(accessor.firstNumber(record)).toBe(42);
  });

  it("firstDate extracts date string", async () => {
    mockList.mockResolvedValue([
      mockAttribute({ slug: "founded", type: "date" }),
    ]);
    const schema = await createSchema({
      target: "objects",
      identifier: "companies",
    });
    const accessor = schema.getAccessorOrThrow("founded");
    const record = { values: { founded: [{ value: "2024-01-15" }] } };
    expect(accessor.firstDate(record)).toBe("2024-01-15");
  });

  it("firstTimestamp extracts timestamp string", async () => {
    mockList.mockResolvedValue([
      mockAttribute({ slug: "updated_at", type: "timestamp" }),
    ]);
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

  it("firstTimestamp accepts null attribute_type from API output", async () => {
    mockList.mockResolvedValue([
      mockAttribute({ slug: "updated_at", type: "timestamp" }),
    ]);
    const schema = await createSchema({
      target: "objects",
      identifier: "companies",
    });
    const accessor = schema.getAccessorOrThrow("updated_at");
    const record = {
      values: {
        updated_at: [{ value: "2024-01-15T10:30:00Z", attribute_type: null }],
      },
    };
    expect(accessor.firstTimestamp(record)).toBe("2024-01-15T10:30:00Z");
  });

  it("firstCheckbox extracts boolean value", async () => {
    mockList.mockResolvedValue([
      mockAttribute({ slug: "is_active", type: "checkbox" }),
    ]);
    const schema = await createSchema({
      target: "objects",
      identifier: "companies",
    });
    const accessor = schema.getAccessorOrThrow("is_active");
    const record = { values: { is_active: [{ value: true }] } };
    expect(accessor.firstCheckbox(record)).toBe(true);
  });

  it("firstRating extracts rating number", async () => {
    mockList.mockResolvedValue([
      mockAttribute({ slug: "score", type: "rating" }),
    ]);
    const schema = await createSchema({
      target: "objects",
      identifier: "companies",
    });
    const accessor = schema.getAccessorOrThrow("score");
    const record = { values: { score: [{ value: 4 }] } };
    expect(accessor.firstRating(record)).toBe(4);
  });

  it("firstCurrencyValue extracts currency_value", async () => {
    mockList.mockResolvedValue([
      mockAttribute({ slug: "arr", type: "currency" }),
    ]);
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
    mockList.mockResolvedValue([
      mockAttribute({ slug: "stage", type: "select" }),
    ]);
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

  it("firstSelectTitle falls back to raw option string", async () => {
    mockList.mockResolvedValue([
      mockAttribute({ slug: "stage", type: "select" }),
    ]);
    const schema = await createSchema({
      target: "objects",
      identifier: "companies",
    });
    const accessor = schema.getAccessorOrThrow("stage");
    const record = {
      values: { stage: [{ option: "opt_abc123" }] },
    };
    expect(accessor.firstSelectTitle(record)).toBe("opt_abc123");
  });

  it("firstStatusTitle extracts status title", async () => {
    mockList.mockResolvedValue([
      mockAttribute({ slug: "status", type: "status" }),
    ]);
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

  it("firstStatusTitle falls back to raw status string", async () => {
    mockList.mockResolvedValue([
      mockAttribute({ slug: "status", type: "status" }),
    ]);
    const schema = await createSchema({
      target: "objects",
      identifier: "companies",
    });
    const accessor = schema.getAccessorOrThrow("status");
    const record = {
      values: { status: [{ status: "sta_abc123" }] },
    };
    expect(accessor.firstStatusTitle(record)).toBe("sta_abc123");
  });

  it("firstFullName extracts full_name", async () => {
    mockList.mockResolvedValue([
      mockAttribute({ slug: "contact_name", type: "personal-name" }),
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
    mockList.mockResolvedValue([
      mockAttribute({ slug: "email", type: "email-address" }),
    ]);
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
    mockList.mockResolvedValue([
      mockAttribute({ slug: "website", type: "domain" }),
    ]);
    const schema = await createSchema({
      target: "objects",
      identifier: "companies",
    });
    const accessor = schema.getAccessorOrThrow("website");
    const record = { values: { website: [{ domain: "example.com" }] } };
    expect(accessor.firstDomain(record)).toBe("example.com");
  });

  it("firstPhone extracts phone_number", async () => {
    mockList.mockResolvedValue([
      mockAttribute({ slug: "phone", type: "phone-number" }),
    ]);
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
      mockAttribute({ slug: "name", type: "text" }),
      mockAttribute({ slug: "revenue", type: "number" }),
      mockAttribute({ slug: "status", type: "status" }),
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

  it("firstValueTyped returns structured object values", async () => {
    mockList.mockResolvedValue([
      mockAttribute({ slug: "owner", type: "actor-reference" }),
      mockAttribute({ slug: "company", type: "record-reference" }),
      mockAttribute({ slug: "address", type: "location" }),
      mockAttribute({ slug: "last_interaction", type: "interaction" }),
    ]);
    const schema = await createSchema({
      target: "objects",
      identifier: "companies",
    });
    const record = {
      values: {
        owner: [
          {
            referenced_actor_type: null,
            referenced_actor_id: "mem_abc123",
          },
        ],
        company: [
          {
            target_object: "companies",
            target_record_id: "rec_abc123",
          },
        ],
        address: [
          {
            line_1: "123 Main St",
            line_2: null,
            line_3: null,
            line_4: null,
            locality: "San Francisco",
            region: "CA",
            postcode: "94105",
            country_code: "US",
            latitude: "37.7749",
            longitude: "-122.4194",
          },
        ],
        last_interaction: [
          {
            interaction_type: "email",
            interacted_at: "2024-01-15T10:30:00Z",
            owner_actor: {},
          },
        ],
      },
    };

    expect(schema.getAccessorOrThrow("owner").firstValueTyped(record)).toEqual({
      referenced_actor_type: null,
      referenced_actor_id: "mem_abc123",
    });
    expect(
      schema.getAccessorOrThrow("company").firstValueTyped(record),
    ).toEqual({
      target_object: "companies",
      target_record_id: "rec_abc123",
    });
    expect(
      schema.getAccessorOrThrow("address").firstValueTyped(record),
    ).toEqual(expect.objectContaining({ locality: "San Francisco" }));
    expect(
      schema.getAccessorOrThrow("last_interaction").firstValueTyped(record),
    ).toEqual(expect.objectContaining({ interaction_type: "email" }));
  });

  it("firstValueTyped falls back to getFirstValue for null attribute type", async () => {
    mockList.mockResolvedValue([mockAttribute({ slug: "custom", type: null })]);
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
    mockList.mockResolvedValue([mockAttribute({ slug: "name", type: "text" })]);
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
