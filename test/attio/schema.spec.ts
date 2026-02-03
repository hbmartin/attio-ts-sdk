import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { AttioResponseError } from "../../src/attio/errors";
import { listAttributes } from "../../src/attio/metadata";
import { createSchema } from "../../src/attio/schema";

vi.mock("../../src/attio/metadata", () => ({
  listAttributes: vi.fn(),
}));

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
