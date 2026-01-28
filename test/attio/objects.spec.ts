import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const listObjectsRequest = vi.fn();
const getObjectRequest = vi.fn();
const createObjectRequest = vi.fn();
const updateObjectRequest = vi.fn();
const resolveAttioClient = vi.fn();

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

  beforeAll(async () => {
    ({ listObjects, getObject, createObject, updateObject } = await import(
      "../../src/attio/objects"
    ));
  });

  beforeEach(() => {
    vi.clearAllMocks();
    resolveAttioClient.mockReturnValue({});
  });

  it("lists objects", async () => {
    listObjectsRequest.mockResolvedValue({
      data: { items: [{ api_slug: "companies" }] },
    });

    const result = await listObjects();

    expect(result).toEqual([{ api_slug: "companies" }]);
    expect(listObjectsRequest).toHaveBeenCalledWith({ client: {} });
  });

  it("gets an object by slug", async () => {
    getObjectRequest.mockResolvedValue({ data: { api_slug: "people" } });

    const result = await getObject({ object: "people" });

    expect(result).toEqual({ api_slug: "people" });
    expect(getObjectRequest).toHaveBeenCalledWith({
      client: {},
      path: { object: "people" },
    });
  });

  it("creates an object", async () => {
    createObjectRequest.mockResolvedValue({ data: { api_slug: "deals" } });

    const result = await createObject({
      apiSlug: "deals",
      singularNoun: "Deal",
      pluralNoun: "Deals",
    });

    expect(result).toEqual({ api_slug: "deals" });
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

  it("updates an object", async () => {
    updateObjectRequest.mockResolvedValue({ data: { api_slug: "deals" } });

    const result = await updateObject({
      object: "deals",
      singularNoun: "Deal",
    });

    expect(result).toEqual({ api_slug: "deals" });
    expect(updateObjectRequest).toHaveBeenCalledWith({
      client: {},
      path: { object: "deals" },
      body: {
        data: {
          api_slug: undefined,
          singular_noun: "Deal",
          plural_noun: undefined,
        },
      },
    });
  });
});
