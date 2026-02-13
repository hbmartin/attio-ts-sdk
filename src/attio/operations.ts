import type { ZodType } from "zod";
import {
  type AttioClient,
  type AttioClientInput,
  resolveAttioClient,
} from "./client";
import {
  type AttioRecordLike,
  normalizeRecord,
  normalizeRecords,
} from "./record-utils";
import {
  assertOk,
  type UnwrapItemsOptions,
  type UnwrapOptions,
  unwrapData,
  unwrapItems,
  validateItemsArray,
  validateWithSchema,
} from "./response";
import { rawRecordSchema } from "./schemas";

/**
 * Resolve client, execute API call, and unwrap a single data response.
 * Centralizes the resolveClient -> apiCall -> unwrapData pipeline
 * used by tasks, objects, notes, and list entry operations.
 */
async function callAndUnwrapData<T>(
  input: AttioClientInput,
  apiCall: (client: AttioClient) => Promise<unknown>,
  options?: UnwrapOptions<T>,
): Promise<T> {
  const client = resolveAttioClient(input);
  const result = await apiCall(client);
  return unwrapData<T>(result, options);
}

/**
 * Resolve client, execute API call, and unwrap a list of items.
 * Centralizes the resolveClient -> apiCall -> unwrapItems pipeline
 * used by list, task, note, and workspace member operations.
 */
async function callAndUnwrapItems<T>(
  input: AttioClientInput,
  apiCall: (client: AttioClient) => Promise<unknown>,
  options?: UnwrapItemsOptions<T>,
): Promise<T[]> {
  const client = resolveAttioClient(input);
  const result = await apiCall(client);
  return unwrapItems<T>(result, options);
}

/**
 * Resolve client, execute API call, assert success, normalize a single record,
 * and validate with schema. Centralizes the
 * resolveClient -> apiCall -> assertOk -> normalizeRecord -> validateWithSchema
 * pipeline used by single-record CRUD operations.
 */
async function callAndUnwrapRecord<T extends AttioRecordLike>(
  input: AttioClientInput & { itemSchema?: ZodType<T> },
  apiCall: (client: AttioClient) => Promise<unknown>,
): Promise<T | AttioRecordLike> {
  const client = resolveAttioClient(input);
  const schema = input.itemSchema ?? rawRecordSchema;
  const result = await apiCall(client);
  const data = assertOk(result) as Record<string, unknown>;
  const normalized = normalizeRecord(data);
  return validateWithSchema(normalized, schema);
}

/**
 * Unwrap items from a response, normalize as records, and validate.
 * Used inside pagination fetch callbacks where client is already resolved.
 */
function unwrapAndNormalizeRecords<T>(
  result: unknown,
  schema: ZodType<T>,
): T[] {
  const items = unwrapItems(result) as Record<string, unknown>[];
  const normalized = normalizeRecords(items);
  return validateItemsArray(normalized, schema);
}

/**
 * Resolve client, execute a delete API call, and return true.
 * Centralizes the resolveClient -> apiCall -> return true pipeline
 * used by delete operations.
 */
async function callAndDelete(
  input: AttioClientInput,
  apiCall: (client: AttioClient) => Promise<unknown>,
): Promise<true> {
  const client = resolveAttioClient(input);
  await apiCall(client);
  return true;
}

export {
  callAndDelete,
  callAndUnwrapData,
  callAndUnwrapItems,
  callAndUnwrapRecord,
  unwrapAndNormalizeRecords,
};
