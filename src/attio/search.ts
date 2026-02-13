import type { ZodType } from "zod";
import type { Options, PostV2ObjectsRecordsSearchData } from "../generated";
import { postV2ObjectsRecordsSearch } from "../generated";
import { type AttioClientInput, resolveAttioClient } from "./client";
import { unwrapAndNormalizeRecords } from "./operations";
import type { AttioRecordLike } from "./record-utils";
import { rawRecordSchema } from "./schemas";

/**
 * Infers the record type from an input object.
 * If `itemSchema` is provided, the type is inferred from the schema.
 * Otherwise, returns `AttioRecordLike`.
 */
type InferSearchResultType<TInput> = TInput extends {
  itemSchema: ZodType<infer T>;
}
  ? T
  : AttioRecordLike;

export interface RecordSearchInput<T extends AttioRecordLike = AttioRecordLike>
  extends AttioClientInput {
  query: PostV2ObjectsRecordsSearchData["body"]["query"];
  objects: PostV2ObjectsRecordsSearchData["body"]["objects"];
  requestAs?: PostV2ObjectsRecordsSearchData["body"]["request_as"];
  limit?: PostV2ObjectsRecordsSearchData["body"]["limit"];
  itemSchema?: ZodType<T>;
  options?: Omit<Options<PostV2ObjectsRecordsSearchData>, "client" | "body">;
}

// Overload: With itemSchema - T is inferred from schema
export async function searchRecords<T extends AttioRecordLike>(
  input: RecordSearchInput<T> & { itemSchema: ZodType<T> },
): Promise<T[]>;
// Overload: Without itemSchema - returns AttioRecordLike
export async function searchRecords(
  input: RecordSearchInput,
): Promise<AttioRecordLike[]>;
// Implementation
export async function searchRecords<T extends AttioRecordLike>(
  input: RecordSearchInput<T>,
): Promise<T[]> {
  const client = resolveAttioClient(input);
  const schema = input.itemSchema ?? rawRecordSchema;
  const result = await postV2ObjectsRecordsSearch({
    client,
    body: {
      query: input.query,
      objects: input.objects,
      request_as: input.requestAs ?? { type: "workspace" },
      limit: input.limit,
    },
    ...input.options,
  });

  return unwrapAndNormalizeRecords(result, schema) as T[];
}

export type { InferSearchResultType };
