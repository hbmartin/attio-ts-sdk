import { describe, expect, it } from "vitest";
import {
  zGetV2ByTargetByIdentifierAttributesResponse,
  zList,
  zObject,
  zPostV2ListsByListEntriesQueryResponse,
  zPostV2ListsByListEntriesResponse,
  zPostV2ObjectsByObjectRecordsQueryResponse,
  zTask,
} from "../../src/generated/zod.gen";

const WORKSPACE_ID = "550e8400-e29b-41d4-a716-446655440000";
const OBJECT_ID = "550e8400-e29b-41d4-a716-446655440001";
const RECORD_ID = "550e8400-e29b-41d4-a716-446655440002";
const LIST_ID = "550e8400-e29b-41d4-a716-446655440003";
const ENTRY_ID = "550e8400-e29b-41d4-a716-446655440004";
const ATTRIBUTE_ID = "550e8400-e29b-41d4-a716-446655440005";
const TASK_ID = "550e8400-e29b-41d4-a716-446655440006";
const STATUS_ID = "550e8400-e29b-41d4-a716-446655440007";

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

describe("generated record and list response validators", () => {
  const unknownValue = {
    active_from: "2024-01-01T00:00:00.000Z",
    active_until: null,
    attribute_type: "future-value",
    payload: { nested: true },
  };

  it("accepts unknown record value shapes in query responses", () => {
    const result = zPostV2ObjectsByObjectRecordsQueryResponse.safeParse({
      data: [
        {
          id: {
            workspace_id: WORKSPACE_ID,
            object_id: OBJECT_ID,
            record_id: RECORD_ID,
          },
          created_at: "2024-01-01T00:00:00.000Z",
          web_url: "https://app.attio.com/example/record",
          values: {
            future_custom_attribute: [unknownValue],
          },
        },
      ],
    });

    if (!result.success) {
      throw result.error;
    }

    expect(result.data.data[0]?.values.future_custom_attribute[0]).toEqual(
      unknownValue,
    );
  });

  it("accepts unknown list entry value shapes in query responses", () => {
    const result = zPostV2ListsByListEntriesQueryResponse.safeParse({
      data: [
        {
          id: {
            workspace_id: WORKSPACE_ID,
            list_id: LIST_ID,
            entry_id: ENTRY_ID,
          },
          parent_record_id: RECORD_ID,
          parent_object: "companies",
          created_at: "2024-01-01T00:00:00.000Z",
          entry_values: {
            future_custom_attribute: [unknownValue],
          },
        },
      ],
    });

    if (!result.success) {
      throw result.error;
    }

    expect(
      result.data.data[0]?.entry_values.future_custom_attribute[0],
    ).toEqual(unknownValue);
  });

  it("accepts list-backed status values in list entry responses", () => {
    const statusValue = {
      active_from: "2024-01-01T00:00:00.000Z",
      active_until: null,
      created_by_actor: {
        id: WORKSPACE_ID,
        type: "workspace-member",
      },
      status: {
        id: {
          workspace_id: WORKSPACE_ID,
          list_id: LIST_ID,
          attribute_id: ATTRIBUTE_ID,
          status_id: STATUS_ID,
        },
        title: "Qualified",
        is_archived: false,
        target_time_in_status: null,
        celebration_enabled: false,
      },
      attribute_type: "status",
    };

    const result = zPostV2ListsByListEntriesResponse.safeParse({
      data: {
        id: {
          workspace_id: WORKSPACE_ID,
          list_id: LIST_ID,
          entry_id: ENTRY_ID,
        },
        parent_record_id: RECORD_ID,
        parent_object: "companies",
        created_at: "2024-01-01T00:00:00.000Z",
        entry_values: {
          stage: [statusValue],
        },
      },
    });

    if (!result.success) {
      throw result.error;
    }

    expect(result.data.data.entry_values?.stage?.[0]).toEqual(statusValue);
  });

  it("accepts omitted and nullish record/list response value maps", () => {
    const recordResult = zPostV2ObjectsByObjectRecordsQueryResponse.safeParse({
      data: [
        {
          id: {
            workspace_id: WORKSPACE_ID,
            object_id: OBJECT_ID,
            record_id: RECORD_ID,
          },
          created_at: "2024-01-01T00:00:00.000Z",
          web_url: "https://app.attio.com/example/record",
        },
      ],
    });
    const listResult = zPostV2ListsByListEntriesResponse.safeParse({
      data: {
        id: {
          workspace_id: WORKSPACE_ID,
          list_id: LIST_ID,
          entry_id: ENTRY_ID,
        },
        parent_record_id: RECORD_ID,
        parent_object: "companies",
        created_at: "2024-01-01T00:00:00.000Z",
        entry_values: null,
      },
    });

    if (!recordResult.success) {
      throw recordResult.error;
    }
    if (!listResult.success) {
      throw listResult.error;
    }

    expect(recordResult.data.data[0]?.values).toBeUndefined();
    expect(listResult.data.data.entry_values).toBeNull();
  });
});

describe("generated list, object, and task validators", () => {
  it("accepts nullable list access and actor fields returned by Attio", () => {
    const result = zList.safeParse({
      id: {
        workspace_id: WORKSPACE_ID,
        list_id: LIST_ID,
      },
      api_slug: "private-list",
      name: "Private List",
      parent_object: ["companies"],
      workspace_access: null,
      workspace_member_access: [
        {
          workspace_member_id: WORKSPACE_ID,
          level: null,
        },
      ],
      created_by_actor: {
        id: null,
        type: null,
      },
      created_at: "2024-01-01T00:00:00.000Z",
    });

    if (!result.success) {
      throw result.error;
    }

    expect(result.data.workspace_access).toBeNull();
    expect(result.data.workspace_member_access[0]?.level).toBeNull();
    expect(result.data.created_by_actor.id).toBeNull();
    expect(result.data.created_by_actor.type).toBeNull();
  });

  it("accepts nullable object slugs and nouns", () => {
    const result = zObject.safeParse({
      id: {
        workspace_id: WORKSPACE_ID,
        object_id: OBJECT_ID,
      },
      api_slug: null,
      singular_noun: null,
      plural_noun: null,
      created_at: "2024-01-01T00:00:00.000Z",
    });

    if (!result.success) {
      throw result.error;
    }

    expect(result.data.api_slug).toBeNull();
    expect(result.data.singular_noun).toBeNull();
    expect(result.data.plural_noun).toBeNull();
  });

  it("accepts tasks with omitted or null completed_at", () => {
    const task = {
      id: {
        workspace_id: WORKSPACE_ID,
        task_id: TASK_ID,
      },
      content_plaintext: "Follow up",
      deadline_at: null,
      is_completed: false,
      linked_records: [],
      assignees: [],
      created_by_actor: {
        id: null,
        type: null,
      },
      created_at: "2024-01-01T00:00:00.000Z",
    };

    const omittedResult = zTask.safeParse(task);
    const nullResult = zTask.safeParse({ ...task, completed_at: null });

    if (!omittedResult.success) {
      throw omittedResult.error;
    }
    if (!nullResult.success) {
      throw nullResult.error;
    }

    expect(omittedResult.data.completed_at).toBeUndefined();
    expect(nullResult.data.completed_at).toBeNull();
  });
});
