import { describe, expect, it } from "vitest";
import { zGetV2ByTargetByIdentifierAttributesResponse } from "../../src/generated/zod.gen";

const WORKSPACE_ID = "550e8400-e29b-41d4-a716-446655440000";
const OBJECT_ID = "550e8400-e29b-41d4-a716-446655440001";
const ATTRIBUTE_ID = "550e8400-e29b-41d4-a716-446655440002";

describe("generated attribute response validator", () => {
  it("accepts null currency config fields returned by Attio", () => {
    const result = zGetV2ByTargetByIdentifierAttributesResponse.safeParse({
      data: [
        {
          id: {
            workspace_id: WORKSPACE_ID,
            object_id: OBJECT_ID,
            attribute_id: ATTRIBUTE_ID,
          },
          title: "Amount",
          description: null,
          api_slug: "amount",
          type: "currency",
          is_system_attribute: false,
          is_writable: true,
          is_required: false,
          is_unique: false,
          is_multiselect: false,
          is_default_value_enabled: false,
          is_archived: false,
          default_value: null,
          relationship: null,
          created_at: "2024-01-01T00:00:00.000Z",
          config: {
            currency: {
              default_currency_code: null,
              display_type: null,
            },
            record_reference: {
              allowed_object_ids: null,
            },
          },
        },
      ],
    });

    if (!result.success) {
      throw result.error;
    }

    expect(
      result.data.data[0]?.config.currency.default_currency_code,
    ).toBeNull();
    expect(result.data.data[0]?.config.currency.display_type).toBeNull();
  });
});
