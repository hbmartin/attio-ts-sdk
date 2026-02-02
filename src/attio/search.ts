import type { Options, PostV2ObjectsRecordsSearchData } from "../generated";
import { postV2ObjectsRecordsSearch } from "../generated";
import { type AttioClientInput, resolveAttioClient } from "./client";
import { type AttioRecordLike, normalizeRecords } from "./record-utils";
import { unwrapItems } from "./response";
import { rawRecordSchema } from "./schemas";

export interface RecordSearchInput extends AttioClientInput {
  query: PostV2ObjectsRecordsSearchData["body"]["query"];
  objects: PostV2ObjectsRecordsSearchData["body"]["objects"];
  requestAs?: PostV2ObjectsRecordsSearchData["body"]["request_as"];
  limit?: PostV2ObjectsRecordsSearchData["body"]["limit"];
  options?: Omit<Options<PostV2ObjectsRecordsSearchData>, "client" | "body">;
}

export const searchRecords = async <T extends AttioRecordLike>(
  input: RecordSearchInput,
): Promise<T[]> => {
  const client = resolveAttioClient(input);
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

  const items = unwrapItems(result, { schema: rawRecordSchema });
  return normalizeRecords<T>(items);
};
