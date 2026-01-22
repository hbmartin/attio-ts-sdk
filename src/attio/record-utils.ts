import { z } from "zod";
import { AttioResponseError } from "./errors";

const attioRecordIdSchema = z.string().brand<"AttioRecordId">();

type AttioRecordId = z.infer<typeof attioRecordIdSchema>;

interface AttioRecordIdFields {
  record_id?: AttioRecordId;
  company_id?: AttioRecordId;
  person_id?: AttioRecordId;
  list_id?: AttioRecordId;
  task_id?: AttioRecordId;
}

interface UnknownObject extends Record<string, unknown> {}

const unknownObjectSchema: z.ZodType<UnknownObject> = z
  .object({})
  .passthrough();
const recordIdFieldsSchema: z.ZodType<AttioRecordIdFields> = z.object({
  record_id: attioRecordIdSchema.optional(),
  company_id: attioRecordIdSchema.optional(),
  person_id: attioRecordIdSchema.optional(),
  list_id: attioRecordIdSchema.optional(),
  task_id: attioRecordIdSchema.optional(),
});
const unknownArraySchema = z.array(z.unknown());

const extractIdFromFields = (
  fields: AttioRecordIdFields,
): AttioRecordId | undefined =>
  fields.record_id ??
  fields.company_id ??
  fields.person_id ??
  fields.list_id ??
  fields.task_id;

const parseObject = (value: unknown): UnknownObject | undefined => {
  const parsed = unknownObjectSchema.safeParse(value);
  return parsed.success ? parsed.data : undefined;
};

const parseId = (value: unknown): AttioRecordId | undefined => {
  const parsed = attioRecordIdSchema.safeParse(value);
  return parsed.success ? parsed.data : undefined;
};

const parseIdFields = (value: unknown): AttioRecordIdFields | undefined => {
  const parsed = recordIdFieldsSchema.safeParse(value);
  return parsed.success ? parsed.data : undefined;
};

const parseArray = (value: unknown): unknown[] | undefined => {
  const parsed = unknownArraySchema.safeParse(value);
  return parsed.success ? parsed.data : undefined;
};

const extractIdFromRecord = (
  record: UnknownObject,
): AttioRecordId | undefined => {
  const idFields = parseIdFields(record.id);
  const idFromObject = idFields ? extractIdFromFields(idFields) : undefined;
  return (
    idFromObject ??
    parseId(record.id) ??
    parseId(record.record_id) ??
    parseId(record.company_id) ??
    parseId(record.person_id) ??
    parseId(record.list_id) ??
    parseId(record.task_id)
  );
};

const extractValuesObject = (
  record: UnknownObject,
): Record<string, unknown> | undefined => parseObject(record.values);

interface AttioRecordLike {
  id?: AttioRecordIdFields | AttioRecordId;
  values?: Record<string, unknown>;
  [key: string]: unknown;
}

const extractIdFromUnknown = (value: unknown): AttioRecordId | undefined => {
  const record = parseObject(value);
  if (!record) {
    return;
  }
  return extractIdFromRecord(record);
};

const extractValues = (obj: unknown): Record<string, unknown> | undefined => {
  const record = parseObject(obj);
  if (!record) {
    return;
  }
  return extractValuesObject(record);
};

const collectNestedCandidates = (record: UnknownObject): unknown[] => {
  const candidates: unknown[] = [];
  if (record.data !== undefined) {
    candidates.push(record.data);
  }

  const dataRecord = parseObject(record.data);
  if (!dataRecord) {
    return candidates;
  }

  if (dataRecord.data !== undefined) {
    candidates.push(dataRecord.data);
  }
  if (dataRecord.record !== undefined) {
    candidates.push(dataRecord.record);
  }
  const items = parseArray(dataRecord.items);
  if (items && items.length > 0) {
    candidates.push(items[0]);
  }

  return candidates;
};

const findFirstId = (candidates: unknown[]): AttioRecordId | undefined => {
  for (const candidate of candidates) {
    const nested = extractIdFromUnknown(candidate);
    if (nested) {
      return nested;
    }
  }
  return;
};

const extractRecordId = (obj: unknown): AttioRecordId | undefined => {
  const record = parseObject(obj);
  if (!record) {
    return;
  }
  const direct = extractIdFromRecord(record);
  if (direct) {
    return direct;
  }
  return findFirstId(collectNestedCandidates(record));
};

const hasValidRecordId = (raw: UnknownObject): boolean => {
  const idFields = parseIdFields(raw.id);
  return Boolean(idFields?.record_id);
};

const extractNestedValues = (
  result: UnknownObject,
): Record<string, unknown> | undefined => {
  const candidates = collectNestedCandidates(result);
  for (const candidate of candidates) {
    const values = extractValues(candidate);
    if (values) {
      return values;
    }
  }
  return;
};

interface NormalizeRecordOptions {
  allowEmpty?: boolean;
}

function normalizeRecord<T extends AttioRecordLike>(
  raw: Record<string, unknown>,
  options?: NormalizeRecordOptions,
): T;
function normalizeRecord(
  raw: Record<string, unknown>,
  options?: NormalizeRecordOptions,
): AttioRecordLike;
function normalizeRecord(
  raw: Record<string, unknown>,
  options: NormalizeRecordOptions = {},
): AttioRecordLike {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new AttioResponseError("Invalid API response: no data found", {
      code: "INVALID_RESPONSE",
    });
  }

  if (!options.allowEmpty && Object.keys(raw).length === 0) {
    throw new AttioResponseError("Invalid API response: empty data object", {
      code: "EMPTY_RESPONSE",
    });
  }
  // Input already has valid record_id and values - return as-is
  if (hasValidRecordId(raw) && extractValuesObject(raw)) {
    return raw;
  }

  const result: UnknownObject = { ...raw };

  if (!hasValidRecordId(result)) {
    const extractedId = extractRecordId(result);
    if (extractedId) {
      const existingId = parseObject(result.id);
      result.id = {
        ...(existingId ?? {}),
        record_id: extractedId,
      };
    }
  }

  const existingValues = extractValuesObject(result);
  if (!existingValues) {
    result.values = extractNestedValues(result) ?? {};
  }

  return result;
}

function normalizeRecords<T extends AttioRecordLike>(
  items: unknown[],
  options?: NormalizeRecordOptions,
): T[];
function normalizeRecords(
  items: unknown[],
  options?: NormalizeRecordOptions,
): AttioRecordLike[];
function normalizeRecords(
  items: unknown[],
  options: NormalizeRecordOptions = {},
): AttioRecordLike[] {
  const normalized: AttioRecordLike[] = [];
  for (const item of items) {
    const record = parseObject(item);
    if (record) {
      normalized.push(normalizeRecord(record, options));
    }
  }
  return normalized;
}

export type { AttioRecordId, AttioRecordLike };
export { extractRecordId, normalizeRecord, normalizeRecords };
