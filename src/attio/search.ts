import type { Options } from "../generated";
import { postV2ObjectsRecordsSearch } from "../generated";
import { type AttioClientInput, resolveAttioClient } from "./client";
import { type AttioRecordLike, normalizeRecords } from "./record-utils";
import { unwrapItems } from "./response";

export interface RecordSearchInput extends AttioClientInput {
  query: string;
  objects: string[];
  requestAs?:
    | { type: "workspace" }
    | { type: "workspace-member"; workspace_member_id: string }
    | { type: "workspace-member"; email_address: string };
  limit?: number;
  options?: Omit<Options, "client" | "body">;
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

  const items = unwrapItems<unknown>(result);
  return normalizeRecords<T>(items as Record<string, unknown>[]);
};
