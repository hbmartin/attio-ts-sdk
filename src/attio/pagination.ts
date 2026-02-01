import type { ZodType } from "zod";
import { z } from "zod";
import {
  unwrapItems,
  unwrapPaginationCursor,
  unwrapPaginationOffset,
} from "./response";

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

interface OffsetPageResult<T> {
  items: T[];
  nextOffset?: number | null;
  total?: number;
}

interface OffsetPaginationOptions<T = unknown> {
  offset?: number;
  limit?: number;
  pageSize?: number;
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

const createOffsetPageResultSchema = <T>(itemSchema: ZodType<T>) =>
  z.object({
    items: z.array(itemSchema),
    nextOffset: z.number().nullish(),
    total: z.number().optional(),
  });

const baseOffsetPageResultSchema = z.object({
  items: z.array(z.unknown()),
  nextOffset: z.number().nullish(),
  total: z.number().optional(),
});

const toPageResult = <T>(result: unknown): PageResult<T> => {
  const items = unwrapItems<T>(result);
  const nextCursor = unwrapPaginationCursor(result);
  return { items, nextCursor };
};

const toOffsetPageResult = <T>(result: unknown): OffsetPageResult<T> => {
  const items = unwrapItems<T>(result);
  const nextOffset = unwrapPaginationOffset(result);
  return { items, nextOffset };
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

const parseOffsetPageResult = <T>(
  page: unknown,
  itemSchema?: ZodType<T>,
): OffsetPageResult<T> | undefined => {
  const schema = itemSchema
    ? createOffsetPageResultSchema(itemSchema)
    : baseOffsetPageResultSchema;
  const result = schema.safeParse(page);
  if (!result.success) {
    return;
  }
  return result.data as OffsetPageResult<T>;
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

const DEFAULT_OFFSET_PAGE_SIZE = 50;

interface NextOffsetParams {
  nextOffset?: number | null;
  pageItemsLength: number;
  limit: number;
  currentOffset: number;
}

const resolveNextOffset = ({
  nextOffset,
  pageItemsLength,
  limit,
  currentOffset,
}: NextOffsetParams): number | null => {
  if (typeof nextOffset === "number") {
    return nextOffset;
  }
  if (pageItemsLength < limit) {
    return null;
  }
  return currentOffset + limit;
};

const paginateOffset = async <T>(
  fetchPage: (
    offset: number,
    limit: number,
  ) => Promise<OffsetPageResult<T> | unknown>,
  options: OffsetPaginationOptions<T> = {},
): Promise<T[]> => {
  const items: T[] = [];
  const maxPages = options.maxPages ?? Number.POSITIVE_INFINITY;
  const maxItems = options.maxItems ?? Number.POSITIVE_INFINITY;
  const limit = Math.max(
    1,
    options.limit ?? options.pageSize ?? DEFAULT_OFFSET_PAGE_SIZE,
  );
  let offset = Math.max(0, options.offset ?? 0);
  let pages = 0;

  while (pages < maxPages && items.length < maxItems) {
    const page = await fetchPage(offset, limit);
    const parsed = parseOffsetPageResult(page, options.itemSchema);
    const { items: pageItems, nextOffset } =
      parsed ?? toOffsetPageResult<T>(page);

    items.push(...pageItems);
    pages += 1;

    if (items.length >= maxItems) {
      break;
    }

    const resolvedOffset = resolveNextOffset({
      nextOffset,
      pageItemsLength: pageItems.length,
      limit,
      currentOffset: offset,
    });

    if (resolvedOffset === null || resolvedOffset <= offset) {
      break;
    }

    offset = resolvedOffset;
  }

  return items.slice(0, maxItems);
};

export type {
  OffsetPageResult,
  OffsetPaginationOptions,
  PageResult,
  PaginationOptions,
};
export {
  createOffsetPageResultSchema,
  createPageResultSchema,
  paginate,
  paginateOffset,
  parseOffsetPageResult,
  parsePageResult,
  toOffsetPageResult,
  toPageResult,
};
