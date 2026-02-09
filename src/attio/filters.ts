import { z } from "zod";

const comparableValueSchema = z.union([z.string(), z.number()]);

const filterValueSchema = z.union([
  comparableValueSchema,
  z.boolean(),
  z.null(),
]);

const fieldConditionSchema = z
  .object({
    $eq: filterValueSchema.optional(),
    $contains: z.string().optional(),
    $starts_with: z.string().optional(),
    $ends_with: z.string().optional(),
    $not_empty: z.literal(true).optional(),
    $in: z.array(filterValueSchema).optional(),
    $lt: comparableValueSchema.optional(),
    $lte: comparableValueSchema.optional(),
    $gt: comparableValueSchema.optional(),
    $gte: comparableValueSchema.optional(),
  })
  .strict();

const nestedFieldConditionSchema = z.record(z.string(), fieldConditionSchema);

const shorthandValueSchema = z.union([
  filterValueSchema,
  z.array(filterValueSchema),
]);

const attributeFilterSchema = z.union([
  shorthandValueSchema,
  fieldConditionSchema,
  nestedFieldConditionSchema,
]);

const attributeFilterRecordSchema = z.record(z.string(), attributeFilterSchema);

type AttributeLevelFilterShape =
  | { $and: AttributeLevelFilterShape[] }
  | { $or: AttributeLevelFilterShape[] }
  | { $not: AttributeLevelFilterShape }
  | Record<string, z.output<typeof attributeFilterSchema>>;

const attributeLevelFilterSchema: z.ZodType<AttributeLevelFilterShape> = z.lazy(
  () =>
    z.union([
      z
        .object({
          $and: z.array(attributeLevelFilterSchema),
        })
        .strict(),
      z
        .object({
          $or: z.array(attributeLevelFilterSchema),
        })
        .strict(),
      z
        .object({
          $not: attributeLevelFilterSchema,
        })
        .strict(),
      attributeFilterRecordSchema,
    ]),
);

const pathSegmentSchema = z.tuple([z.string(), z.string()]);

const pathFilterSchema = z
  .object({
    path: z.array(pathSegmentSchema).min(1),
    constraints: attributeLevelFilterSchema,
  })
  .strict();

type AttioFilterShape =
  | z.output<typeof pathFilterSchema>
  | { $and: AttioFilterShape[] }
  | { $or: AttioFilterShape[] }
  | { $not: AttioFilterShape }
  | Record<string, z.output<typeof attributeFilterSchema>>;

const attioFilterSchema: z.ZodType<AttioFilterShape> = z.lazy(() =>
  z.union([
    pathFilterSchema,
    z
      .object({
        $and: z.array(attioFilterSchema),
      })
      .strict(),
    z
      .object({
        $or: z.array(attioFilterSchema),
      })
      .strict(),
    z
      .object({
        $not: attioFilterSchema,
      })
      .strict(),
    attributeFilterRecordSchema,
  ]),
);

// Derived types keep TypeScript in sync with runtime validation.
type ComparableValue = z.output<typeof comparableValueSchema>;
type FilterValue = z.output<typeof filterValueSchema>;
type ComparisonOperator = keyof z.output<typeof fieldConditionSchema>;
type FieldCondition = z.output<typeof fieldConditionSchema>;
type ShorthandValue = z.output<typeof shorthandValueSchema>;
type AttributeLevelFilter = z.output<typeof attributeLevelFilterSchema>;
type PathSegment = z.output<typeof pathSegmentSchema>;
type PathFilter = z.output<typeof pathFilterSchema>;
type AttioFilter = z.output<typeof attioFilterSchema>;

const attioApiFilterSchema = z.record(z.string(), z.unknown());

const parseAttioFilter = (filter: AttioFilter): Record<string, unknown> =>
  attioApiFilterSchema.parse(attioFilterSchema.parse(filter));

const operator = (
  field: string,
  op: ComparisonOperator,
  value: FilterValue | FilterValue[],
): AttioFilter => ({
  [field]: { [op]: value },
});

const filters = {
  // String/equality operators
  eq: (field: string, value: FilterValue): AttioFilter =>
    operator(field, "$eq", value),
  contains: (field: string, value: string): AttioFilter =>
    operator(field, "$contains", value),
  startsWith: (field: string, value: string): AttioFilter =>
    operator(field, "$starts_with", value),
  endsWith: (field: string, value: string): AttioFilter =>
    operator(field, "$ends_with", value),
  notEmpty: (field: string): AttioFilter => operator(field, "$not_empty", true),

  // Numeric/date comparison operators
  lt: (field: string, value: ComparableValue): AttioFilter =>
    operator(field, "$lt", value),
  lte: (field: string, value: ComparableValue): AttioFilter =>
    operator(field, "$lte", value),
  gt: (field: string, value: ComparableValue): AttioFilter =>
    operator(field, "$gt", value),
  gte: (field: string, value: ComparableValue): AttioFilter =>
    operator(field, "$gte", value),

  // Set membership
  in: (field: string, values: FilterValue[]): AttioFilter =>
    operator(field, "$in", values),

  // Range helper: field >= min AND field < max
  between: (
    field: string,
    min: ComparableValue,
    max: ComparableValue,
  ): AttioFilter => ({
    [field]: { $gte: min, $lt: max },
  }),

  // Logical operators
  and: (...conditions: AttioFilter[]): AttioFilter => ({ $and: conditions }),
  or: (...conditions: AttioFilter[]): AttioFilter => ({ $or: conditions }),
  not: (condition: AttioFilter): AttioFilter => ({ $not: condition }),

  // Path-based filter for record reference traversal
  path: (
    segments: PathSegment[],
    constraints: AttributeLevelFilter,
  ): PathFilter => {
    if (segments.length === 0) {
      throw new Error("path segments must be non-empty");
    }
    return {
      path: segments,
      constraints,
    };
  },
};

export type {
  AttioFilter,
  AttributeLevelFilter,
  ComparableValue,
  ComparisonOperator,
  FieldCondition,
  FilterValue,
  PathFilter,
  PathSegment,
  ShorthandValue,
};
export { attioFilterSchema, filters, parseAttioFilter };
