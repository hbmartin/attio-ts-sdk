import type { ZodType } from "zod";
import { z } from "zod";
import { unwrapItems, unwrapPaginationCursor } from "./response";

interface PageResult<T> {
  items: T[];
  nextCursor?: string | null;
}

interface PaginationOptions<T = unknown> {
  cursor?: string | null;
  maxPages?: number;
  maxItems?: number;
  itemSchema?: ZodType<T>;
}

const createPageResultSchema = <T>(itemSchema: ZodType<T>) =>
  z.object({
    items: z.array(itemSchema),
    nextCursor: z.string().nullish(),
  });

const basePageResultSchema = z.object({
  items: z.array(z.unknown()),
  nextCursor: z.string().nullish(),
});

const toPageResult = <T>(result: unknown): PageResult<T> => {
  const items = unwrapItems<T>(result);
  const nextCursor = unwrapPaginationCursor(result);
  return { items, nextCursor };
};

const parsePageResult = <T>(
  page: unknown,
  itemSchema?: ZodType<T>,
): PageResult<T> | undefined => {
  const schema = itemSchema
    ? createPageResultSchema(itemSchema)
    : basePageResultSchema;
  const result = schema.safeParse(page);
  if (!result.success) {
    return;
  }
  return result.data as PageResult<T>;
};

const paginate = async <T>(
  fetchPage: (cursor?: string | null) => Promise<PageResult<T> | unknown>,
  options: PaginationOptions<T> = {},
): Promise<T[]> => {
  const items: T[] = [];
  let cursor = options.cursor ?? null;
  let pages = 0;
  const maxPages = options.maxPages ?? Number.POSITIVE_INFINITY;
  const maxItems = options.maxItems ?? Number.POSITIVE_INFINITY;

  while (pages < maxPages && items.length < maxItems) {
    const page = await fetchPage(cursor);
    const parsed = parsePageResult(page, options.itemSchema);
    const { items: pageItems, nextCursor } = parsed ?? toPageResult<T>(page);

    items.push(...pageItems);
    pages += 1;

    if (!nextCursor) {
      break;
    }

    cursor = nextCursor;
  }

  return items.slice(0, maxItems);
};

export type { PageResult, PaginationOptions };
export { createPageResultSchema, toPageResult, parsePageResult, paginate };
