// Values that can be ordered (for $lt, $lte, $gt, $gte)
type ComparableValue = string | number;

// Primitive values that can be used in filter comparisons
type FilterValue = ComparableValue | boolean | null;

// Comparison operators
type ComparisonOperator =
  | "$eq"
  | "$contains"
  | "$starts_with"
  | "$ends_with"
  | "$not_empty"
  | "$in"
  | "$lt"
  | "$lte"
  | "$gt"
  | "$gte";

// A comparison condition on a single field
interface FieldCondition {
  $eq?: FilterValue;
  $contains?: string;
  $starts_with?: string;
  $ends_with?: string;
  $not_empty?: true;
  $in?: FilterValue[];
  $lt?: ComparableValue;
  $lte?: ComparableValue;
  $gt?: ComparableValue;
  $gte?: ComparableValue;
}

// Nested field access (e.g., name.first_name)
interface NestedFieldCondition {
  [nestedField: string]: FieldCondition;
}

// Shorthand value for simple equality filters
type ShorthandValue = FilterValue | FilterValue[];

// A filter on an attribute (can be shorthand value, condition, or nested)
type AttributeFilter = ShorthandValue | FieldCondition | NestedFieldCondition;

// Path segment: [objectSlug, attributeSlug]
type PathSegment = [objectSlug: string, attributeSlug: string];

// Attribute-level filters (no path traversal)
// Used for constraints in PathFilter - supports attribute conditions and logical operators
// but not nested path filters
type AttributeLevelFilter =
  | { $and: AttributeLevelFilter[] }
  | { $or: AttributeLevelFilter[] }
  | { $not: AttributeLevelFilter }
  | { [attribute: string]: AttributeFilter };

// Path-based filter
interface PathFilter {
  path: PathSegment[];
  constraints: AttributeLevelFilter;
}

// Logical filter combinations
interface AndFilter {
  $and: AttioFilter[];
}
interface OrFilter {
  $or: AttioFilter[];
}
interface NotFilter {
  $not: AttioFilter;
}

// Main filter type - union of all possibilities
type AttioFilter =
  | PathFilter
  | AndFilter
  | OrFilter
  | NotFilter
  | { [attribute: string]: AttributeFilter };

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
export { filters };
