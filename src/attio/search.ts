import type { ZodType } from "zod";
import type { Options, PostV2ObjectsRecordsSearchData } from "../generated";
import { postV2ObjectsRecordsSearch } from "../generated";
import { type AttioClientInput, resolveAttioClient } from "./client";
import { type AttioRecordLike, normalizeRecords } from "./record-utils";
import { unwrapItems } from "./response";
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

export interface RecordSearchInput extends AttioClientInput {
  query: PostV2ObjectsRecordsSearchData["body"]["query"];
  objects: PostV2ObjectsRecordsSearchData["body"]["objects"];
  requestAs?: PostV2ObjectsRecordsSearchData["body"]["request_as"];
  limit?: PostV2ObjectsRecordsSearchData["body"]["limit"];
  itemSchema?: ZodType<AttioRecordLike>;
  options?: Omit<Options<PostV2ObjectsRecordsSearchData>, "client" | "body">;
}

export const searchRecords = async <TInput extends RecordSearchInput>(
  input: TInput,
): Promise<InferSearchResultType<TInput>[]> => {
  type T = InferSearchResultType<TInput>;
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

  const items = unwrapItems(result, { schema });
  return normalizeRecords(items) as T[];
};

export type { InferSearchResultType };
