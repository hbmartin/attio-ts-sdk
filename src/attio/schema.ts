import type { ZodType } from "zod";
import type {
  GetV2ByTargetByIdentifierAttributesData,
  Options,
} from "../generated";
import type { AttioClientInput } from "./client";
import { AttioResponseError } from "./errors";
import { listAttributes, type ZodAttribute } from "./metadata";
import type { AttioRecordLike } from "./record-utils";
import type { ValueAttributeType } from "./value-schemas";
import { valueSchemasByType } from "./value-schemas";
import type { ValueLookupOptions } from "./values";
import {
  getFirstCheckbox,
  getFirstCurrencyValue,
  getFirstDate,
  getFirstDomain,
  getFirstEmail,
  getFirstFullName,
  getFirstNumber,
  getFirstPhone,
  getFirstRating,
  getFirstSelectTitle,
  getFirstStatusTitle,
  getFirstText,
  getFirstTimestamp,
  getFirstValue,
  getFirstValueSafe,
  getValue,
} from "./values";

type SchemaTarget = GetV2ByTargetByIdentifierAttributesData["path"]["target"];
type SchemaIdentifier =
  GetV2ByTargetByIdentifierAttributesData["path"]["identifier"];

interface SchemaInput extends AttioClientInput {
  target: SchemaTarget;
  identifier: SchemaIdentifier;
  options?: Omit<
    Options<GetV2ByTargetByIdentifierAttributesData>,
    "client" | "path"
  >;
}

interface AttributeAccessor {
  attribute: ZodAttribute;
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
  firstText: (record: AttioRecordLike) => string | undefined;
  firstNumber: (record: AttioRecordLike) => number | undefined;
  firstDate: (record: AttioRecordLike) => string | undefined;
  firstTimestamp: (record: AttioRecordLike) => string | undefined;
  firstCheckbox: (record: AttioRecordLike) => boolean | undefined;
  firstRating: (record: AttioRecordLike) => number | undefined;
  firstCurrencyValue: (record: AttioRecordLike) => number | undefined;
  firstSelectTitle: (record: AttioRecordLike) => string | undefined;
  firstStatusTitle: (record: AttioRecordLike) => string | undefined;
  firstFullName: (record: AttioRecordLike) => string | undefined;
  firstEmail: (record: AttioRecordLike) => string | undefined;
  firstDomain: (record: AttioRecordLike) => string | undefined;
  firstPhone: (record: AttioRecordLike) => string | undefined;
  firstValueTyped: (record: AttioRecordLike) => unknown | undefined;
}

interface AttioSchema {
  target: SchemaTarget;
  identifier: SchemaIdentifier;
  attributes: ZodAttribute[];
  attributeSlugs: string[];
  getAttribute: (slug: string) => ZodAttribute | undefined;
  getAttributeOrThrow: (slug: string) => ZodAttribute;
  getAccessor: (slug: string) => AttributeAccessor | undefined;
  getAccessorOrThrow: (slug: string) => AttributeAccessor;
}

const typedExtractors: Record<
  ValueAttributeType,
  (record: AttioRecordLike, slug: string) => unknown | undefined
> = {
  text: getFirstText,
  number: getFirstNumber,
  date: getFirstDate,
  timestamp: getFirstTimestamp,
  checkbox: getFirstCheckbox,
  rating: getFirstRating,
  currency: getFirstCurrencyValue,
  select: getFirstSelectTitle,
  status: getFirstStatusTitle,
  "personal-name": getFirstFullName,
  "email-address": getFirstEmail,
  domain: getFirstDomain,
  "phone-number": getFirstPhone,
  "record-reference": (record, slug) => {
    const schema = valueSchemasByType["record-reference"];
    const result = getFirstValueSafe(record, slug, schema);
    return result.ok ? result.value : undefined;
  },
  "actor-reference": (record, slug) => {
    const schema = valueSchemasByType["actor-reference"];
    const result = getFirstValueSafe(record, slug, schema);
    return result.ok ? result.value : undefined;
  },
  interaction: (record, slug) => {
    const schema = valueSchemasByType.interaction;
    const result = getFirstValueSafe(record, slug, schema);
    return result.ok ? result.value : undefined;
  },
  location: (record, slug) => {
    const schema = valueSchemasByType.location;
    const result = getFirstValueSafe(record, slug, schema);
    return result.ok ? result.value : undefined;
  },
};

const createAccessor = (attribute: ZodAttribute): AttributeAccessor => {
  const slug = attribute.api_slug;

  return {
    attribute,
    getValue: (record) => getValue(record, slug),
    getFirstValue: (record) => getFirstValue(record, slug),
    getValueAs: (record, options) => getValue(record, slug, options),
    getFirstValueAs: (record, options) => getFirstValue(record, slug, options),
    firstText: (record) => getFirstText(record, slug),
    firstNumber: (record) => getFirstNumber(record, slug),
    firstDate: (record) => getFirstDate(record, slug),
    firstTimestamp: (record) => getFirstTimestamp(record, slug),
    firstCheckbox: (record) => getFirstCheckbox(record, slug),
    firstRating: (record) => getFirstRating(record, slug),
    firstCurrencyValue: (record) => getFirstCurrencyValue(record, slug),
    firstSelectTitle: (record) => getFirstSelectTitle(record, slug),
    firstStatusTitle: (record) => getFirstStatusTitle(record, slug),
    firstFullName: (record) => getFirstFullName(record, slug),
    firstEmail: (record) => getFirstEmail(record, slug),
    firstDomain: (record) => getFirstDomain(record, slug),
    firstPhone: (record) => getFirstPhone(record, slug),
    firstValueTyped: (record) => {
      const extractor = typedExtractors[attribute.type as ValueAttributeType];
      if (!extractor) {
        return getFirstValue(record, slug);
      }
      return extractor(record, slug);
    },
  };
};

const createSchema = async (input: SchemaInput): Promise<AttioSchema> => {
  const attributes = await listAttributes({
    ...input,
    options: input.options,
  });
  const attributeMap = new Map<string, ZodAttribute>();
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
