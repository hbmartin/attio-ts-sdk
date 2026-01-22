type AttioFilter = Record<string, unknown>;

const operator = (field: string, op: string, value: unknown): AttioFilter => ({
  [field]: { [op]: value },
});

const filters = {
  eq: (field: string, value: unknown): AttioFilter =>
    operator(field, "$eq", value),
  contains: (field: string, value: unknown): AttioFilter =>
    operator(field, "$contains", value),
  startsWith: (field: string, value: unknown): AttioFilter =>
    operator(field, "$starts_with", value),
  endsWith: (field: string, value: unknown): AttioFilter =>
    operator(field, "$ends_with", value),
  notEmpty: (field: string): AttioFilter => operator(field, "$not_empty", true),
  and: (...conditions: AttioFilter[]): AttioFilter => ({ $and: conditions }),
  or: (...conditions: AttioFilter[]): AttioFilter => ({ $or: conditions }),
  not: (condition: AttioFilter): AttioFilter => ({ $not: condition }),
};

export type { AttioFilter };
export { filters };
