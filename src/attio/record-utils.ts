export interface AttioRecordLike {
  id?: Record<string, unknown>;
  values?: Record<string, unknown>;
  [key: string]: unknown;
}

const extractAnyId = (obj: unknown): string | undefined => {
  if (!obj || typeof obj !== "object") return;
  const record = obj as Record<string, unknown>;
  const idObj = record.id as Record<string, unknown> | undefined;
  return (
    (idObj?.record_id as string) ??
    (idObj?.company_id as string) ??
    (idObj?.person_id as string) ??
    (idObj?.list_id as string) ??
    (idObj?.task_id as string) ??
    (typeof record.id === "string" ? record.id : undefined) ??
    (record.record_id as string) ??
    (record.company_id as string) ??
    (record.person_id as string) ??
    (record.list_id as string) ??
    (record.task_id as string)
  );
};

const extractValues = (obj: unknown): Record<string, unknown> | undefined => {
  if (!obj || typeof obj !== "object") return;
  const record = obj as Record<string, unknown>;
  const values = record.values;
  if (!values || typeof values !== "object" || Array.isArray(values)) return;
  return values as Record<string, unknown>;
};

export const extractRecordId = (obj: unknown): string | undefined => {
  if (!obj || typeof obj !== "object") return;
  const record = obj as Record<string, unknown>;
  const nested =
    extractAnyId(record) ??
    extractAnyId(record.data) ??
    extractAnyId((record.data as Record<string, unknown>)?.data) ??
    extractAnyId((record.data as Record<string, unknown>)?.record) ??
    extractAnyId((record.data as Record<string, unknown>)?.items?.[0]);
  return nested;
};

export const normalizeRecord = <T extends AttioRecordLike>(
  raw: Record<string, unknown>,
  options: { allowEmpty?: boolean } = {},
): T => {
  if (!raw || typeof raw !== "object") {
    throw new Error("Invalid API response: no data found");
  }

  if (!options.allowEmpty && Object.keys(raw).length === 0) {
    throw new Error("Invalid API response: empty data object");
  }

  const hasValidId = raw.id && (raw.id as Record<string, unknown>).record_id;
  if (hasValidId && raw.values) {
    return raw as T;
  }

  const result: Record<string, unknown> = { ...raw };

  if (!result.id || !(result.id as Record<string, unknown>).record_id) {
    const extractedId = extractRecordId(result);
    if (extractedId) {
      result.id = {
        ...(result.id as Record<string, unknown>),
        record_id: extractedId,
      };
    }
  }

  if (!result.values) {
    const dataRecord = result.data as Record<string, unknown> | undefined;
    const nested =
      extractValues(result.data) ??
      extractValues(dataRecord?.data) ??
      extractValues(dataRecord?.record) ??
      extractValues(dataRecord?.items?.[0]);
    result.values = nested ?? {};
  }

  return result as T;
};

export const normalizeRecords = <T extends AttioRecordLike>(
  items: unknown[],
  options: { allowEmpty?: boolean } = {},
): T[] => {
  return items
    .filter((item) => item && typeof item === "object")
    .map((item) =>
      normalizeRecord<T>(item as Record<string, unknown>, options),
    );
};
