type WriteValueScalar = string | number | boolean | Date;
type SchemaWriteValue =
  | WriteValueScalar
  | Record<string, unknown>
  | null
  | undefined;
type SchemaWriteFieldValue = SchemaWriteValue | SchemaWriteValue[];
type SchemaWriteInput = Record<string, SchemaWriteFieldValue>;
type SchemaWriteValues = Record<string, unknown[]>;

interface SchemaWriteOptions {
  validateAllowedValues?: boolean;
  includeArchivedAllowedValues?: boolean;
}

interface AttioWriteValuesBuilder {
  buildValues: (
    input: SchemaWriteInput,
    options?: SchemaWriteOptions,
  ) => Promise<SchemaWriteValues>;
}

export type {
  AttioWriteValuesBuilder,
  SchemaWriteFieldValue,
  SchemaWriteInput,
  SchemaWriteOptions,
  SchemaWriteValue,
  SchemaWriteValues,
};
