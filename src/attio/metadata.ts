import type { ZodType } from "zod";
import { z } from "zod";
import type { Attribute, Options, SelectOption, Status } from "../generated";
import {
  getV2ByTargetByIdentifierAttributes,
  getV2ByTargetByIdentifierAttributesByAttribute,
  getV2ByTargetByIdentifierAttributesByAttributeOptions,
  getV2ByTargetByIdentifierAttributesByAttributeStatuses,
} from "../generated";
import { zAttribute, zSelectOption, zStatus } from "../generated/zod.gen";
import type { CacheAdapter, MetadataCacheScope } from "./cache";
import {
  type AttioClient,
  type AttioClientInput,
  resolveAttioClient,
} from "./client";
import { updateKnownFieldValues } from "./error-enhancer";
import { createSchemaError, unwrapData, unwrapItems } from "./response";

const getMetadataCache = (
  client: AttioClient,
  scope: MetadataCacheScope,
): CacheAdapter<string, unknown[]> | undefined =>
  client.cache.metadata.get(scope);

const buildKey = (target: string, identifier: string, attribute?: string) =>
  [target, identifier, attribute].filter(Boolean).join(":");

const titleSchema = z.object({ title: z.string() }).passthrough();

const extractTitles = (items: unknown[]): string[] =>
  items.reduce<string[]>((titles, item) => {
    const parsed = titleSchema.safeParse(item);
    if (parsed.success) {
      titles.push(parsed.data.title);
    }
    return titles;
  }, []);

interface AttributeListInput extends AttioClientInput {
  target: string;
  identifier: string;
  options?: Omit<Options, "client" | "path">;
}

interface AttributeInput extends AttributeListInput {
  attribute: string;
}

interface AttributeMetadataPath {
  target: string;
  identifier: string;
  attribute: string;
}

interface AttributeMetadataFetchParams
  extends Omit<Options, "client" | "path"> {
  client: AttioClient;
  path: AttributeMetadataPath;
}

interface AttributeMetadataRequestParams<T> {
  input: AttributeInput;
  cache?: CacheAdapter<string, unknown[]>;
  fetcher: (params: AttributeMetadataFetchParams) => Promise<unknown>;
  itemSchema: ZodType<T>;
}

const buildAttributeMetadataPath = (
  input: AttributeInput,
): AttributeMetadataPath => ({
  target: input.target,
  identifier: input.identifier,
  attribute: input.attribute,
});

const listAttributeMetadata = async <T>({
  input,
  cache,
  fetcher,
  itemSchema,
}: AttributeMetadataRequestParams<T>): Promise<T[]> => {
  const cacheKey = buildKey(input.target, input.identifier, input.attribute);
  const arraySchema = z.array(itemSchema);

  if (cache) {
    const cached = cache.get(cacheKey);
    if (cached) {
      const parsed = arraySchema.safeParse(cached);
      if (parsed.success) {
        return parsed.data;
      }
      // Delete invalid cache entry to force refetch from API
      cache.delete(cacheKey);
    }
  }

  const client = resolveAttioClient(input);
  const result = await fetcher({
    client,
    path: buildAttributeMetadataPath(input),
    ...input.options,
  });

  const items = unwrapItems(result, { schema: itemSchema });
  const titles = extractTitles(items);

  updateKnownFieldValues(input.attribute, titles);
  cache?.set(cacheKey, items);
  return items;
};

const listAttributes = async (
  input: AttributeListInput,
): Promise<Attribute[]> => {
  const client = resolveAttioClient(input);
  const cache = getMetadataCache(client, "attributes");
  const cacheKey = buildKey(input.target, input.identifier);
  const arraySchema = z.array(zAttribute);

  if (cache) {
    const cached = cache.get(cacheKey);
    if (cached) {
      const parsed = arraySchema.safeParse(cached);
      if (!parsed.success) {
        throw createSchemaError(parsed.error);
      }
      return parsed.data;
    }
  }
  const result = await getV2ByTargetByIdentifierAttributes({
    client,
    path: { target: input.target, identifier: input.identifier },
    ...input.options,
  });
  const items = unwrapItems(result, { schema: zAttribute });
  cache?.set(cacheKey, items);
  return items;
};

const getAttribute = async (input: AttributeInput): Promise<Attribute> => {
  const client = resolveAttioClient(input);
  const result = await getV2ByTargetByIdentifierAttributesByAttribute({
    client,
    path: {
      target: input.target,
      identifier: input.identifier,
      attribute: input.attribute,
    },
    ...input.options,
  });
  return unwrapData(result, { schema: zAttribute });
};

const getAttributeOptions = (
  input: AttributeInput,
): Promise<SelectOption[]> => {
  const client = resolveAttioClient(input);
  return listAttributeMetadata({
    input: { ...input, client },
    cache: getMetadataCache(client, "options"),
    fetcher: getV2ByTargetByIdentifierAttributesByAttributeOptions,
    itemSchema: zSelectOption,
  });
};

const getAttributeStatuses = (input: AttributeInput): Promise<Status[]> => {
  const client = resolveAttioClient(input);
  return listAttributeMetadata({
    input: { ...input, client },
    cache: getMetadataCache(client, "statuses"),
    fetcher: getV2ByTargetByIdentifierAttributesByAttributeStatuses,
    itemSchema: zStatus,
  });
};

export type {
  AttributeListInput,
  AttributeInput,
  AttributeMetadataRequestParams,
};
export {
  listAttributes,
  getAttribute,
  getAttributeOptions,
  getAttributeStatuses,
  listAttributeMetadata,
  buildAttributeMetadataPath,
  buildKey,
  extractTitles,
};
