import {
  getV2ByTargetByIdentifierAttributes,
  getV2ByTargetByIdentifierAttributesByAttribute,
  getV2ByTargetByIdentifierAttributesByAttributeOptions,
  getV2ByTargetByIdentifierAttributesByAttributeStatuses,
} from '../generated';
import type { Options } from '../generated';
import { createTtlCache } from './cache';
import { resolveAttioClient, type AttioClientInput } from './client';
import { updateKnownFieldValues } from './error-enhancer';
import { unwrapData, unwrapItems } from './response';

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
  [target, identifier, attribute].filter(Boolean).join(':');

export interface AttributeListInput extends AttioClientInput {
  target: string;
  identifier: string;
  options?: Omit<Options, 'client' | 'path'>;
}

export interface AttributeInput extends AttributeListInput {
  attribute: string;
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
  const cacheKey = buildKey(input.target, input.identifier, input.attribute);
  const cached = optionsCache.get(cacheKey);
  if (cached) return cached;

  const client = resolveAttioClient(input);
  const result = await getV2ByTargetByIdentifierAttributesByAttributeOptions({
    client,
    path: {
      target: input.target,
      identifier: input.identifier,
      attribute: input.attribute,
    },
    ...input.options,
  });

  const items = unwrapItems(result);
  const titles = items
    .map((item) =>
      typeof (item as { title?: unknown }).title === 'string'
        ? ((item as { title?: string }).title as string)
        : undefined,
    )
    .filter(Boolean) as string[];

  updateKnownFieldValues(input.attribute, titles);
  optionsCache.set(cacheKey, items);
  return items;
};

export const getAttributeStatuses = async (input: AttributeInput) => {
  const cacheKey = buildKey(input.target, input.identifier, input.attribute);
  const cached = statusesCache.get(cacheKey);
  if (cached) return cached;

  const client = resolveAttioClient(input);
  const result = await getV2ByTargetByIdentifierAttributesByAttributeStatuses({
    client,
    path: {
      target: input.target,
      identifier: input.identifier,
      attribute: input.attribute,
    },
    ...input.options,
  });

  const items = unwrapItems(result);
  const titles = items
    .map((item) =>
      typeof (item as { title?: unknown }).title === 'string'
        ? ((item as { title?: string }).title as string)
        : undefined,
    )
    .filter(Boolean) as string[];

  updateKnownFieldValues(input.attribute, titles);
  statusesCache.set(cacheKey, items);
  return items;
};
