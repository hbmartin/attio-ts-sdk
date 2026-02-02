import { describe, expect, it, vi } from "vitest";
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
});
