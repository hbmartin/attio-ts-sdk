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
  locationValueSchema,
  numberValueSchema,
  personalNameValueSchema,
  phoneValueSchema,
  ratingValueSchema,
  recordReferenceValueSchema,
  selectValueSchema,
  statusValueSchema,
  textValueSchema,
  timestampValueSchema,
} from "./value-schemas";

interface ValueCurrencyInput {
  currency_value: number;
  currency_code?: string;
}

interface ValuePhoneInput {
  original_phone_number: string;
  country_code?: string;
}

interface ValuePersonalNameInput {
  first_name?: string;
  last_name?: string;
  full_name?: string;
}

interface ValueRecordReferenceInput {
  targetObject: string;
  targetRecordId: string;
}

interface ValueLocationInput {
  line1?: string | null;
  line2?: string | null;
  line3?: string | null;
  line4?: string | null;
  locality?: string | null;
  region?: string | null;
  postcode?: string | null;
  countryCode?: string | null;
  latitude?: string | null;
  longitude?: string | null;
}

interface ValueLocationPayload {
  line_1: string | null;
  line_2: string | null;
  line_3: string | null;
  line_4: string | null;
  locality: string | null;
  region: string | null;
  postcode: string | null;
  country_code: string | null;
  latitude: string | null;
  longitude: string | null;
}

type ValueInput =
  | InputValue
  | ValueCurrencyInput
  | ValueLocationPayload
  | ValuePhoneInput;

interface ValueFactory {
  string: (value: string) => ValueInput[];
  text: (value: string) => ValueInput[];
  number: (value: number) => ValueInput[];
  boolean: (value: boolean) => ValueInput[];
  domain: (value: string) => ValueInput[];
  email: (value: string) => ValueInput[];
  phone: (value: string, countryCode?: string) => ValueInput[];
  personalName: (input: ValuePersonalNameInput) => ValueInput[];
  status: (value: string) => ValueInput[];
  select: (value: string) => ValueInput[];
  recordReference: (input: ValueRecordReferenceInput) => ValueInput[];
  location: (input: ValueLocationInput) => ValueInput[];
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
const countryCodeSchema = z
  .string()
  .regex(/^[A-Z]{2}$/, "Expected ISO 3166-1 alpha-2 country code.");
const finiteNumberSchema = z.number().finite("Expected a finite number.");
const personalNameInputSchema = z
  .object({
    first_name: nonEmptyStringSchema.optional(),
    last_name: nonEmptyStringSchema.optional(),
    full_name: nonEmptyStringSchema.optional(),
  })
  .refine((input) => Object.values(input).some(Boolean), {
    message: "Expected at least one name field.",
  });
const recordReferenceInputSchema = z.object({
  targetObject: nonEmptyStringSchema,
  targetRecordId: nonEmptyStringSchema,
});
const locationInputSchema = z.object({
  line1: z.string().nullable().optional(),
  line2: z.string().nullable().optional(),
  line3: z.string().nullable().optional(),
  line4: z.string().nullable().optional(),
  locality: z.string().nullable().optional(),
  region: z.string().nullable().optional(),
  postcode: z.string().nullable().optional(),
  countryCode: countryCodeSchema.nullable().optional(),
  latitude: z.string().nullable().optional(),
  longitude: z.string().nullable().optional(),
});

const wrapSingle = (input: ValueInput): ValueInput[] => [input];

const value: ValueFactory = {
  string: (input) => wrapSingle({ value: nonEmptyStringSchema.parse(input) }),
  text: (input) => wrapSingle({ value: nonEmptyStringSchema.parse(input) }),
  number: (input) => wrapSingle({ value: finiteNumberSchema.parse(input) }),
  boolean: (input) => wrapSingle({ value: z.boolean().parse(input) }),
  domain: (input) => wrapSingle({ domain: nonEmptyStringSchema.parse(input) }),
  email: (input) => wrapSingle({ email_address: emailSchema.parse(input) }),
  phone: (input, countryCode) => {
    const original_phone_number = nonEmptyStringSchema.parse(input);
    if (countryCode === undefined) {
      return wrapSingle({ original_phone_number });
    }
    return wrapSingle({
      original_phone_number,
      country_code: countryCodeSchema.parse(countryCode),
    });
  },
  personalName: (input) => {
    const parsed = personalNameInputSchema.parse(input);
    return wrapSingle(parsed);
  },
  status: (input) => wrapSingle({ status: nonEmptyStringSchema.parse(input) }),
  select: (input) => wrapSingle({ option: nonEmptyStringSchema.parse(input) }),
  recordReference: (input) => {
    const parsed = recordReferenceInputSchema.parse(input);
    return wrapSingle({
      target_object: parsed.targetObject,
      target_record_id: parsed.targetRecordId,
    });
  },
  location: (input) => {
    const parsed = locationInputSchema.parse(input);
    return wrapSingle({
      line_1: parsed.line1 ?? null,
      line_2: parsed.line2 ?? null,
      line_3: parsed.line3 ?? null,
      line_4: parsed.line4 ?? null,
      locality: parsed.locality ?? null,
      region: parsed.region ?? null,
      postcode: parsed.postcode ?? null,
      country_code: parsed.countryCode ?? null,
      latitude: parsed.latitude ?? null,
      longitude: parsed.longitude ?? null,
    });
  },
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

type ValueErrorCode = "INVALID_VALUE";

type ValueResult<T> =
  | { ok: true; value: T }
  | { ok: false; code: ValueErrorCode; message: string };

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

const extractScalars = <T, R>(
  record: AttioRecordLike,
  attribute: string,
  schema: z.ZodType<T>,
  extract: (parsed: T) => R,
): R[] | undefined => {
  const result = getValueSafe(record, attribute, schema);
  if (!result.ok || result.value === undefined) {
    return;
  }
  return result.value.map(extract);
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
  extractFirstScalar(record, attribute, selectValueSchema, (v) =>
    typeof v.option === "string" ? v.option : v.option.title,
  );

const getFirstStatusTitle = (
  record: AttioRecordLike,
  attribute: string,
): string | undefined =>
  extractFirstScalar(record, attribute, statusValueSchema, (v) =>
    typeof v.status === "string" ? v.status : v.status.title,
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

const getEmails = (
  record: AttioRecordLike,
  attribute: string,
): string[] | undefined =>
  extractScalars(record, attribute, emailValueSchema, (v) => v.email_address);

const getPhones = (
  record: AttioRecordLike,
  attribute: string,
): string[] | undefined =>
  extractScalars(record, attribute, phoneValueSchema, (v) => v.phone_number);

const getSelectTitles = (
  record: AttioRecordLike,
  attribute: string,
): string[] | undefined =>
  extractScalars(record, attribute, selectValueSchema, (v) =>
    typeof v.option === "string" ? v.option : v.option.title,
  );

const getStatusTitles = (
  record: AttioRecordLike,
  attribute: string,
): string[] | undefined =>
  extractScalars(record, attribute, statusValueSchema, (v) =>
    typeof v.status === "string" ? v.status : v.status.title,
  );

const getRecordReferenceIds = (
  record: AttioRecordLike,
  attribute: string,
): string[] | undefined =>
  extractScalars(
    record,
    attribute,
    recordReferenceValueSchema,
    (v) => v.target_record_id,
  );

const getFirstRecordReferenceId = (
  record: AttioRecordLike,
  attribute: string,
): string | undefined =>
  extractFirstScalar(
    record,
    attribute,
    recordReferenceValueSchema,
    (v) => v.target_record_id,
  );

const getFirstLocation = (record: AttioRecordLike, attribute: string) =>
  extractFirstScalar(record, attribute, locationValueSchema, (v) => v);

export type {
  ValueCurrencyInput,
  ValueErrorCode,
  ValueFactory,
  ValueInput,
  ValueLocationInput,
  ValueLocationPayload,
  ValueLookupOptions,
  ValuePersonalNameInput,
  ValuePhoneInput,
  ValueRecordReferenceInput,
  ValueResult,
};
export {
  getEmails,
  getFirstCheckbox,
  getFirstCurrencyValue,
  getFirstDate,
  getFirstDomain,
  getFirstEmail,
  getFirstFullName,
  getFirstLocation,
  getFirstNumber,
  getFirstPhone,
  getFirstRating,
  getFirstRecordReferenceId,
  getFirstSelectTitle,
  getFirstStatusTitle,
  getFirstText,
  getFirstTimestamp,
  getFirstValue,
  getFirstValueSafe,
  getPhones,
  getRecordReferenceIds,
  getSelectTitles,
  getStatusTitles,
  getValue,
  getValueSafe,
  value,
};
