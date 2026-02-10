type BrandedId<TBrand extends string> = string & { readonly __brand: TBrand };

const createBrandedId = <TBrand extends string>(
  id: string,
  label: string,
): BrandedId<TBrand> => {
  if (!id.trim()) {
    throw new Error(`${label} cannot be empty`);
  }
  return id as BrandedId<TBrand>;
};

export { createBrandedId };
export type { BrandedId };
