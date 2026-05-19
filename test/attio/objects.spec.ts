import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const listObjectsRequest = vi.fn();
const getObjectRequest = vi.fn();
const createObjectRequest = vi.fn();
const updateObjectRequest = vi.fn();
const resolveAttioClient = vi.fn();
const WORKSPACE_ID = "550e8400-e29b-41d4-a716-446655440000";
const OBJECT_ID_1 = "550e8400-e29b-41d4-a716-446655440001";
const OBJECT_ID_2 = "550e8400-e29b-41d4-a716-446655440002";
const OBJECT_ID_3 = "550e8400-e29b-41d4-a716-446655440003";

vi.mock("../../src/generated", async () => {
  const actual = await vi.importActual<typeof import("../../src/generated")>(
    "../../src/generated",
  );
  return {
    ...actual,
    getV2Objects: listObjectsRequest,
    getV2ObjectsByObject: getObjectRequest,
    postV2Objects: createObjectRequest,
    patchV2ObjectsByObject: updateObjectRequest,
  };
});

vi.mock("../../src/attio/client", () => ({
  resolveAttioClient,
}));

describe("objects", () => {
  let listObjects: typeof import("../../src/attio/objects").listObjects;
  let getObject: typeof import("../../src/attio/objects").getObject;
  let createObject: typeof import("../../src/attio/objects").createObject;
  let updateObject: typeof import("../../src/attio/objects").updateObject;
  let createObjectSlug: typeof import("../../src/attio/objects").createObjectSlug;
  let createObjectApiSlug: typeof import("../../src/attio/objects").createObjectApiSlug;
  let createObjectNoun: typeof import("../../src/attio/objects").createObjectNoun;

  beforeAll(async () => {
    ({
      listObjects,
      getObject,
      createObject,
      updateObject,
      createObjectSlug,
      createObjectApiSlug,
      createObjectNoun,
    } = await import("../../src/attio/objects"));
  });

  beforeEach(() => {
    vi.clearAllMocks();
    resolveAttioClient.mockReturnValue({});
  });

  describe("ID factories", () => {
    it("creates branded object identifiers", () => {
      expect(createObjectSlug("people")).toBe("people");
      expect(createObjectApiSlug("custom_deals")).toBe("custom_deals");
      expect(createObjectNoun("Deal")).toBe("Deal");
    });

    it("rejects empty object identifiers", () => {
      expect(() => createObjectSlug("")).toThrow("ObjectSlug cannot be empty");
      expect(() => createObjectApiSlug("")).toThrow(
        "Object API slug cannot be empty",
      );
      expect(() => createObjectNoun("")).toThrow("ObjectNoun cannot be empty");
    });
  });

  it("lists objects", async () => {
    listObjectsRequest.mockResolvedValue({
      data: {
        items: [
          {
            id: { workspace_id: WORKSPACE_ID, object_id: OBJECT_ID_1 },
            api_slug: "companies",
            singular_noun: "Company",
            plural_noun: "Companies",
            created_at: "2024-01-01T00:00:00Z",
          },
        ],
      },
    });

    const result = await listObjects();

    expect(result).toMatchObject([{ api_slug: "companies" }]);
    expect(listObjectsRequest).toHaveBeenCalledWith({ client: {} });
  });

  it("gets an object by slug", async () => {
    getObjectRequest.mockResolvedValue({
      data: {
        id: { workspace_id: WORKSPACE_ID, object_id: OBJECT_ID_2 },
        api_slug: "people",
        singular_noun: "Person",
        plural_noun: "People",
        created_at: "2024-01-01T00:00:00Z",
      },
    });

    const result = await getObject({ object: "people" });

    expect(result).toMatchObject({ api_slug: "people" });
    expect(getObjectRequest).toHaveBeenCalledWith({
      client: {},
      path: { object: "people" },
    });
  });

  it("creates an object", async () => {
    createObjectRequest.mockResolvedValue({
      data: {
        id: { workspace_id: WORKSPACE_ID, object_id: OBJECT_ID_3 },
        api_slug: "deals",
        singular_noun: "Deal",
        plural_noun: "Deals",
        created_at: "2024-01-01T00:00:00Z",
      },
    });

    const result = await createObject({
      apiSlug: "deals",
      singularNoun: "Deal",
      pluralNoun: "Deals",
    });

    expect(result).toMatchObject({ api_slug: "deals" });
    expect(createObjectRequest).toHaveBeenCalledWith({
      client: {},
      body: {
        data: {
          api_slug: "deals",
          singular_noun: "Deal",
          plural_noun: "Deals",
        },
      },
    });
  });

  it("updates an object with only defined fields", async () => {
    updateObjectRequest.mockResolvedValue({
      data: {
        id: { workspace_id: WORKSPACE_ID, object_id: OBJECT_ID_1 },
        api_slug: "deals",
        singular_noun: "Deal",
        plural_noun: "Deals",
        created_at: "2024-01-01T00:00:00Z",
      },
    });

    const result = await updateObject({
      object: "deals",
      singularNoun: "Deal",
    });

    expect(result).toMatchObject({ api_slug: "deals" });
    expect(updateObjectRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        client: {},
        path: { object: "deals" },
        body: expect.objectContaining({
          data: expect.objectContaining({
            singular_noun: "Deal",
          }),
        }),
      }),
    );

    const calledBody = updateObjectRequest.mock.calls[0][0].body;
    expect(calledBody.data).not.toHaveProperty("api_slug");
    expect(calledBody.data).not.toHaveProperty("plural_noun");
  });

  it("updates an object with every optional field when provided", async () => {
    updateObjectRequest.mockResolvedValue({
      data: {
        id: { workspace_id: WORKSPACE_ID, object_id: OBJECT_ID_1 },
        api_slug: "opportunities",
        singular_noun: "Opportunity",
        plural_noun: "Opportunities",
        created_at: "2024-01-01T00:00:00Z",
      },
    });

    await updateObject({
      object: "deals",
      apiSlug: "opportunities",
      singularNoun: "Opportunity",
      pluralNoun: "Opportunities",
    });

    expect(updateObjectRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        body: {
          data: {
            api_slug: "opportunities",
            singular_noun: "Opportunity",
            plural_noun: "Opportunities",
          },
        },
      }),
    );
  });

  it("propagates errors from updateObject request", async () => {
    const testError = new Error("Update failed");
    updateObjectRequest.mockRejectedValue(testError);

    await expect(
      updateObject({
        object: "deals",
        singularNoun: "Deal",
      }),
    ).rejects.toThrow("Update failed");
  });
});
