import type { ZodType } from "zod";
import type { Attribute, Options } from "../generated";
import type { AttioClientInput } from "./client";
import { AttioResponseError } from "./errors";
import { listAttributes } from "./metadata";
import type { AttioRecordLike } from "./record-utils";
import type { ValueLookupOptions } from "./values";
import { getFirstValue, getValue } from "./values";

interface SchemaInput extends AttioClientInput {
  target: string;
  identifier: string;
  options?: Omit<Options, "client" | "path">;
}

interface AttributeAccessor {
  attribute: Attribute;
  getValue: (record: AttioRecordLike) => unknown[] | undefined;
  getFirstValue: (record: AttioRecordLike) => unknown | undefined;
  getValueAs: <T>(
    record: AttioRecordLike,
    options: ValueLookupOptions<T> & { schema: ZodType<T> },
  ) => T[] | undefined;
  getFirstValueAs: <T>(
    record: AttioRecordLike,
    options: ValueLookupOptions<T> & { schema: ZodType<T> },
  ) => T | undefined;
}

interface AttioSchema {
  target: string;
  identifier: string;
  attributes: Attribute[];
  attributeSlugs: string[];
  getAttribute: (slug: string) => Attribute | undefined;
  getAttributeOrThrow: (slug: string) => Attribute;
  getAccessor: (slug: string) => AttributeAccessor | undefined;
  getAccessorOrThrow: (slug: string) => AttributeAccessor;
}

const createAccessor = (attribute: Attribute): AttributeAccessor => ({
  attribute,
  getValue: (record) => getValue(record, attribute.api_slug),
  getFirstValue: (record) => getFirstValue(record, attribute.api_slug),
  getValueAs: (record, options) =>
    getValue(record, attribute.api_slug, options),
  getFirstValueAs: (record, options) =>
    getFirstValue(record, attribute.api_slug, options),
});

const createSchema = async (input: SchemaInput): Promise<AttioSchema> => {
  const attributes = await listAttributes({
    ...input,
    options: input.options,
  });
  const attributeMap = new Map<string, Attribute>();
  const attributeSlugs: string[] = [];

  for (const attribute of attributes) {
    attributeMap.set(attribute.api_slug, attribute);
    attributeSlugs.push(attribute.api_slug);
  }

  const getAttribute = (slug: string) => attributeMap.get(slug);

  const getAttributeOrThrow = (slug: string) => {
    const attribute = getAttribute(slug);
    if (!attribute) {
      throw new AttioResponseError(
        `Unknown attribute slug "${slug}" for ${input.target}:${input.identifier}`,
        {
          code: "UNKNOWN_ATTRIBUTE",
        },
      );
    }
    return attribute;
  };

  const getAccessor = (slug: string) => {
    const attribute = getAttribute(slug);
    if (!attribute) {
      return;
    }
    return createAccessor(attribute);
  };

  const getAccessorOrThrow = (slug: string) =>
    createAccessor(getAttributeOrThrow(slug));

  return {
    target: input.target,
    identifier: input.identifier,
    attributes,
    attributeSlugs,
    getAttribute,
    getAttributeOrThrow,
    getAccessor,
    getAccessorOrThrow,
  };
};

export type { AttributeAccessor, AttioSchema, SchemaInput };
export { createSchema };
