import { z } from "zod";

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

const createBrandedIdSchema = <TBrand extends string>(label: string) =>
  z
    .string()
    .refine((id) => id.trim().length > 0, {
      message: `${label} cannot be empty`,
    })
    .transform((id) => createBrandedId<TBrand>(id, label));

export type { BrandedId };
export { createBrandedId, createBrandedIdSchema };
