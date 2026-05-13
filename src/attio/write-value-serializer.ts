import { z } from "zod";
import { AttioResponseError } from "./errors";
import type { NormalizedAllowedValue, ZodAttribute } from "./metadata";
import { locationInputSchema, value } from "./values";
import type { SchemaWriteOptions, SchemaWriteValue } from "./write-value-types";

interface SerializeParams {
  attribute: ZodAttribute;
  entry: Exclude<SchemaWriteValue, null | undefined>;
  options: Required<SchemaWriteOptions>;
  getAllowedValues: (
    attribute: ZodAttribute,
  ) => Promise<NormalizedAllowedValue[]>;
}

type AttributeType = Exclude<ZodAttribute["type"], null>;
type ObjectSerializer = (entry: unknown) => unknown[];
type PrimitiveSerializer = (
  entry: unknown,
  attribute: ZodAttribute,
) => unknown[];

const defaultSchemaWriteOptions: Required<SchemaWriteOptions> = {
  validateAllowedValues: true,
  includeArchivedAllowedValues: false,
};

const nonEmptyStringSchema = z.string().min(1, "Expected a non-empty string.");
const rawValueObjectSchema = z
  .object({})
  .passthrough()
  .superRefine((item, ctx) => {
    if (Object.keys(item).length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Expected a non-empty value object.",
      });
    }
  });
const dateLikeSchema = z.union([z.string(), z.date()]);
const recordReferenceInputSchema = z.object({
  targetObject: nonEmptyStringSchema,
  targetRecordId: nonEmptyStringSchema,
});
const rawRecordReferenceInputSchema = z
  .object({
    target_object: nonEmptyStringSchema,
    target_record_id: nonEmptyStringSchema,
  })
  .passthrough();
const selectInputSchema = z
  .object({
    option: nonEmptyStringSchema,
  })
  .passthrough();
const statusInputSchema = z
  .object({
    status: nonEmptyStringSchema,
  })
  .passthrough();
const currencyInputSchema = z.object({
  value: z.number().finite(),
  currencyCode: z.string().optional(),
});
const rawCurrencyInputSchema = z
  .object({
    currency_value: z.number().finite(),
    currency_code: z.string().optional(),
  })
  .passthrough();
const phoneInputSchema = z.object({
  original_phone_number: nonEmptyStringSchema,
  country_code: z.string().optional(),
});
const personalNameInputSchema = z.object({
  first_name: nonEmptyStringSchema.optional(),
  last_name: nonEmptyStringSchema.optional(),
  full_name: nonEmptyStringSchema.optional(),
});
const normalizeDateLike = (
  input: string | Date,
  type: "date" | "timestamp",
) => {
  if (typeof input === "string") {
    return input;
  }

  const iso = input.toISOString();
  return type === "date" ? iso.slice(0, 10) : iso;
};

const parseRawValueObject = (entry: unknown): Record<string, unknown> => {
  const parsed = rawValueObjectSchema.safeParse(entry);
  if (!parsed.success) {
    throw new AttioResponseError("Unsupported write value.", {
      code: "UNSUPPORTED_WRITE_VALUE",
      data: parsed.error,
    });
  }
  return parsed.data;
};

const assertAllowedValue = async ({
  attribute,
  value: candidate,
  options,
  getAllowedValues,
}: {
  attribute: ZodAttribute;
  value: string;
  options: Required<SchemaWriteOptions>;
  getAllowedValues: (
    attribute: ZodAttribute,
  ) => Promise<NormalizedAllowedValue[]>;
}): Promise<void> => {
  if (!options.validateAllowedValues) {
    return;
  }

  const allowedValues = await getAllowedValues(attribute);
  const match = allowedValues.find(
    (allowedValue) =>
      allowedValue.id === candidate || allowedValue.title === candidate,
  );

  if (!match) {
    throw new AttioResponseError(
      `Unknown allowed value "${candidate}" for "${attribute.api_slug}".`,
      {
        code: "UNKNOWN_ALLOWED_VALUE",
        data: { attribute: attribute.api_slug, value: candidate },
      },
    );
  }

  if (match.archived && !options.includeArchivedAllowedValues) {
    throw new AttioResponseError(
      `Allowed value "${candidate}" for "${attribute.api_slug}" is archived.`,
      {
        code: "ARCHIVED_ALLOWED_VALUE",
        data: { attribute: attribute.api_slug, value: candidate },
      },
    );
  }
};

const serializeRecordReference = (entry: unknown): unknown[] => {
  const referenceInput = recordReferenceInputSchema.safeParse(entry);
  if (referenceInput.success) {
    return value.recordReference(referenceInput.data);
  }

  const rawReferenceInput = rawRecordReferenceInputSchema.safeParse(entry);
  if (rawReferenceInput.success) {
    return [rawReferenceInput.data];
  }

  return [parseRawValueObject(entry)];
};

const serializeCurrencyObject = (entry: unknown): unknown[] => {
  const currencyInput = currencyInputSchema.safeParse(entry);
  if (currencyInput.success) {
    return value.currency(
      currencyInput.data.value,
      currencyInput.data.currencyCode,
    );
  }

  const rawCurrencyInput = rawCurrencyInputSchema.safeParse(entry);
  if (rawCurrencyInput.success) {
    return [rawCurrencyInput.data];
  }

  return [parseRawValueObject(entry)];
};

const serializePhoneObject = (entry: unknown): unknown[] => {
  const phoneInput = phoneInputSchema.safeParse(entry);
  if (!phoneInput.success) {
    return [parseRawValueObject(entry)];
  }

  return value.phone(
    phoneInput.data.original_phone_number,
    phoneInput.data.country_code,
  );
};

const serializePersonalNameObject = (entry: unknown): unknown[] => {
  const personalNameInput = personalNameInputSchema.safeParse(entry);
  if (!personalNameInput.success) {
    return [parseRawValueObject(entry)];
  }

  return value.personalName(personalNameInput.data);
};

const serializeLocationObject = (entry: unknown): unknown[] => {
  const locationInput = locationInputSchema.safeParse(entry);
  if (!locationInput.success) {
    return [parseRawValueObject(entry)];
  }

  return value.location(locationInput.data);
};

const objectSerializers: Partial<Record<AttributeType, ObjectSerializer>> = {
  currency: serializeCurrencyObject,
  location: serializeLocationObject,
  "personal-name": serializePersonalNameObject,
  "phone-number": serializePhoneObject,
  "record-reference": serializeRecordReference,
};

const serializeObjectValue = (attribute: ZodAttribute, entry: unknown) => {
  const serializer = attribute.type
    ? objectSerializers[attribute.type]
    : undefined;
  if (!serializer) {
    return [parseRawValueObject(entry)];
  }

  return serializer(entry);
};

const serializeBooleanPrimitive = (entry: unknown) =>
  value.boolean(z.boolean().parse(entry));

const serializeCurrencyPrimitive = (
  entry: unknown,
  attribute: ZodAttribute,
) => {
  const currencyCode =
    attribute.config.currency.default_currency_code ?? undefined;
  return value.currency(z.number().finite().parse(entry), currencyCode);
};

const serializeDatePrimitive = (entry: unknown) =>
  value.string(normalizeDateLike(dateLikeSchema.parse(entry), "date"));

const serializeDomainPrimitive = (entry: unknown) =>
  value.domain(nonEmptyStringSchema.parse(entry));

const serializeEmailPrimitive = (entry: unknown) =>
  value.email(nonEmptyStringSchema.parse(entry));

const serializeNumberPrimitive = (entry: unknown) =>
  value.number(z.number().finite().parse(entry));

const serializePhonePrimitive = (entry: unknown) =>
  value.phone(nonEmptyStringSchema.parse(entry));

const serializeTextPrimitive = (entry: unknown) =>
  value.string(nonEmptyStringSchema.parse(entry));

const serializeTimestampPrimitive = (entry: unknown) =>
  value.string(normalizeDateLike(dateLikeSchema.parse(entry), "timestamp"));

const primitiveSerializers: Partial<
  Record<AttributeType, PrimitiveSerializer>
> = {
  checkbox: serializeBooleanPrimitive,
  currency: serializeCurrencyPrimitive,
  date: serializeDatePrimitive,
  domain: serializeDomainPrimitive,
  "email-address": serializeEmailPrimitive,
  number: serializeNumberPrimitive,
  "phone-number": serializePhonePrimitive,
  rating: serializeNumberPrimitive,
  text: serializeTextPrimitive,
  timestamp: serializeTimestampPrimitive,
};

const serializePrimitiveValue = ({
  attribute,
  entry,
}: Pick<SerializeParams, "attribute" | "entry">): unknown[] => {
  if (attribute.type === null) {
    return serializeTextPrimitive(entry);
  }

  const serializer = primitiveSerializers[attribute.type];
  if (serializer) {
    return serializer(entry, attribute);
  }

  throw new AttioResponseError(
    `Attribute "${attribute.api_slug}" requires object values.`,
    {
      code: "UNSUPPORTED_WRITE_VALUE",
      data: { attribute: attribute.api_slug, type: attribute.type },
    },
  );
};

const parseChoiceInput = (
  attribute: ZodAttribute,
  entry: Exclude<SchemaWriteValue, null | undefined>,
): { selected: string; rawValue?: Record<string, unknown> } => {
  if (attribute.type === "status") {
    const statusInput = statusInputSchema.safeParse(entry);
    if (statusInput.success) {
      return { selected: statusInput.data.status, rawValue: statusInput.data };
    }
  }

  if (attribute.type === "select") {
    const selectInput = selectInputSchema.safeParse(entry);
    if (selectInput.success) {
      return { selected: selectInput.data.option, rawValue: selectInput.data };
    }
  }

  return { selected: nonEmptyStringSchema.parse(entry) };
};

const serializeChoiceValue = async ({
  attribute,
  entry,
  options,
  getAllowedValues,
}: SerializeParams): Promise<unknown[]> => {
  const choiceInput = parseChoiceInput(attribute, entry);

  await assertAllowedValue({
    attribute,
    value: choiceInput.selected,
    options,
    getAllowedValues,
  });

  if (choiceInput.rawValue) {
    return [choiceInput.rawValue];
  }

  return attribute.type === "status"
    ? value.status(choiceInput.selected)
    : value.select(choiceInput.selected);
};

const serializeAttributeEntry = async (
  params: SerializeParams,
): Promise<unknown[]> => {
  if (
    params.attribute.type === "select" ||
    params.attribute.type === "status"
  ) {
    return await serializeChoiceValue(params);
  }

  const objectResult = rawValueObjectSchema.safeParse(params.entry);
  if (objectResult.success) {
    return serializeObjectValue(params.attribute, objectResult.data);
  }

  return serializePrimitiveValue(params);
};

export { defaultSchemaWriteOptions, serializeAttributeEntry };
