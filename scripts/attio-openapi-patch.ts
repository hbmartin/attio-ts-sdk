type JsonObject = { [key: string]: unknown };

const RECORD_VALUE_RESPONSE_TARGETS = [
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

const SUCCESS_RESPONSE_CODES = ["200", "201"] as const;
const NULLABLE_CURRENCY_CONFIG_FIELDS = [
  "default_currency_code",
  "display_type",
] as const;

const isJsonObject = (value: unknown): value is JsonObject =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const assertJsonObject = (value: unknown, description: string): JsonObject => {
  if (!isJsonObject(value)) {
    throw new Error(`Expected ${description} to be an object.`);
  }

  return value;
};

const getRequiredObject = (
  parent: JsonObject,
  key: string,
  description: string,
): JsonObject => assertJsonObject(parent[key], `${description}.${key}`);

const getOptionalObject = (
  parent: JsonObject,
  key: string,
): JsonObject | undefined => {
  const value = parent[key];
  return isJsonObject(value) ? value : undefined;
};

const getRequiredArray = (
  parent: JsonObject,
  key: string,
  description: string,
): unknown[] => {
  const value = parent[key];
  if (!Array.isArray(value)) {
    throw new Error(`Expected ${description}.${key} to be an array.`);
  }

  return value;
};

const getOptionalArray = (parent: JsonObject, key: string): unknown[] => {
  const value = parent[key];
  return Array.isArray(value) ? value : [];
};

const removeRequiredProperty = (
  schema: JsonObject,
  propertyName: string,
  schemaName: string,
): void => {
  const required = getRequiredArray(schema, "required", schemaName);
  if (!required.includes(propertyName)) {
    throw new Error(`Expected ${schemaName} to require ${propertyName}.`);
  }

  schema.required = required.filter((field) => field !== propertyName);
};

const typeAllowsNull = (schema: JsonObject): boolean => {
  const type = schema.type;
  return Array.isArray(type) && type.includes("null");
};

const markSchemaNullable = (schema: JsonObject): void => {
  const type = schema.type;
  if (typeof type === "string" && type !== "null") {
    schema.type = [type, "null"];
  } else if (Array.isArray(type) && !type.includes("null")) {
    schema.type = [...type, "null"];
  }

  if (Array.isArray(schema.enum) && !schema.enum.includes(null)) {
    schema.enum = [...schema.enum, null];
  }

  delete schema.nullable;
};

const normalizeNullableSchemas = (value: unknown): void => {
  if (!isJsonObject(value)) {
    return;
  }

  if (value.nullable === true || typeAllowsNull(value)) {
    markSchemaNullable(value);
  }

  for (const child of Object.values(value)) {
    if (Array.isArray(child)) {
      for (const item of child) {
        normalizeNullableSchemas(item);
      }
    } else {
      normalizeNullableSchemas(child);
    }
  }
};

const getComponentsSchema = (spec: JsonObject, schemaName: string): JsonObject => {
  const components = getRequiredObject(spec, "components", "OpenAPI spec");
  const schemas = getRequiredObject(components, "schemas", "components");
  return getRequiredObject(schemas, schemaName, "components.schemas");
};

const getProperties = (schema: JsonObject, schemaName: string): JsonObject =>
  getRequiredObject(schema, "properties", schemaName);

const getSuccessResponseSchema = (
  operation: JsonObject,
  method: string,
  path: string,
): JsonObject => {
  const responses = getRequiredObject(operation, "responses", `${method} ${path}`);

  for (const statusCode of SUCCESS_RESPONSE_CODES) {
    const response = getOptionalObject(responses, statusCode);
    const content = response && getOptionalObject(response, "content");
    const json = content && getOptionalObject(content, "application/json");
    const schema = json && getOptionalObject(json, "schema");
    if (schema) {
      return schema;
    }
  }

  throw new Error(`Could not find JSON success response for ${method} ${path}.`);
};

const getOperation = (
  spec: JsonObject,
  method: string,
  path: string,
): JsonObject => {
  const paths = getRequiredObject(spec, "paths", "OpenAPI spec");
  const pathItem = getOptionalObject(paths, path);
  if (!pathItem) {
    throw new Error(`Missing OpenAPI path: ${path}.`);
  }

  const operation = getOptionalObject(pathItem, method);
  if (!operation) {
    throw new Error(`Missing OpenAPI operation: ${method.toUpperCase()} ${path}.`);
  }

  return operation;
};

const getResponseDataSchema = (
  responseSchema: JsonObject,
  method: string,
  path: string,
): JsonObject => {
  const properties = getProperties(responseSchema, `${method} ${path} response`);
  const data = getRequiredObject(
    properties,
    "data",
    `${method} ${path} response.properties`,
  );

  if (data.type === "array") {
    return getRequiredObject(data, "items", `${method} ${path} response.data`);
  }

  return data;
};

const loosenResponseValueMap = (
  spec: JsonObject,
  method: string,
  path: string,
  fieldName: string,
): void => {
  const operation = getOperation(spec, method, path);
  const responseSchema = getSuccessResponseSchema(operation, method, path);
  const dataSchema = getResponseDataSchema(responseSchema, method, path);
  const properties = getProperties(dataSchema, `${method} ${path} response.data`);
  const valueMap = getRequiredObject(
    properties,
    fieldName,
    `${method} ${path} response.data.properties`,
  );

  removeRequiredProperty(dataSchema, fieldName, `${method} ${path} response.data`);
  valueMap.type = ["object", "null"];
  valueMap.additionalProperties = {
    type: "array",
    items: {},
  };
};

const patchListSchema = (spec: JsonObject): void => {
  const listComponentSchema = getComponentsSchema(spec, "list");
  const properties = getProperties(
    listComponentSchema,
    "components.schemas.list",
  );
  const workspaceAccess = getRequiredObject(
    properties,
    "workspace_access",
    "list.properties",
  );
  const workspaceMemberAccess = getRequiredObject(
    properties,
    "workspace_member_access",
    "list.properties",
  );
  const memberAccessItems = getRequiredObject(
    workspaceMemberAccess,
    "items",
    "list.workspace_member_access",
  );
  const memberAccessProperties = getProperties(
    memberAccessItems,
    "list.workspace_member_access.items",
  );
  const memberAccessLevel = getRequiredObject(
    memberAccessProperties,
    "level",
    "list.workspace_member_access.items.properties",
  );
  const createdByActor = getRequiredObject(
    properties,
    "created_by_actor",
    "list.properties",
  );
  const actorProperties = getProperties(
    createdByActor,
    "list.created_by_actor",
  );

  markSchemaNullable(workspaceAccess);
  markSchemaNullable(memberAccessLevel);
  markSchemaNullable(
    getRequiredObject(actorProperties, "id", "list.created_by_actor.properties"),
  );
  markSchemaNullable(
    getRequiredObject(
      actorProperties,
      "type",
      "list.created_by_actor.properties",
    ),
  );
};

const patchTaskSchema = (spec: JsonObject): void => {
  const taskSchema = getComponentsSchema(spec, "task");
  removeRequiredProperty(taskSchema, "completed_at", "components.schemas.task");
  markSchemaNullable(
    getRequiredObject(
      getProperties(taskSchema, "components.schemas.task"),
      "completed_at",
      "task.properties",
    ),
  );
};

const assertCurrencyConfigFieldsAreNullable = (spec: JsonObject): void => {
  const attributeSchema = getComponentsSchema(spec, "attribute");
  const config = getRequiredObject(
    getProperties(attributeSchema, "components.schemas.attribute"),
    "config",
    "attribute.properties",
  );
  const currency = getRequiredObject(
    getProperties(config, "attribute.config"),
    "currency",
    "attribute.config.properties",
  );
  const currencyProperties = getProperties(currency, "attribute.config.currency");

  for (const fieldName of NULLABLE_CURRENCY_CONFIG_FIELDS) {
    const fieldSchema = getRequiredObject(
      currencyProperties,
      fieldName,
      "attribute.config.currency.properties",
    );
    if (!typeAllowsNull(fieldSchema) || !getOptionalArray(fieldSchema, "enum").includes(null)) {
      throw new Error(`Expected currency config ${fieldName} to be nullable.`);
    }
  }
};

const patchAttioOpenApiSpec = (spec: unknown): void => {
  const openApiSpec = assertJsonObject(spec, "OpenAPI spec");

  normalizeNullableSchemas(openApiSpec);
  patchListSchema(openApiSpec);
  patchTaskSchema(openApiSpec);

  for (const [method, path, fieldName] of RECORD_VALUE_RESPONSE_TARGETS) {
    loosenResponseValueMap(openApiSpec, method, path, fieldName);
  }

  assertCurrencyConfigFieldsAreNullable(openApiSpec);
};

export { patchAttioOpenApiSpec };
