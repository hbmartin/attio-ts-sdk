import { z } from "zod";
import type { AttioClientInput } from "./client";
import { AttioResponseError } from "./errors";
import {
  type AttributeIdentifier,
  type AttributeTarget,
  type ListAllowedValuesInput,
  listAllowedValues,
  type NormalizedAllowedValue,
  type ZodAttribute,
} from "./metadata";
import {
  defaultSchemaWriteOptions,
  serializeAttributeEntry,
} from "./write-value-serializer";
import type {
  AttioWriteValuesBuilder,
  SchemaWriteFieldValue,
  SchemaWriteOptions,
  SchemaWriteValue,
  SchemaWriteValues,
} from "./write-value-types";

interface CreateWriteValuesBuilderInput extends AttioClientInput {
  target: AttributeTarget;
  identifier: AttributeIdentifier;
  attributes: readonly ZodAttribute[];
  options?: ListAllowedValuesInput["options"];
  allowedValueResolver?: (
    input: ListAllowedValuesInput,
  ) => Promise<NormalizedAllowedValue[]>;
}

interface AttributeLookup {
  bySlug: Map<string, ZodAttribute>;
  byTitle: Map<string, ZodAttribute>;
  ambiguousTitles: Set<string>;
}

type AllowedValueResolver = (
  input: ListAllowedValuesInput,
) => Promise<NormalizedAllowedValue[]>;

type AllowedValueGetterInput = Omit<
  CreateWriteValuesBuilderInput,
  "allowedValueResolver" | "attributes"
> & {
  allowedValueResolver: AllowedValueResolver;
};

const createAttributeLookup = (
  attributes: readonly ZodAttribute[],
): AttributeLookup => {
  const bySlug = new Map<string, ZodAttribute>();
  const byTitle = new Map<string, ZodAttribute>();
  const ambiguousTitles = new Set<string>();

  for (const attribute of attributes) {
    bySlug.set(attribute.api_slug, attribute);

    if (byTitle.has(attribute.title)) {
      ambiguousTitles.add(attribute.title);
      byTitle.delete(attribute.title);
    } else if (!ambiguousTitles.has(attribute.title)) {
      byTitle.set(attribute.title, attribute);
    }
  }

  return { bySlug, byTitle, ambiguousTitles };
};

const resolveAttribute = (
  lookup: AttributeLookup,
  key: string,
): ZodAttribute => {
  const slugAttribute = lookup.bySlug.get(key);
  if (slugAttribute) {
    return slugAttribute;
  }

  if (lookup.ambiguousTitles.has(key)) {
    throw new AttioResponseError(`Ambiguous attribute title "${key}".`, {
      code: "AMBIGUOUS_ATTRIBUTE_TITLE",
      data: { title: key },
    });
  }

  const titleAttribute = lookup.byTitle.get(key);
  if (titleAttribute) {
    return titleAttribute;
  }

  throw new AttioResponseError(`Unknown attribute "${key}".`, {
    code: "UNKNOWN_ATTRIBUTE",
    data: { attribute: key },
  });
};

const assertWritableAttribute = (attribute: ZodAttribute): void => {
  if (!attribute.is_writable) {
    throw new AttioResponseError(
      `Attribute "${attribute.api_slug}" is not writable.`,
      {
        code: "NON_WRITABLE_ATTRIBUTE",
        data: { attribute: attribute.api_slug },
      },
    );
  }
};

const normalizeWriteFieldValue = (
  valueInput: SchemaWriteFieldValue,
): SchemaWriteValue[] | null | undefined => {
  if (valueInput === undefined) {
    return;
  }

  if (valueInput === null) {
    return null;
  }

  return Array.isArray(valueInput) ? valueInput : [valueInput];
};

const createAllowedValueGetter = ({
  client,
  config,
  target,
  identifier,
  options,
  allowedValueResolver,
}: AllowedValueGetterInput) => {
  const allowedValueCache = new Map<
    string,
    Promise<NormalizedAllowedValue[]>
  >();

  return (attribute: ZodAttribute) => {
    const cacheKey = attribute.api_slug;
    const cached = allowedValueCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const promise = allowedValueResolver({
      client,
      config,
      target,
      identifier,
      attribute: attribute.api_slug,
      type: attribute.type === "status" ? "status" : "select",
      options,
    });
    allowedValueCache.set(cacheKey, promise);
    return promise;
  };
};

const serializeEntries = async ({
  attribute,
  entries,
  options,
  getAllowedValues,
}: {
  attribute: ZodAttribute;
  entries: SchemaWriteValue[];
  options: Required<SchemaWriteOptions>;
  getAllowedValues: (
    attribute: ZodAttribute,
  ) => Promise<NormalizedAllowedValue[]>;
}): Promise<unknown[]> => {
  const serializedEntries: unknown[] = [];

  for (const entry of entries) {
    if (entry !== undefined && entry !== null) {
      try {
        serializedEntries.push(
          ...(await serializeAttributeEntry({
            attribute,
            entry,
            options,
            getAllowedValues,
          })),
        );
      } catch (error) {
        if (error instanceof z.ZodError) {
          throw new AttioResponseError(
            `Invalid write value for "${attribute.api_slug}".`,
            {
              code: "INVALID_WRITE_VALUE",
              data: error,
            },
          );
        }
        throw error;
      }
    }
  }

  return serializedEntries;
};

const buildFieldValues = async ({
  lookup,
  key,
  fieldValue,
  options,
  getAllowedValues,
}: {
  lookup: AttributeLookup;
  key: string;
  fieldValue: SchemaWriteFieldValue;
  options: Required<SchemaWriteOptions>;
  getAllowedValues: (
    attribute: ZodAttribute,
  ) => Promise<NormalizedAllowedValue[]>;
}): Promise<{ slug: string; values: unknown[] } | undefined> => {
  const attribute = resolveAttribute(lookup, key);
  assertWritableAttribute(attribute);

  const entries = normalizeWriteFieldValue(fieldValue);
  if (entries === undefined) {
    return;
  }

  if (entries === null) {
    return { slug: attribute.api_slug, values: [] };
  }

  const values = await serializeEntries({
    attribute,
    entries,
    options,
    getAllowedValues,
  });
  return { slug: attribute.api_slug, values };
};

const createWriteValuesBuilder = ({
  target,
  identifier,
  attributes,
  client,
  config,
  options,
  allowedValueResolver = listAllowedValues,
}: CreateWriteValuesBuilderInput): AttioWriteValuesBuilder => {
  const lookup = createAttributeLookup(attributes);
  const getAllowedValues = createAllowedValueGetter({
    client,
    config,
    target,
    identifier,
    options,
    allowedValueResolver,
  });

  const buildValues: AttioWriteValuesBuilder["buildValues"] = async (
    input,
    writeOptions,
  ) => {
    const resolvedOptions = {
      ...defaultSchemaWriteOptions,
      ...writeOptions,
    };
    const values: SchemaWriteValues = {};

    for (const [key, fieldValue] of Object.entries(input)) {
      const result = await buildFieldValues({
        lookup,
        key,
        fieldValue,
        options: resolvedOptions,
        getAllowedValues,
      });
      if (result) {
        values[result.slug] = result.values;
      }
    }

    return values;
  };

  return { buildValues };
};

export type {
  AttioWriteValuesBuilder,
  SchemaWriteFieldValue,
  SchemaWriteInput,
  SchemaWriteOptions,
  SchemaWriteValue,
  SchemaWriteValues,
} from "./write-value-types";
export type { CreateWriteValuesBuilderInput };
export { createWriteValuesBuilder };
