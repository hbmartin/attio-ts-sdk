import { unwrapItems, unwrapPaginationCursor } from "./response";

interface PageResult<T> {
  items: T[];
  nextCursor?: string | null;
}

interface PaginationOptions {
  cursor?: string | null;
  maxPages?: number;
  maxItems?: number;
}

const toPageResult = <T>(result: unknown): PageResult<T> => {
  const items = unwrapItems<T>(result);
  const nextCursor = unwrapPaginationCursor(result);
  return { items, nextCursor };
};

const paginate = async <T>(
  fetchPage: (cursor?: string | null) => Promise<PageResult<T> | unknown>,
  options: PaginationOptions = {},
): Promise<T[]> => {
  const items: T[] = [];
  let cursor = options.cursor ?? null;
  let pages = 0;
  const maxPages = options.maxPages ?? Number.POSITIVE_INFINITY;
  const maxItems = options.maxItems ?? Number.POSITIVE_INFINITY;

  while (pages < maxPages && items.length < maxItems) {
    const page = await fetchPage(cursor);
    const isPageResult =
      page !== null &&
      typeof page === "object" &&
      Array.isArray((page as PageResult<T>).items);
    const { items: pageItems, nextCursor } = isPageResult
      ? (page as PageResult<T>)
      : toPageResult<T>(page);

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
export { toPageResult, paginate };
