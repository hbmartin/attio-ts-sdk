import { describe, expect, it, vi } from "vitest";
import { AttioResponseError } from "../../src/attio/errors";
import type {
  NormalizedAllowedValue,
  ZodAttribute,
} from "../../src/attio/metadata";
import { createWriteValuesBuilder } from "../../src/attio/write-values";

interface MockAttributeInput {
  slug: string;
  title?: string;
  type: ZodAttribute["type"];
  writable?: boolean;
  defaultCurrencyCode?: "USD" | "EUR" | null;
}

const mockAttribute = ({
  slug,
  title = slug,
  type,
  writable = true,
  defaultCurrencyCode = "USD",
}: MockAttributeInput): ZodAttribute => ({
  id: {
    workspace_id: "550e8400-e29b-41d4-a716-446655440000",
    object_id: "550e8400-e29b-41d4-a716-446655440001",
    attribute_id: `550e8400-e29b-41d4-a716-44665544${slug.padStart(4, "0").slice(0, 4)}`,
  },
  title,
  description: null,
  api_slug: slug,
  type,
  is_system_attribute: false,
  is_writable: writable,
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
      default_currency_code: defaultCurrencyCode,
      display_type: "code",
    },
    record_reference: { allowed_object_ids: null },
  },
});

const allowedValues = (
  values: Array<
    Pick<NormalizedAllowedValue, "id" | "title"> & { archived?: boolean }
  >,
): NormalizedAllowedValue[] =>
  values.map((entry) => ({
    id: entry.id,
    title: entry.title,
    archived: entry.archived ?? false,
  }));

interface DeferredAllowedValues {
  promise: Promise<NormalizedAllowedValue[]>;
  resolve: (value: NormalizedAllowedValue[]) => void;
}

const createDeferredAllowedValues = (): DeferredAllowedValues => {
  let resolveDeferred: ((value: NormalizedAllowedValue[]) => void) | undefined;
  const promise = new Promise<NormalizedAllowedValue[]>((resolve) => {
    resolveDeferred = resolve;
  });

  if (!resolveDeferred) {
    throw new Error("Deferred allowed values resolver was not initialized.");
  }

  return { promise, resolve: resolveDeferred };
};

describe("createWriteValuesBuilder", () => {
  it("resolves titles and slugs, then serializes native values", async () => {
    const builder = createWriteValuesBuilder({
      target: "objects",
      identifier: "companies",
      attributes: [
        mockAttribute({ slug: "name", title: "Name", type: "text" }),
        mockAttribute({ slug: "website", title: "Website", type: "domain" }),
        mockAttribute({ slug: "employees", type: "number" }),
        mockAttribute({ slug: "active", title: "Active", type: "checkbox" }),
        mockAttribute({ slug: "founded", title: "Founded", type: "date" }),
        mockAttribute({
          slug: "updated_at",
          title: "Updated At",
          type: "timestamp",
        }),
        mockAttribute({ slug: "revenue", title: "Revenue", type: "currency" }),
      ],
    });

    const values = await builder.buildValues({
      Name: "Acme",
      Website: "acme.com",
      employees: 42,
      Active: true,
      Founded: new Date("2024-01-02T10:15:00.000Z"),
      "Updated At": new Date("2024-01-02T10:15:00.000Z"),
      Revenue: 12_500,
    });

    expect(values).toEqual({
      name: [{ value: "Acme" }],
      website: [{ domain: "acme.com" }],
      employees: [{ value: 42 }],
      active: [{ value: true }],
      founded: [{ value: "2024-01-02" }],
      updated_at: [{ value: "2024-01-02T10:15:00.000Z" }],
      revenue: [{ currency_value: 12_500, currency_code: "USD" }],
    });
  });

  it("validates select and status values against metadata", async () => {
    const allowedValueResolver = vi.fn(async ({ attribute }) => {
      if (attribute === "stage") {
        return allowedValues([{ id: "opt_1", title: "Prospect" }]);
      }
      return allowedValues([{ id: "sta_1", title: "Customer" }]);
    });
    const builder = createWriteValuesBuilder({
      target: "objects",
      identifier: "companies",
      attributes: [
        mockAttribute({ slug: "stage", title: "Stage", type: "select" }),
        mockAttribute({ slug: "status", title: "Status", type: "status" }),
      ],
      allowedValueResolver,
    });

    const values = await builder.buildValues({
      Stage: "Prospect",
      Status: "Customer",
    });

    expect(values).toEqual({
      stage: [{ option: "Prospect" }],
      status: [{ status: "Customer" }],
    });
    expect(allowedValueResolver).toHaveBeenCalledTimes(2);
  });

  it("retries allowed value lookups after transient resolver failures", async () => {
    const transientError = new Error("Metadata fetch failed");
    const allowedValueResolver = vi
      .fn<() => Promise<NormalizedAllowedValue[]>>()
      .mockRejectedValueOnce(transientError)
      .mockResolvedValue(allowedValues([{ id: "opt_1", title: "Prospect" }]));
    const builder = createWriteValuesBuilder({
      target: "objects",
      identifier: "companies",
      attributes: [
        mockAttribute({ slug: "stage", title: "Stage", type: "select" }),
      ],
      allowedValueResolver,
    });

    await expect(builder.buildValues({ Stage: "Prospect" })).rejects.toThrow(
      transientError,
    );
    await expect(builder.buildValues({ Stage: "Prospect" })).resolves.toEqual({
      stage: [{ option: "Prospect" }],
    });
    expect(allowedValueResolver).toHaveBeenCalledTimes(2);
  });

  it("starts independent allowed value lookups before awaiting earlier fields", async () => {
    const stageValues = createDeferredAllowedValues();
    const statusValues = createDeferredAllowedValues();
    const requestedAttributes: string[] = [];
    const allowedValueResolver = vi.fn(({ attribute }) => {
      requestedAttributes.push(attribute);

      if (attribute === "stage") {
        return stageValues.promise;
      }

      if (attribute === "status") {
        return statusValues.promise;
      }

      return Promise.resolve([]);
    });
    const builder = createWriteValuesBuilder({
      target: "objects",
      identifier: "companies",
      attributes: [
        mockAttribute({ slug: "stage", title: "Stage", type: "select" }),
        mockAttribute({ slug: "status", title: "Status", type: "status" }),
      ],
      allowedValueResolver,
    });

    const buildPromise = builder.buildValues({
      Stage: "Prospect",
      Status: "Customer",
    });

    expect(requestedAttributes).toEqual(["stage", "status"]);

    stageValues.resolve(allowedValues([{ id: "opt_1", title: "Prospect" }]));
    statusValues.resolve(allowedValues([{ id: "sta_1", title: "Customer" }]));

    await expect(buildPromise).resolves.toEqual({
      stage: [{ option: "Prospect" }],
      status: [{ status: "Customer" }],
    });
  });

  it("accepts existing value factory arrays and record reference objects", async () => {
    const allowedValueResolver = vi.fn(async () =>
      allowedValues([{ id: "opt_1", title: "Prospect" }]),
    );
    const builder = createWriteValuesBuilder({
      target: "objects",
      identifier: "companies",
      attributes: [
        mockAttribute({ slug: "stage", title: "Stage", type: "select" }),
        mockAttribute({
          slug: "parent_company",
          title: "Parent Company",
          type: "record-reference",
        }),
      ],
      allowedValueResolver,
    });

    const values = await builder.buildValues({
      Stage: [{ option: "Prospect" }],
      "Parent Company": {
        targetObject: "companies",
        targetRecordId: "rec_123",
      },
    });

    expect(values).toEqual({
      stage: [{ option: "Prospect" }],
      parent_company: [
        {
          target_object: "companies",
          target_record_id: "rec_123",
        },
      ],
    });
  });

  it("uses null to clear a field and skips undefined fields", async () => {
    const builder = createWriteValuesBuilder({
      target: "objects",
      identifier: "companies",
      attributes: [
        mockAttribute({ slug: "name", title: "Name", type: "text" }),
        mockAttribute({ slug: "website", title: "Website", type: "domain" }),
      ],
    });

    await expect(
      builder.buildValues({ Name: null, Website: undefined }),
    ).resolves.toEqual({ name: [] });
  });

  it("rejects non-writable and ambiguous attributes", async () => {
    const nonWritableBuilder = createWriteValuesBuilder({
      target: "objects",
      identifier: "companies",
      attributes: [
        mockAttribute({
          slug: "created_at",
          title: "Created At",
          type: "timestamp",
          writable: false,
        }),
      ],
    });

    await expect(
      nonWritableBuilder.buildValues({ "Created At": new Date() }),
    ).rejects.toMatchObject({ code: "NON_WRITABLE_ATTRIBUTE" });

    const ambiguousBuilder = createWriteValuesBuilder({
      target: "objects",
      identifier: "companies",
      attributes: [
        mockAttribute({ slug: "stage_a", title: "Stage", type: "select" }),
        mockAttribute({ slug: "stage_b", title: "Stage", type: "select" }),
      ],
    });

    await expect(
      ambiguousBuilder.buildValues({ Stage: "Prospect" }),
    ).rejects.toMatchObject({ code: "AMBIGUOUS_ATTRIBUTE_TITLE" });
  });

  it("rejects unknown or archived allowed values unless configured otherwise", async () => {
    const allowedValueResolver = vi.fn(async () =>
      allowedValues([{ id: "opt_1", title: "Prospect", archived: true }]),
    );
    const builder = createWriteValuesBuilder({
      target: "objects",
      identifier: "companies",
      attributes: [
        mockAttribute({ slug: "stage", title: "Stage", type: "select" }),
      ],
      allowedValueResolver,
    });

    await expect(
      builder.buildValues({ Stage: "Missing" }),
    ).rejects.toMatchObject({ code: "UNKNOWN_ALLOWED_VALUE" });
    await expect(
      builder.buildValues({ Stage: "Prospect" }),
    ).rejects.toMatchObject({ code: "ARCHIVED_ALLOWED_VALUE" });

    await expect(
      builder.buildValues(
        { Stage: "Prospect" },
        { includeArchivedAllowedValues: true },
      ),
    ).resolves.toEqual({ stage: [{ option: "Prospect" }] });
  });

  it("can disable allowed value validation for select and status fields", async () => {
    const allowedValueResolver = vi.fn();
    const builder = createWriteValuesBuilder({
      target: "objects",
      identifier: "companies",
      attributes: [
        mockAttribute({ slug: "stage", title: "Stage", type: "select" }),
      ],
      allowedValueResolver,
    });

    await expect(
      builder.buildValues(
        { Stage: "Locally Created" },
        { validateAllowedValues: false },
      ),
    ).resolves.toEqual({ stage: [{ option: "Locally Created" }] });
    expect(allowedValueResolver).not.toHaveBeenCalled();
  });

  it("wraps invalid native values in AttioResponseError", async () => {
    const builder = createWriteValuesBuilder({
      target: "objects",
      identifier: "companies",
      attributes: [
        mockAttribute({ slug: "email", title: "Email", type: "email-address" }),
      ],
    });

    await expect(
      builder.buildValues({ Email: "not-an-email" }),
    ).rejects.toThrow(AttioResponseError);
    await expect(
      builder.buildValues({ Email: "not-an-email" }),
    ).rejects.toMatchObject({ code: "INVALID_WRITE_VALUE" });
  });

  it("rejects invalid Date objects as invalid write values", async () => {
    const builder = createWriteValuesBuilder({
      target: "objects",
      identifier: "companies",
      attributes: [
        mockAttribute({ slug: "founded", title: "Founded", type: "date" }),
      ],
    });

    await expect(
      builder.buildValues({ Founded: new Date("invalid") }),
    ).rejects.toMatchObject({ code: "INVALID_WRITE_VALUE" });
  });
});
