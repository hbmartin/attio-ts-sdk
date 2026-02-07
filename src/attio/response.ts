import type { ZodType } from "zod";
import { z } from "zod";
import type { AttioError } from "./errors";
import { AttioResponseError, normalizeAttioError } from "./errors";

interface UnwrapOptions<T = unknown> {
  maxDepth?: number;
  schema?: ZodType<T>;
}

interface ResponseEnvelope {
  data?: unknown;
  error?: unknown;
  request?: Request;
  response?: Response;
}

interface AttioResult<T> {
  ok: boolean;
  value?: T;
  error?: AttioError;
  request?: Request;
  response?: Response;
}

interface ResultOptions<T> extends UnwrapOptions {
  schema?: ZodType<T>;
}

const DEFAULT_UNWRAP_DEPTH = 3;

const responseEnvelopeSchema: z.ZodType<ResponseEnvelope> = z
  .object({
    data: z.unknown().optional(),
    error: z.unknown().optional(),
    request: z.instanceof(Request).optional(),
    response: z.instanceof(Response).optional(),
  })
  .passthrough();

function unwrapData<T>(
  result: unknown,
  options: UnwrapOptions<T> & { schema: ZodType<T> },
): T;
function unwrapData<T>(result: unknown, options?: UnwrapOptions<T>): T;
function unwrapData<T>(result: unknown, options: UnwrapOptions<T> = {}): T {
  const maxDepth = options.maxDepth ?? DEFAULT_UNWRAP_DEPTH;
  let current: unknown = result;

  for (let depth = 0; depth < maxDepth; depth += 1) {
    if (!current || typeof current !== "object") {
      break;
    }
    if (!("data" in current)) {
      break;
    }
    current = (current as { data: unknown }).data;
  }

  if (options.schema) {
    const parsed = options.schema.safeParse(current);
    if (!parsed.success) {
      throw createSchemaError(parsed.error);
    }
    return parsed.data;
  }

  return current as T;
}

interface UnwrapItemsOptions<T = unknown> {
  schema?: ZodType<T>;
}

/**
 * Searches nested data structures for an array, checking `data`, `items`,
 * and `records` keys at each level up to DEFAULT_UNWRAP_DEPTH.
 */
const findArrayInData = (initialData: unknown): unknown[] | undefined => {
  let data: unknown = initialData;

  for (let depth = 0; depth < DEFAULT_UNWRAP_DEPTH; depth += 1) {
    if (Array.isArray(data)) {
      return data;
    }
    if (!data || typeof data !== "object") {
      return;
    }
    const record = data as Record<string, unknown>;
    const nested = record.data ?? record.items ?? record.records;
    if (nested === undefined) {
      return;
    }
    data = nested;
  }
  return;
};

const validateItemsArray = <T>(items: unknown[], schema: ZodType<T>): T[] => {
  const arraySchema = z.array(schema);
  const parsed = arraySchema.safeParse(items);
  if (!parsed.success) {
    throw createSchemaError(parsed.error);
  }
  return parsed.data;
};

const validateWithSchema = <T>(data: unknown, schema: ZodType<T>): T => {
  const parsed = schema.safeParse(data);
  if (!parsed.success) {
    throw createSchemaError(parsed.error);
  }
  return parsed.data;
};

function unwrapItems<T>(
  result: unknown,
  options: UnwrapItemsOptions<T> & { schema: ZodType<T> },
): T[];
function unwrapItems<T>(result: unknown, options?: UnwrapItemsOptions<T>): T[];
function unwrapItems<T>(
  result: unknown,
  options: UnwrapItemsOptions<T> = {},
): T[] {
  const data = unwrapData<unknown>(result);
  const items = findArrayInData(data);

  if (!items) {
    return [];
  }

  if (options.schema) {
    return validateItemsArray(items, options.schema);
  }

  return items as T[];
}

const readPaginationCursor = (pagination: unknown): string | null => {
  if (!pagination || typeof pagination !== "object") {
    return null;
  }
  const cursor =
    (pagination as Record<string, unknown>).next_cursor ??
    (pagination as Record<string, unknown>).nextCursor;
  return typeof cursor === "string" ? cursor : null;
};

const unwrapPaginationCursor = (result: unknown): string | null => {
  if (result && typeof result === "object") {
    const rootCursor = readPaginationCursor(
      (result as Record<string, unknown>).pagination,
    );
    if (rootCursor) {
      return rootCursor;
    }
  }
  const data = unwrapData<unknown>(result);
  if (!data || typeof data !== "object") {
    return null;
  }
  return readPaginationCursor((data as Record<string, unknown>).pagination);
};

const readPaginationOffset = (pagination: unknown): number | null => {
  if (!pagination || typeof pagination !== "object") {
    return null;
  }
  const record = pagination as Record<string, unknown>;
  const nextOffset = record.next_offset ?? record.nextOffset;
  return typeof nextOffset === "number" ? nextOffset : null;
};

const unwrapPaginationOffset = (result: unknown): number | null => {
  if (result && typeof result === "object") {
    const rootOffset = readPaginationOffset(
      (result as Record<string, unknown>).pagination,
    );
    if (rootOffset !== null) {
      return rootOffset;
    }
  }
  const data = unwrapData<unknown>(result);
  if (!data || typeof data !== "object") {
    return null;
  }
  return readPaginationOffset((data as Record<string, unknown>).pagination);
};

const parseResponseEnvelope = (
  result: unknown,
): ResponseEnvelope | undefined => {
  const parsed = responseEnvelopeSchema.safeParse(result);
  if (!parsed.success) {
    return;
  }
  return parsed.data;
};

const createSchemaError = (details?: unknown): AttioResponseError =>
  new AttioResponseError("Invalid API response: schema mismatch", {
    code: "INVALID_RESPONSE",
    data: details,
  });

function assertOk<T>(
  result: unknown,
  options: ResultOptions<T> & { schema: ZodType<T> },
): T;
function assertOk(result: unknown, options?: ResultOptions<unknown>): unknown;
function assertOk<T>(result: unknown, options?: ResultOptions<T>): unknown {
  const envelope = parseResponseEnvelope(result);
  if (envelope?.error !== undefined) {
    throw normalizeAttioError(envelope.error, {
      response: envelope.response,
      request: envelope.request,
    });
  }

  const unwrapped = unwrapData(envelope?.data ?? result, {
    maxDepth: options?.maxDepth,
  });
  if (!options?.schema) {
    return unwrapped;
  }

  const parsed = options.schema.safeParse(unwrapped);
  if (!parsed.success) {
    throw createSchemaError(parsed.error);
  }
  return parsed.data;
}

function toResult<T>(
  result: unknown,
  options: ResultOptions<T> & { schema: ZodType<T> },
): AttioResult<T>;
function toResult(
  result: unknown,
  options?: ResultOptions<unknown>,
): AttioResult<unknown>;
function toResult<T>(
  result: unknown,
  options?: ResultOptions<T>,
): AttioResult<T> | AttioResult<unknown> {
  const envelope = parseResponseEnvelope(result);
  if (envelope?.error !== undefined) {
    const normalized = normalizeAttioError(envelope.error, {
      response: envelope.response,
      request: envelope.request,
    });
    return {
      ok: false,
      error: normalized,
      request: envelope.request,
      response: envelope.response,
    };
  }

  const unwrapped = unwrapData(envelope?.data ?? result, {
    maxDepth: options?.maxDepth,
  });
  if (!options?.schema) {
    return {
      ok: true,
      value: unwrapped,
      request: envelope?.request,
      response: envelope?.response,
    };
  }

  const parsed = options.schema.safeParse(unwrapped);
  if (!parsed.success) {
    return {
      ok: false,
      error: createSchemaError(parsed.error),
      request: envelope?.request,
      response: envelope?.response,
    };
  }

  return {
    ok: true,
    value: parsed.data,
    request: envelope?.request,
    response: envelope?.response,
  };
}

export {
  assertOk,
  createSchemaError,
  toResult,
  unwrapData,
  unwrapItems,
  unwrapPaginationCursor,
  unwrapPaginationOffset,
  validateItemsArray,
  validateWithSchema,
};
export type { AttioResult, ResultOptions, UnwrapItemsOptions, UnwrapOptions };
