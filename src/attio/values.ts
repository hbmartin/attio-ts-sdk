import { z } from "zod";
import type { InputValue } from "../generated";
import { AttioResponseError } from "./errors";
import type { AttioRecordLike } from "./record-utils";
import {
  checkboxValueSchema,
  currencyValueSchema,
  dateValueSchema,
  domainValueSchema,
  emailValueSchema,
  enrichedSelectValueSchema,
  enrichedStatusValueSchema,
  numberValueSchema,
  personalNameValueSchema,
  phoneValueSchema,
  ratingValueSchema,
  textValueSchema,
  timestampValueSchema,
} from "./value-schemas";

interface ValueCurrencyInput {
  currency_value: number;
  currency_code?: string;
}

type ValueInput = InputValue | ValueCurrencyInput;

interface ValueFactory {
  string: (value: string) => ValueInput[];
  number: (value: number) => ValueInput[];
  boolean: (value: boolean) => ValueInput[];
  domain: (value: string) => ValueInput[];
  email: (value: string) => ValueInput[];
  currency: (value: number, currencyCode?: string) => ValueInput[];
}

interface ValueLookupOptions<T> {
  schema?: z.ZodType<T>;
}

const nonEmptyStringSchema = z.string().min(1, "Expected a non-empty string.");
const emailSchema = z.string().email("Expected a valid email address.");
const currencyCodeSchema = z
  .string()
  .regex(/^[A-Z]{3}$/, "Expected ISO 4217 currency code.");
const finiteNumberSchema = z.number().finite("Expected a finite number.");

const wrapSingle = (input: ValueInput): ValueInput[] => [input];

const value: ValueFactory = {
  string: (input) => wrapSingle({ value: nonEmptyStringSchema.parse(input) }),
  number: (input) => wrapSingle({ value: finiteNumberSchema.parse(input) }),
  boolean: (input) => wrapSingle({ value: z.boolean().parse(input) }),
  domain: (input) => wrapSingle({ domain: nonEmptyStringSchema.parse(input) }),
  email: (input) => wrapSingle({ email_address: emailSchema.parse(input) }),
  currency: (input, currencyCode) => {
    const currency_value = finiteNumberSchema.parse(input);
    if (currencyCode === undefined) {
      return wrapSingle({ currency_value });
    }
    return wrapSingle({
      currency_value,
      currency_code: currencyCodeSchema.parse(currencyCode),
    });
  },
};

const recordValuesSchema = z
  .object({
    values: z.record(z.string(), z.array(z.unknown())).optional(),
  })
  .passthrough();

const extractValues = (
  record: AttioRecordLike,
): Record<string, unknown[]> | undefined => {
  const parsed = recordValuesSchema.safeParse(record);
  if (!parsed.success) {
    return;
  }
  return parsed.data.values;
};

const parseValuesOrThrow = <T>(
  raw: unknown[],
  schema: z.ZodType<T>,
  attribute: string,
): T[] => {
  const parsed: T[] = [];
  for (const entry of raw) {
    const result = schema.safeParse(entry);
    if (!result.success) {
      throw new AttioResponseError(
        `Invalid API response: attribute "${attribute}" value mismatch`,
        {
          code: "INVALID_VALUE",
          data: result.error,
        },
      );
    }
    parsed.push(result.data);
  }
  return parsed;
};

function getValue<T>(
  record: AttioRecordLike,
  attribute: string,
  options: ValueLookupOptions<T> & { schema: z.ZodType<T> },
): T[] | undefined;
function getValue(
  record: AttioRecordLike,
  attribute: string,
  options?: ValueLookupOptions<unknown>,
): unknown[] | undefined;
function getValue<T>(
  record: AttioRecordLike,
  attribute: string,
  options?: ValueLookupOptions<T>,
): unknown[] | T[] | undefined {
  const values = extractValues(record);
  const raw = values?.[attribute];
  if (!raw) {
    return;
  }
  if (!options?.schema) {
    return raw;
  }
  return parseValuesOrThrow(raw, options.schema, attribute);
}

function getFirstValue<T>(
  record: AttioRecordLike,
  attribute: string,
  options: ValueLookupOptions<T> & { schema: z.ZodType<T> },
): T | undefined;
function getFirstValue(
  record: AttioRecordLike,
  attribute: string,
  options?: ValueLookupOptions<unknown>,
): unknown | undefined;
function getFirstValue<T>(
  record: AttioRecordLike,
  attribute: string,
  options?: ValueLookupOptions<T>,
): unknown | T | undefined {
  const values = getValue(record, attribute, options);
  return values ? values[0] : undefined;
}

type ValueResult<T> =
  | { ok: true; value: T }
  | { ok: false; code: string; message: string };

const safeParseValues = <T>(
  raw: unknown[],
  schema: z.ZodType<T>,
  attribute: string,
): ValueResult<T[]> => {
  const parsed: T[] = [];
  for (const entry of raw) {
    const result = schema.safeParse(entry);
    if (!result.success) {
      return {
        ok: false,
        code: "INVALID_VALUE",
        message: `Invalid API response: attribute "${attribute}" value mismatch`,
      };
    }
    parsed.push(result.data);
  }
  return { ok: true, value: parsed };
};

const getValueSafe = <T>(
  record: AttioRecordLike,
  attribute: string,
  schema: z.ZodType<T>,
): ValueResult<T[] | undefined> => {
  const values = extractValues(record);
  const raw = values?.[attribute];
  if (!raw) {
    return { ok: true, value: undefined };
  }
  return safeParseValues(raw, schema, attribute);
};

const getFirstValueSafe = <T>(
  record: AttioRecordLike,
  attribute: string,
  schema: z.ZodType<T>,
): ValueResult<T | undefined> => {
  const result = getValueSafe(record, attribute, schema);
  if (!result.ok) {
    return result;
  }
  return { ok: true, value: result.value?.[0] };
};

const extractFirstScalar = <T, R>(
  record: AttioRecordLike,
  attribute: string,
  schema: z.ZodType<T>,
  extract: (parsed: T) => R,
): R | undefined => {
  const result = getFirstValueSafe(record, attribute, schema);
  if (!result.ok || result.value === undefined) {
    return;
  }
  return extract(result.value);
};

const getFirstText = (
  record: AttioRecordLike,
  attribute: string,
): string | undefined =>
  extractFirstScalar(record, attribute, textValueSchema, (v) => v.value);

const getFirstNumber = (
  record: AttioRecordLike,
  attribute: string,
): number | undefined =>
  extractFirstScalar(record, attribute, numberValueSchema, (v) => v.value);

const getFirstDate = (
  record: AttioRecordLike,
  attribute: string,
): string | undefined =>
  extractFirstScalar(record, attribute, dateValueSchema, (v) => v.value);

const getFirstTimestamp = (
  record: AttioRecordLike,
  attribute: string,
): string | undefined =>
  extractFirstScalar(record, attribute, timestampValueSchema, (v) => v.value);

const getFirstCheckbox = (
  record: AttioRecordLike,
  attribute: string,
): boolean | undefined =>
  extractFirstScalar(record, attribute, checkboxValueSchema, (v) => v.value);

const getFirstRating = (
  record: AttioRecordLike,
  attribute: string,
): number | undefined =>
  extractFirstScalar(record, attribute, ratingValueSchema, (v) => v.value);

const getFirstCurrencyValue = (
  record: AttioRecordLike,
  attribute: string,
): number | undefined =>
  extractFirstScalar(
    record,
    attribute,
    currencyValueSchema,
    (v) => v.currency_value,
  );

const getFirstSelectTitle = (
  record: AttioRecordLike,
  attribute: string,
): string | undefined =>
  extractFirstScalar(
    record,
    attribute,
    enrichedSelectValueSchema,
    (v) => v.option.title,
  );

const getFirstStatusTitle = (
  record: AttioRecordLike,
  attribute: string,
): string | undefined =>
  extractFirstScalar(
    record,
    attribute,
    enrichedStatusValueSchema,
    (v) => v.status.title,
  );

const getFirstFullName = (
  record: AttioRecordLike,
  attribute: string,
): string | undefined =>
  extractFirstScalar(
    record,
    attribute,
    personalNameValueSchema,
    (v) => v.full_name,
  );

const getFirstEmail = (
  record: AttioRecordLike,
  attribute: string,
): string | undefined =>
  extractFirstScalar(
    record,
    attribute,
    emailValueSchema,
    (v) => v.email_address,
  );

const getFirstDomain = (
  record: AttioRecordLike,
  attribute: string,
): string | undefined =>
  extractFirstScalar(record, attribute, domainValueSchema, (v) => v.domain);

const getFirstPhone = (
  record: AttioRecordLike,
  attribute: string,
): string | undefined =>
  extractFirstScalar(
    record,
    attribute,
    phoneValueSchema,
    (v) => v.phone_number,
  );

export {
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
  getValueSafe,
  value,
};
export type {
  ValueCurrencyInput,
  ValueFactory,
  ValueInput,
  ValueLookupOptions,
  ValueResult,
};
