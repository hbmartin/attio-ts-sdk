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
type FieldCondition = {
  [op in ComparisonOperator]?: unknown;
};

// Nested field access (e.g., name.first_name)
interface NestedFieldCondition {
  [nestedField: string]: FieldCondition;
}

// A filter on an attribute (can be shorthand value, condition, or nested)
type AttributeFilter = unknown | FieldCondition | NestedFieldCondition;

// Path segment: [objectSlug, attributeSlug]
type PathSegment = [objectSlug: string, attributeSlug: string];

// Path-based filter
interface PathFilter {
  path: PathSegment[];
  constraints: Record<string, unknown>;
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

const operator = (field: string, op: string, value: unknown): AttioFilter => ({
  [field]: { [op]: value },
});

const filters = {
  // String/equality operators
  eq: (field: string, value: unknown): AttioFilter =>
    operator(field, "$eq", value),
  contains: (field: string, value: unknown): AttioFilter =>
    operator(field, "$contains", value),
  startsWith: (field: string, value: unknown): AttioFilter =>
    operator(field, "$starts_with", value),
  endsWith: (field: string, value: unknown): AttioFilter =>
    operator(field, "$ends_with", value),
  notEmpty: (field: string): AttioFilter => operator(field, "$not_empty", true),

  // Numeric/date comparison operators
  lt: (field: string, value: unknown): AttioFilter =>
    operator(field, "$lt", value),
  lte: (field: string, value: unknown): AttioFilter =>
    operator(field, "$lte", value),
  gt: (field: string, value: unknown): AttioFilter =>
    operator(field, "$gt", value),
  gte: (field: string, value: unknown): AttioFilter =>
    operator(field, "$gte", value),

  // Set membership
  in: (field: string, values: unknown[]): AttioFilter =>
    operator(field, "$in", values),

  // Range helper: field >= min AND field < max
  between: (field: string, min: unknown, max: unknown): AttioFilter => ({
    [field]: { $gte: min, $lt: max },
  }),

  // Logical operators
  and: (...conditions: AttioFilter[]): AttioFilter => ({ $and: conditions }),
  or: (...conditions: AttioFilter[]): AttioFilter => ({ $or: conditions }),
  not: (condition: AttioFilter): AttioFilter => ({ $not: condition }),

  // Path-based filter for record reference traversal
  path: (
    segments: PathSegment[],
    constraints: Record<string, unknown>,
  ): PathFilter => ({
    path: segments,
    constraints,
  }),
};

export type {
  AttioFilter,
  PathFilter,
  PathSegment,
  ComparisonOperator,
  FieldCondition,
};
export { filters };
