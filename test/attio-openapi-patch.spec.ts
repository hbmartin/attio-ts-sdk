import { describe, expect, it } from "vitest";
import { patchAttioOpenApiSpec } from "../scripts/attio-openapi-patch";

interface JsonObject {
  [key: string]: unknown;
}

const enumValues = ["full-access", "read-and-write", "read-only"];
const actorTypes = ["api-token", "workspace-member", "system", "app"];

const responseTargets = [
  ["post", "/v2/objects/{object}/records/query", "values"],
  ["post", "/v2/objects/{object}/records", "values"],
  ["put", "/v2/objects/{object}/records", "values"],
  ["get", "/v2/objects/{object}/records/{record_id}", "values"],
  ["patch", "/v2/objects/{object}/records/{record_id}", "values"],
  ["put", "/v2/objects/{object}/records/{record_id}", "values"],
  ["post", "/v2/lists/{list}/entries/query", "entry_values"],
  ["post", "/v2/lists/{list}/entries", "entry_values"],
  ["put", "/v2/lists/{list}/entries", "entry_values"],
  ["get", "/v2/lists/{list}/entries/{entry_id}", "entry_values"],
  ["patch", "/v2/lists/{list}/entries/{entry_id}", "entry_values"],
  ["put", "/v2/lists/{list}/entries/{entry_id}", "entry_values"],
] as const;

const objectFrom = (value: unknown): JsonObject => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("Expected value to be an object.");
  }

  return value as JsonObject;
};

const makeStrictValueMap = () => ({
  type: "object",
  additionalProperties: {
    type: "array",
    items: {
      oneOf: [
        {
          type: "object",
          properties: { attribute_type: { type: "string", enum: ["text"] } },
          required: ["attribute_type"],
        },
      ],
    },
  },
});

const makeResponseSchema = (
  fieldName: "values" | "entry_values",
  isArrayResponse: boolean,
) => {
  const dataItem = {
    type: "object",
    properties: {
      id: { type: "object" },
      created_at: { type: "string" },
      [fieldName]: makeStrictValueMap(),
    },
    required: ["id", "created_at", fieldName],
  };

  return {
    type: "object",
    properties: {
      data: isArrayResponse ? { type: "array", items: dataItem } : dataItem,
    },
    required: ["data"],
  };
};

const makeOperation = (
  fieldName: "values" | "entry_values",
  isArrayResponse = false,
) => ({
  responses: {
    "200": {
      description: "Success",
      content: {
        "application/json": {
          schema: makeResponseSchema(fieldName, isArrayResponse),
        },
      },
    },
  },
});

const makePathItem = (
  method: string,
  fieldName: "values" | "entry_values",
  isArrayResponse = false,
) => ({
  [method]: makeOperation(fieldName, isArrayResponse),
});

const makePatchSpec = () => {
  const paths: JsonObject = {};
  for (const [method, path, fieldName] of responseTargets) {
    const existingPathItem = objectFrom(paths[path] ?? {});
    paths[path] = {
      ...existingPathItem,
      ...makePathItem(method, fieldName, path.endsWith("/query")),
    };
  }

  return {
    openapi: "3.1.0",
    info: { title: "Attio", version: "test" },
    paths,
    components: {
      schemas: {
        list: {
          type: "object",
          properties: {
            workspace_access: {
              type: ["string", "null"],
              enum: enumValues,
            },
            workspace_member_access: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  workspace_member_id: { type: "string", format: "uuid" },
                  level: { type: "string", enum: enumValues },
                },
                required: ["workspace_member_id", "level"],
              },
            },
            created_by_actor: {
              type: "object",
              properties: {
                id: { type: "string", nullable: true },
                type: { type: "string", enum: actorTypes, nullable: true },
              },
            },
          },
          required: [
            "workspace_access",
            "workspace_member_access",
            "created_by_actor",
          ],
        },
        task: {
          type: "object",
          properties: {
            completed_at: { type: ["string", "null"] },
          },
          required: ["completed_at"],
        },
        attribute: {
          type: "object",
          properties: {
            config: {
              type: "object",
              properties: {
                currency: {
                  type: "object",
                  properties: {
                    default_currency_code: {
                      type: ["string", "null"],
                      enum: ["USD"],
                    },
                    display_type: {
                      type: ["string", "null"],
                      enum: ["code", "symbol"],
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  };
};

const getSchema = (spec: JsonObject, name: string): JsonObject => {
  const components = objectFrom(spec.components);
  const schemas = objectFrom(components.schemas);
  return objectFrom(schemas[name]);
};

const getProperties = (schema: JsonObject): JsonObject =>
  objectFrom(schema.properties);

const schemaTypeIncludes = (schema: JsonObject, typeName: string): boolean => {
  const { type } = schema;
  return type === typeName || (Array.isArray(type) && type.includes(typeName));
};

const getResponseDataWrapperSchema = (
  spec: JsonObject,
  method: string,
  path: string,
): JsonObject => {
  const paths = objectFrom(spec.paths);
  const pathItem = objectFrom(paths[path]);
  const operation = objectFrom(pathItem[method]);
  const responses = objectFrom(operation.responses);
  const response = objectFrom(responses["200"]);
  const content = objectFrom(response.content);
  const json = objectFrom(content["application/json"]);
  const responseSchema = objectFrom(json.schema);
  return objectFrom(getProperties(responseSchema).data);
};

const getResponseDataSchema = (
  spec: JsonObject,
  method: string,
  path: string,
): JsonObject => {
  const data = getResponseDataWrapperSchema(spec, method, path);
  return schemaTypeIncludes(data, "array") ? objectFrom(data.items) : data;
};

describe("Attio OpenAPI patch", () => {
  it("loosens record and list response value maps before generation", () => {
    const spec = makePatchSpec();

    patchAttioOpenApiSpec(spec);

    for (const [method, path, fieldName] of responseTargets) {
      const dataSchema = getResponseDataSchema(spec, method, path);
      const valueMap = objectFrom(getProperties(dataSchema)[fieldName]);

      expect(dataSchema.required).not.toContain(fieldName);
      expect(valueMap).toMatchObject({
        type: ["object", "null"],
        additionalProperties: {
          type: "array",
          items: {},
        },
      });
    }
  });

  it("normalizes list, task, and currency nullability", () => {
    const spec = makePatchSpec();

    patchAttioOpenApiSpec(spec);

    const listProperties = getProperties(getSchema(spec, "list"));
    const workspaceAccess = objectFrom(listProperties.workspace_access);
    const memberAccess = objectFrom(listProperties.workspace_member_access);
    const memberAccessItems = objectFrom(memberAccess.items);
    const memberAccessLevel = objectFrom(
      getProperties(memberAccessItems).level,
    );
    const actor = objectFrom(listProperties.created_by_actor);
    const actorProperties = getProperties(actor);
    const actorId = objectFrom(actorProperties.id);
    const actorType = objectFrom(actorProperties.type);
    const taskSchema = getSchema(spec, "task");
    const completedAt = objectFrom(getProperties(taskSchema).completed_at);
    const attributeProperties = getProperties(getSchema(spec, "attribute"));
    const config = objectFrom(attributeProperties.config);
    const currency = objectFrom(getProperties(config).currency);
    const currencyProperties = getProperties(currency);

    expect(workspaceAccess.type).toEqual(["string", "null"]);
    expect(workspaceAccess.enum).toContain(null);
    expect(memberAccessLevel.type).toEqual(["string", "null"]);
    expect(memberAccessLevel.enum).toContain(null);
    expect(actorId.type).toEqual(["string", "null"]);
    expect(actorType.type).toEqual(["string", "null"]);
    expect(actorType.enum).toContain(null);
    expect(taskSchema.required).not.toContain("completed_at");
    expect(completedAt.type).toEqual(["string", "null"]);
    expect(objectFrom(currencyProperties.default_currency_code).enum).toContain(
      null,
    );
    expect(objectFrom(currencyProperties.display_type).enum).toContain(null);
  });

  it("loosens nullable array response data schemas", () => {
    const spec = makePatchSpec();
    const dataSchema = getResponseDataSchema(
      spec,
      "post",
      "/v2/lists/{list}/entries/query",
    );
    const dataWrapper = getResponseDataWrapperSchema(
      spec,
      "post",
      "/v2/lists/{list}/entries/query",
    );
    dataWrapper.type = ["array", "null"];

    patchAttioOpenApiSpec(spec);

    const valueMap = objectFrom(getProperties(dataSchema).entry_values);
    expect(dataSchema.required).not.toContain("entry_values");
    expect(valueMap).toMatchObject({
      type: ["object", "null"],
      additionalProperties: {
        type: "array",
        items: {},
      },
    });
  });

  it("allows nullable currency fields without enum constraints", () => {
    const spec = makePatchSpec();
    const attributeProperties = getProperties(getSchema(spec, "attribute"));
    const config = objectFrom(attributeProperties.config);
    const currency = objectFrom(getProperties(config).currency);
    const currencyProperties = getProperties(currency);
    delete objectFrom(currencyProperties.default_currency_code).enum;
    delete objectFrom(currencyProperties.display_type).enum;

    expect(() => patchAttioOpenApiSpec(spec)).not.toThrow();
    expect(objectFrom(currencyProperties.default_currency_code).type).toEqual([
      "string",
      "null",
    ]);
    expect(objectFrom(currencyProperties.display_type).type).toEqual([
      "string",
      "null",
    ]);
  });

  it("fails loudly if an expected response target disappears", () => {
    const spec = makePatchSpec();
    const paths = objectFrom(spec.paths);
    delete paths["/v2/lists/{list}/entries"];

    expect(() => patchAttioOpenApiSpec(spec)).toThrow(
      "Missing OpenAPI path: /v2/lists/{list}/entries.",
    );
  });
});
