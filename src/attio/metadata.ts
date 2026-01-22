import { z } from "zod";
import type { Attribute, Options, SelectOption, Status } from "../generated";
import {
  getV2ByTargetByIdentifierAttributes,
  getV2ByTargetByIdentifierAttributesByAttribute,
  getV2ByTargetByIdentifierAttributesByAttributeOptions,
  getV2ByTargetByIdentifierAttributesByAttributeStatuses,
} from "../generated";
import { createTtlCache, type TtlCache } from "./cache";
import {
  type AttioClient,
  type AttioClientInput,
  resolveAttioClient,
} from "./client";
import { updateKnownFieldValues } from "./error-enhancer";
import { unwrapData, unwrapItems } from "./response";

const DEFAULT_TTL_MS = 5 * 60 * 1000;

const attributesCache = createTtlCache<string, unknown[]>({
  ttlMs: DEFAULT_TTL_MS,
  maxEntries: 200,
});

const optionsCache = createTtlCache<string, unknown[]>({
  ttlMs: DEFAULT_TTL_MS,
  maxEntries: 500,
});

const statusesCache = createTtlCache<string, unknown[]>({
  ttlMs: DEFAULT_TTL_MS,
  maxEntries: 500,
});

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

interface AttributeMetadataRequestParams {
  input: AttributeInput;
  cache: TtlCache<string, unknown[]>;
  fetcher: (params: AttributeMetadataFetchParams) => Promise<unknown>;
}

const buildAttributeMetadataPath = (
  input: AttributeInput,
): AttributeMetadataPath => ({
  target: input.target,
  identifier: input.identifier,
  attribute: input.attribute,
});

const listAttributeMetadata = async ({
  input,
  cache,
  fetcher,
}: AttributeMetadataRequestParams): Promise<unknown[]> => {
  const cacheKey = buildKey(input.target, input.identifier, input.attribute);
  const cached = cache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const client = resolveAttioClient(input);
  const result = await fetcher({
    client,
    path: buildAttributeMetadataPath(input),
    ...input.options,
  });

  const items = unwrapItems(result);
  const titles = extractTitles(items);

  updateKnownFieldValues(input.attribute, titles);
  cache.set(cacheKey, items);
  return items;
};

const listAttributes = async (
  input: AttributeListInput,
): Promise<Attribute[]> => {
  const cacheKey = buildKey(input.target, input.identifier);
  const cached = attributesCache.get(cacheKey);
  if (cached) {
    return cached as Attribute[];
  }

  const client = resolveAttioClient(input);
  const result = await getV2ByTargetByIdentifierAttributes({
    client,
    path: { target: input.target, identifier: input.identifier },
    ...input.options,
  });
  const items = unwrapItems(result) as Attribute[];
  attributesCache.set(cacheKey, items);
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
  return unwrapData(result) as Attribute;
};

const getAttributeOptions = async (
  input: AttributeInput,
): Promise<SelectOption[]> =>
  listAttributeMetadata({
    input,
    cache: optionsCache,
    fetcher: getV2ByTargetByIdentifierAttributesByAttributeOptions,
  }) as Promise<SelectOption[]>;

const getAttributeStatuses = async (input: AttributeInput): Promise<Status[]> =>
  listAttributeMetadata({
    input,
    cache: statusesCache,
    fetcher: getV2ByTargetByIdentifierAttributesByAttributeStatuses,
  }) as Promise<Status[]>;

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
