import { describe, expect, it } from "vitest";
import {
  actorReferenceValueSchema,
  checkboxValueSchema,
  currencyValueSchema,
  dateValueSchema,
  domainValueSchema,
  emailValueSchema,
  enrichedSelectValueSchema,
  enrichedStatusValueSchema,
  interactionValueSchema,
  locationValueSchema,
  numberValueSchema,
  personalNameValueSchema,
  phoneValueSchema,
  ratingValueSchema,
  recordReferenceValueSchema,
  selectOptionObjectSchema,
  selectValueSchema,
  statusObjectSchema,
  statusValueSchema,
  textValueSchema,
  timestampValueSchema,
  valueSchemasByType,
} from "../../src/attio/value-schemas";

describe("scalar value schemas", () => {
  it("textValueSchema parses valid text", () => {
    const result = textValueSchema.parse({ value: "hello" });
    expect(result.value).toBe("hello");
  });

  it("textValueSchema rejects non-string value", () => {
    expect(() => textValueSchema.parse({ value: 123 })).toThrow();
  });

  it("textValueSchema passes through extra fields", () => {
    const result = textValueSchema.parse({
      value: "hello",
      attribute_type: "text",
      extra: true,
    });
    expect(result.value).toBe("hello");
    expect((result as Record<string, unknown>).extra).toBe(true);
  });

  it("numberValueSchema parses valid number", () => {
    const result = numberValueSchema.parse({ value: 42 });
    expect(result.value).toBe(42);
  });

  it("numberValueSchema rejects non-number value", () => {
    expect(() => numberValueSchema.parse({ value: "not a number" })).toThrow();
  });

  it("checkboxValueSchema parses valid boolean", () => {
    expect(checkboxValueSchema.parse({ value: true }).value).toBe(true);
    expect(checkboxValueSchema.parse({ value: false }).value).toBe(false);
  });

  it("checkboxValueSchema rejects non-boolean value", () => {
    expect(() => checkboxValueSchema.parse({ value: "yes" })).toThrow();
  });

  it("dateValueSchema parses valid date string", () => {
    const result = dateValueSchema.parse({ value: "2024-01-15" });
    expect(result.value).toBe("2024-01-15");
  });

  it("dateValueSchema passes through attribute_type", () => {
    const result = dateValueSchema.parse({
      value: "2024-01-15",
      attribute_type: "date",
    });
    expect(result.attribute_type).toBe("date");
  });

  it("timestampValueSchema parses valid timestamp string", () => {
    const result = timestampValueSchema.parse({
      value: "2024-01-15T10:30:00Z",
    });
    expect(result.value).toBe("2024-01-15T10:30:00Z");
  });

  it("ratingValueSchema parses valid rating", () => {
    expect(ratingValueSchema.parse({ value: 0 }).value).toBe(0);
    expect(ratingValueSchema.parse({ value: 5 }).value).toBe(5);
    expect(ratingValueSchema.parse({ value: 3 }).value).toBe(3);
  });

  it("ratingValueSchema rejects out-of-range values", () => {
    expect(() => ratingValueSchema.parse({ value: -1 })).toThrow();
    expect(() => ratingValueSchema.parse({ value: 6 })).toThrow();
  });
});

describe("complex value schemas", () => {
  it("currencyValueSchema parses currency with code", () => {
    const result = currencyValueSchema.parse({
      currency_value: 50_000,
      currency_code: "USD",
    });
    expect(result.currency_value).toBe(50_000);
    expect(result.currency_code).toBe("USD");
  });

  it("currencyValueSchema parses currency without code", () => {
    const result = currencyValueSchema.parse({ currency_value: 100 });
    expect(result.currency_value).toBe(100);
    expect(result.currency_code).toBeUndefined();
  });

  it("domainValueSchema parses domain", () => {
    const result = domainValueSchema.parse({
      domain: "example.com",
      root_domain: "example.com",
    });
    expect(result.domain).toBe("example.com");
    expect(result.root_domain).toBe("example.com");
  });

  it("domainValueSchema parses domain without root_domain", () => {
    const result = domainValueSchema.parse({ domain: "sub.example.com" });
    expect(result.domain).toBe("sub.example.com");
  });

  it("emailValueSchema parses email", () => {
    const result = emailValueSchema.parse({
      original_email_address: "Test@Example.com",
      email_address: "test@example.com",
      email_domain: "example.com",
      email_root_domain: "example.com",
      email_local_specifier: "test",
    });
    expect(result.email_address).toBe("test@example.com");
    expect(result.original_email_address).toBe("Test@Example.com");
  });

  it("emailValueSchema requires original and email address", () => {
    expect(() =>
      emailValueSchema.parse({ email_address: "test@example.com" }),
    ).toThrow();
  });

  it("phoneValueSchema parses phone number", () => {
    const result = phoneValueSchema.parse({
      original_phone_number: "+1 (555) 123-4567",
      phone_number: "+15551234567",
      country_code: "US",
    });
    expect(result.phone_number).toBe("+15551234567");
  });

  it("personalNameValueSchema parses name", () => {
    const result = personalNameValueSchema.parse({
      first_name: "John",
      last_name: "Doe",
      full_name: "John Doe",
    });
    expect(result.full_name).toBe("John Doe");
    expect(result.first_name).toBe("John");
    expect(result.last_name).toBe("Doe");
  });

  it("locationValueSchema parses location with nullable fields", () => {
    const result = locationValueSchema.parse({
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
    });
    expect(result.locality).toBe("San Francisco");
    expect(result.line_2).toBeNull();
  });
});

describe("reference value schemas", () => {
  it("recordReferenceValueSchema parses record reference", () => {
    const result = recordReferenceValueSchema.parse({
      target_object: "companies",
      target_record_id: "rec_abc123",
    });
    expect(result.target_object).toBe("companies");
    expect(result.target_record_id).toBe("rec_abc123");
  });

  it("actorReferenceValueSchema parses actor reference", () => {
    const result = actorReferenceValueSchema.parse({
      referenced_actor_type: "workspace-member",
      referenced_actor_id: "mem_abc123",
    });
    expect(result.referenced_actor_type).toBe("workspace-member");
    expect(result.referenced_actor_id).toBe("mem_abc123");
  });

  it("actorReferenceValueSchema accepts null actor id", () => {
    const result = actorReferenceValueSchema.parse({
      referenced_actor_type: "system",
      referenced_actor_id: null,
    });
    expect(result.referenced_actor_id).toBeNull();
  });

  it("interactionValueSchema parses interaction", () => {
    const result = interactionValueSchema.parse({
      interaction_type: "email",
      interacted_at: "2024-01-15T10:30:00Z",
      owner_actor: { id: "mem_123", type: "workspace-member" },
    });
    expect(result.interaction_type).toBe("email");
    expect(result.interacted_at).toBe("2024-01-15T10:30:00Z");
  });
});

describe("select/status value schemas", () => {
  it("selectOptionObjectSchema parses option with title", () => {
    const result = selectOptionObjectSchema.parse({
      title: "Option A",
      id: "opt_1",
    });
    expect(result.title).toBe("Option A");
  });

  it("selectValueSchema parses string option", () => {
    const result = selectValueSchema.parse({ option: "opt_abc" });
    expect(result.option).toBe("opt_abc");
  });

  it("selectValueSchema parses enriched option object", () => {
    const result = selectValueSchema.parse({
      option: { title: "Active", id: "opt_1" },
    });
    expect((result.option as { title: string }).title).toBe("Active");
  });

  it("enrichedSelectValueSchema requires option object with title", () => {
    const result = enrichedSelectValueSchema.parse({
      option: { title: "Active" },
    });
    expect(result.option.title).toBe("Active");
  });

  it("enrichedSelectValueSchema rejects string option", () => {
    expect(() =>
      enrichedSelectValueSchema.parse({ option: "opt_abc" }),
    ).toThrow();
  });

  it("statusObjectSchema parses status with title", () => {
    const result = statusObjectSchema.parse({ title: "Open", id: "s_1" });
    expect(result.title).toBe("Open");
  });

  it("statusValueSchema parses string status", () => {
    const result = statusValueSchema.parse({ status: "active" });
    expect(result.status).toBe("active");
  });

  it("statusValueSchema parses enriched status object", () => {
    const result = statusValueSchema.parse({
      status: { title: "Active", id: "s_1" },
    });
    expect((result.status as { title: string }).title).toBe("Active");
  });

  it("enrichedStatusValueSchema requires status object with title", () => {
    const result = enrichedStatusValueSchema.parse({
      status: { title: "Active" },
    });
    expect(result.status.title).toBe("Active");
  });

  it("enrichedStatusValueSchema rejects string status", () => {
    expect(() =>
      enrichedStatusValueSchema.parse({ status: "active" }),
    ).toThrow();
  });
});

describe("valueSchemasByType lookup", () => {
  it("maps all expected attribute types", () => {
    const expectedTypes = [
      "text",
      "number",
      "checkbox",
      "date",
      "timestamp",
      "rating",
      "currency",
      "domain",
      "email-address",
      "phone-number",
      "personal-name",
      "location",
      "record-reference",
      "actor-reference",
      "interaction",
      "select",
      "status",
    ] as const;

    for (const type of expectedTypes) {
      expect(valueSchemasByType[type]).toBeDefined();
    }
  });

  it("text schema matches textValueSchema", () => {
    expect(valueSchemasByType.text).toBe(textValueSchema);
  });

  it("number schema matches numberValueSchema", () => {
    expect(valueSchemasByType.number).toBe(numberValueSchema);
  });

  it("each schema in the lookup parses valid data", () => {
    const validData: Record<string, unknown> = {
      text: { value: "hello" },
      number: { value: 42 },
      checkbox: { value: true },
      date: { value: "2024-01-01" },
      timestamp: { value: "2024-01-01T00:00:00Z" },
      rating: { value: 3 },
      currency: { currency_value: 100 },
      domain: { domain: "example.com" },
      "email-address": {
        original_email_address: "a@b.com",
        email_address: "a@b.com",
      },
      "phone-number": {
        original_phone_number: "+1234",
        phone_number: "+1234",
      },
      "personal-name": {
        first_name: "A",
        last_name: "B",
        full_name: "A B",
      },
      location: {
        line_1: null,
        line_2: null,
        line_3: null,
        line_4: null,
        locality: null,
        region: null,
        postcode: null,
        country_code: null,
        latitude: null,
        longitude: null,
      },
      "record-reference": {
        target_object: "people",
        target_record_id: "r_1",
      },
      "actor-reference": {
        referenced_actor_type: "system",
        referenced_actor_id: null,
      },
      interaction: {
        interaction_type: "email",
        interacted_at: "2024-01-01T00:00:00Z",
        owner_actor: {},
      },
      select: { option: "opt_1" },
      status: { status: "active" },
    };

    for (const [type, data] of Object.entries(validData)) {
      const schema =
        valueSchemasByType[type as keyof typeof valueSchemasByType];
      expect(schema.safeParse(data).success, `${type} should parse`).toBe(true);
    }
  });
});
