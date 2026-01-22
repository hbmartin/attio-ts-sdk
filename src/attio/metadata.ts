import { z } from "zod";
import type { Options } from "../generated";
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

export interface AttributeListInput extends AttioClientInput {
  target: string;
  identifier: string;
  options?: Omit<Options, "client" | "path">;
}

export interface AttributeInput extends AttributeListInput {
  attribute: string;
}

namespace AttributeMetadata {
  export interface Path {
    target: string;
    identifier: string;
    attribute: string;
  }

  export interface FetchParams extends Omit<Options, "client" | "path"> {
    client: AttioClient;
    path: Path;
  }

  export interface RequestParams {
    input: AttributeInput;
    cache: TtlCache<string, unknown[]>;
    fetcher: (params: FetchParams) => Promise<unknown>;
  }

  export const buildPath = (input: AttributeInput): Path => ({
    target: input.target,
    identifier: input.identifier,
    attribute: input.attribute,
  });

  export const list = async ({
    input,
    cache,
    fetcher,
  }: RequestParams): Promise<unknown[]> => {
    const cacheKey = buildKey(input.target, input.identifier, input.attribute);
    const cached = cache.get(cacheKey);
    if (cached) return cached;

    const client = resolveAttioClient(input);
    const result = await fetcher({
      client,
      path: buildPath(input),
      ...input.options,
    });

    const items = unwrapItems(result);
    const titles = extractTitles(items);

    updateKnownFieldValues(input.attribute, titles);
    cache.set(cacheKey, items);
    return items;
  };
}

export const listAttributes = async (input: AttributeListInput) => {
  const cacheKey = buildKey(input.target, input.identifier);
  const cached = attributesCache.get(cacheKey);
  if (cached) return cached;

  const client = resolveAttioClient(input);
  const result = await getV2ByTargetByIdentifierAttributes({
    client,
    path: { target: input.target, identifier: input.identifier },
    ...input.options,
  });
  const items = unwrapItems(result);
  attributesCache.set(cacheKey, items);
  return items;
};

export const getAttribute = async (input: AttributeInput) => {
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
  return unwrapData(result);
};

export const getAttributeOptions = async (input: AttributeInput) => {
  return AttributeMetadata.list({
    input,
    cache: optionsCache,
    fetcher: getV2ByTargetByIdentifierAttributesByAttributeOptions,
  });
};

export const getAttributeStatuses = async (input: AttributeInput) => {
  return AttributeMetadata.list({
    input,
    cache: statusesCache,
    fetcher: getV2ByTargetByIdentifierAttributesByAttributeStatuses,
  });
};
